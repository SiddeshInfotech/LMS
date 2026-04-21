#ifdef _WIN32
#include <windows.h>
#include <tlhelp32.h>
#else
#include <dirent.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/ptrace.h>
#include <signal.h>
#include <fstream>
#include <algorithm>
#endif

#include <string>
#include <vector>
#include <napi.h>
#include <iomanip>
#include <sstream>
#include <cstdint>



// --- Salsa20 Implementation for Hardware-Locked Decryption ---
// --- Salsa20 Implementation for Hardware-Locked Decryption ---
static uint32_t lms_salsa20_rotl(uint32_t x, int b) { return (x << b) | (x >> (32 - b)); }
static void lms_salsa20_quarterRound(uint32_t& a, uint32_t& b, uint32_t& c, uint32_t& d) {
    b ^= lms_salsa20_rotl(a + d, 7);
    c ^= lms_salsa20_rotl(b + a, 9);
    d ^= lms_salsa20_rotl(c + b, 13);
    a ^= lms_salsa20_rotl(d + c, 18);
}
static void lms_salsa20_block(uint32_t out[16], const uint32_t in[16]) {
    for (int i = 0; i < 16; i++) out[i] = in[i];
    for (int i = 0; i < 10; i++) {
        lms_salsa20_quarterRound(out[0], out[4], out[8], out[12]);
        lms_salsa20_quarterRound(out[5], out[9], out[13], out[1]);
        lms_salsa20_quarterRound(out[10], out[14], out[2], out[6]);
        lms_salsa20_quarterRound(out[15], out[3], out[7], out[11]);
        lms_salsa20_quarterRound(out[0], out[1], out[2], out[3]);
        lms_salsa20_quarterRound(out[5], out[6], out[7], out[4]);
        lms_salsa20_quarterRound(out[10], out[11], out[8], out[9]);
        lms_salsa20_quarterRound(out[15], out[12], out[13], out[14]);
    }
    for (int i = 0; i < 16; i++) out[i] += in[i];
}

// --- Forward Declarations ---
std::string GetHardwareFingerprint();

// --- Known recorder process names ---
#ifdef _WIN32
static const std::vector<std::wstring> RECORDER_PROCESSES = {
    L"obs64.exe",        L"obs32.exe",        L"obs.exe",
    L"bandicam.exe",     L"bdcam.exe",
    L"action.exe",       L"action_host.exe",
    L"sharex.exe",       L"sharex.helpers.exe",
    L"loom.exe",         L"loom-recorder.exe",
    L"camtasia.exe",     L"snagit.exe",       L"snagit32.exe",     L"snagit64.exe",
    L"fraps.exe",        L"dxtory.exe",
    L"movavi.exe",       L"screencast.exe",   L"bandizip.exe",
    L"activepresenter.exe", L"flashback.exe", L"flashbackrecorder.exe",
    L"SnippingTool.exe", L"ScreenClippingHost.exe", L"SnippingToolProcess.exe",
    L"Nvidia Share.exe", L"GameBarFT.exe", L"GameBar.exe", L"GamePanel.exe",
    L"iTopScreenRecorder.exe", L"EaseUS RecExperts.exe", L"RecExperts.exe",
    L"iscrecorder.exe", L"ApowerREC.exe", L"ScreenRec.exe", 
    L"debut.exe", L"powerpnt.exe", L"Clipchamp.exe", L"FlashBack Recorder.exe",
    L"vlc.exe", L"webex.exe", L"zoom.exe", L"teams.exe", L"discord.exe", L"slack.exe"
};
#else
static const std::vector<std::string> RECORDER_PROCESSES = {
    "obs",               "obs-studio",        "obs64",             "obs-studio-bin",
    "kazam",             "simplescreenrecorder", "ssr",            "ssr-glinject",
    "recordmydesktop",   "kooha",             "kooha-recorder",
    "peek",              "vokoscreen",        "vokoscreen-ng",     "vokoscreenng",
    "blue-recorder",     "green-recorder",    "gnome-screen-re",   "gnome-screencast",
    "spectacle",         "flameshot",         "gscreenshot",       "screencast",
    "wf-recorder",       "grim",              "slurp",             "swappy",
    "gnome-screenshot",  "blue-recorder",     "gpu-screen-recorder", "gpu-screen-recorder-gtk",
    "gscreenshot",       "kooha",             "peek",              "byzanz",            
    "rekoil",            "rec-linux",         "shutter",           "screenkey",
    "gromit-mpx",        "istanbul",          "xvidcap",           "wink",              
    "captury",           "scrot",             "deepin-screen-recorder", "com.deepin.screen-recorder",
    "ffmpeg",            "gst-launch-1.0",    "avconv",            "vlc",
    "vokoscreen-ng",     "vokoscreen",        "byzanz-record",     "obs-game-capture",
    "xdg-desktop-portal-gnome", "xdg-desktop-portal-kde", "xdg-desktop-portal-wlr"
};
#endif

// --- Helpers ---
#ifdef _WIN32
static std::wstring ToLower(std::wstring s) {
    for (auto& c : s) c = towlower(c);
    return s;
}
#endif

static std::string ToLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), ::tolower);
    return s;
}

// --- Core Detection ---
std::vector<int> GetRecordingPIDs() {
    std::vector<int> pids;
#ifdef _WIN32
    HANDLE hSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnap == INVALID_HANDLE_VALUE) return pids;

    PROCESSENTRY32W pe = { sizeof(pe) };
    if (Process32FirstW(hSnap, &pe)) {
        do {
            std::wstring procName = ToLower(pe.szExeFile);
            for (const auto& rec : RECORDER_PROCESSES) {
                if (procName == ToLower(rec)) {
                    pids.push_back(pe.th32ProcessID);
                    break;
                }
            }
        } while (Process32NextW(hSnap, &pe));
    }
    CloseHandle(hSnap);
#else
    DIR* dir = opendir("/proc");
    if (!dir) return pids;

    struct dirent* entry;
    while ((entry = readdir(dir)) != nullptr) {
        char* endptr;
        long pid = std::strtol(entry->d_name, &endptr, 10);
        if (*endptr != '\0') continue;

        // 1. Check /proc/[pid]/comm (Short process name)
        std::string commPath = std::string("/proc/") + entry->d_name + "/comm";
        std::ifstream commFile(commPath);
        std::string commLine;
        bool detected = false;

        if (std::getline(commFile, commLine)) {
            commLine.erase(std::remove(commLine.begin(), commLine.end(), '\n'), commLine.end());
            commLine.erase(std::remove(commLine.begin(), commLine.end(), '\r'), commLine.end());
            std::string procName = ToLower(commLine);
            for (const auto& rec : RECORDER_PROCESSES) {
                if (procName == ToLower(rec)) {
                    detected = true;
                    break;
                }
            }
        }

        // 2. Check /proc/[pid]/cmdline (Full command line) if not found in comm
        // This catches recorders that might use 'ffmpeg' or 'python' as their base process.
        if (!detected) {
            std::string cmdPath = std::string("/proc/") + entry->d_name + "/cmdline";
            std::ifstream cmdFile(cmdPath);
            std::string cmdLine;
            if (std::getline(cmdFile, cmdLine)) {
                std::string fullCmd = ToLower(cmdLine);
                for (const auto& rec : RECORDER_PROCESSES) {
                    if (fullCmd.find(ToLower(rec)) != std::string::npos) {
                        detected = true;
                        break;
                    }
                }
            }
        }

        if (detected) {
            pids.push_back(static_cast<int>(pid));
        }

    }
    closedir(dir);
#endif
    return pids;
}

bool IsScreenRecordingActive() {
    return !GetRecordingPIDs().empty();
}

// --- Anti-Debugging & Anti-VM ---
bool IsDebuggerAttached() {
#ifdef _WIN32
    return IsDebuggerPresent() == TRUE;
#else
    // ENTERPRISE STABILITY: Using /proc/self/status instead of ptrace(PTRACE_TRACEME).
    // ptrace(PTRACE_TRACEME) can cause SIGSTOP signals which suspend the process in WSL/restricted shells.
    std::ifstream statusFile("/proc/self/status");
    if (!statusFile.is_open()) return false;

    std::string line;
    while (std::getline(statusFile, line)) {
        if (line.compare(0, 10, "TracerPid:") == 0) {
            std::string pidStr = line.substr(10);
            pidStr.erase(std::remove_if(pidStr.begin(), pidStr.end(), ::isspace), pidStr.end());
            if (!pidStr.empty()) {
                long tracerPid = std::strtol(pidStr.c_str(), nullptr, 10);
                if (tracerPid != 0) return true;
            }
        }
    }
    
    // Fortress Depth: Direct ptrace check on non-WSL Linux
    #ifndef _WIN32
    if (ptrace(PTRACE_TRACEME, 0, 1, 0) == -1) return true;
    #endif

    return false;
#endif
}

bool IsVirtualMachine() {
    // Simple heuristic: common VM indicators in hardware strings
    std::string fingerprint = ToLower(GetHardwareFingerprint());
    if (fingerprint.find("vbox") != std::string::npos || 
        fingerprint.find("virtualbox") != std::string::npos ||
        fingerprint.find("vmware") != std::string::npos ||
        fingerprint.find("qemu") != std::string::npos) {
        return true;
    }
    return false;
}

bool KillProcess(int pid) {
#ifdef _WIN32
    HANDLE hProcess = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
    if (hProcess == NULL) return false;
    BOOL result = TerminateProcess(hProcess, 0);
    CloseHandle(hProcess);
    return result == TRUE;
#else
    // Send SIGKILL (9) for instant termination
    return kill(static_cast<pid_t>(pid), 9) == 0;
#endif
}

// --- Core Prevention ---
#ifdef _WIN32
bool ProtectWindow(HWND hwnd) {
    // WDA_EXCLUDEFROMCAPTURE = 0x00000011 (Windows 10 2004+)
    BOOL ok = SetWindowDisplayAffinity(hwnd, 0x00000011);
    return (ok == TRUE);
}
#else
bool ProtectWindow(void* handle) {
    return false;
}
#endif

#ifdef _WIN32
#include <winioctl.h>
#endif

// --- Hardware Fingerprinting ---
#ifdef _WIN32
#include <intrin.h>
#include <iphlpapi.h>
#pragma comment(lib, "IPHLPAPI.lib")
#endif

// Helper to get MAC address
std::string GetMacAddress() {
    std::vector<std::string> macs;
#ifdef _WIN32
    IP_ADAPTER_INFO adapterInfo[16];
    DWORD dwBufLen = sizeof(adapterInfo);
    if (GetAdaptersInfo(adapterInfo, &dwBufLen) == NO_ERROR) {
        PIP_ADAPTER_INFO pAdapterInfo = adapterInfo;
        while (pAdapterInfo) {
            char buf[20];
            sprintf(buf, "%02X:%02X:%02X:%02X:%02X:%02X", 
                   pAdapterInfo->Address[0], pAdapterInfo->Address[1], 
                   pAdapterInfo->Address[2], pAdapterInfo->Address[3], 
                   pAdapterInfo->Address[4], pAdapterInfo->Address[5]);
            std::string m = buf;
            if (m != "00:00:00:00:00:00") {
                macs.push_back(m);
            }
            pAdapterInfo = pAdapterInfo->Next;
        }
    }
#else
    // Linux: Try all standard interfaces in /sys/class/net
    DIR* dir = opendir("/sys/class/net");
    if (dir) {
        struct dirent* entry;
        while ((entry = readdir(dir)) != nullptr) {
            if (entry->d_name[0] == '.') continue;
            std::string path = std::string("/sys/class/net/") + entry->d_name + "/address";
            std::ifstream macFile(path);
            std::string m;
            if (macFile.is_open() && std::getline(macFile, m)) {
                if (!m.empty() && m != "00:00:00:00:00:00") {
                    // Convert to uppercase for consistency with Windows
                    std::transform(m.begin(), m.end(), m.begin(), ::toupper);
                    macs.push_back(m);
                }
            }
        }
        closedir(dir);
    }
#endif

    if (macs.empty()) return "00:00:00:00:00:00";
    
    // Sort MACs to ensure deterministic selection regardless of OS return order
    std::sort(macs.begin(), macs.end());
    return macs[0];
}

// Helper to get System UUID
std::string GetSystemUUID() {
    std::string uuid = "";
#ifdef _WIN32
    /* DEACTIVATED WINDOWS UUID
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Cryptography", 0, KEY_READ | KEY_WOW64_64KEY, &hKey) == ERROR_SUCCESS) {
        char buf[256];
        DWORD len = sizeof(buf);
        if (RegQueryValueExA(hKey, "MachineGuid", NULL, NULL, (LPBYTE)buf, &len) == ERROR_SUCCESS) {
            uuid = buf;
        }
        RegCloseKey(hKey);
    }
    */
#else
    std::ifstream uuidFile("/etc/machine-id");
    if (uuidFile.is_open()) std::getline(uuidFile, uuid);
#endif
    return uuid;
}

std::string GetHardwareFingerprint() {
    std::string ssdId = "";
#ifdef _WIN32
    /* DEACTIVATED WINDOWS SSD/VOLUME SERIAL
    HANDLE hDevice = CreateFileW(L"\\\\.\\PhysicalDrive0", 0, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
    if (hDevice != INVALID_HANDLE_VALUE) {
        STORAGE_PROPERTY_QUERY query = { StorageDeviceProperty, PropertyStandardQuery };
        STORAGE_DEVICE_DESCRIPTOR descriptor = { 0 };
        DWORD bytesReturned = 0;
        if (DeviceIoControl(hDevice, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), &descriptor, sizeof(descriptor), &bytesReturned, NULL)) {
            std::vector<char> buffer(descriptor.Size);
            if (DeviceIoControl(hDevice, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), buffer.data(), descriptor.Size, &bytesReturned, NULL)) {
                STORAGE_DEVICE_DESCRIPTOR* result = reinterpret_cast<STORAGE_DEVICE_DESCRIPTOR*>(buffer.data());
                if (result->SerialNumberOffset != 0) {
                    ssdId = std::string(buffer.data() + result->SerialNumberOffset);
                }
            }
        }
        CloseHandle(hDevice);
    }
    // Fallback: Volume Serial if PhysicalDrive0 access fails (happens if not running as Admin)
    if (ssdId.empty() || ssdId.find_first_not_of(" \t\n\r") == std::string::npos) {
        DWORD volSerial = 0;
        if (GetVolumeInformationW(L"C:\\", NULL, 0, &volSerial, NULL, NULL, NULL, 0)) {
            ssdId = std::to_string(volSerial);
        }
    }
    */
#else
    // Linux: Try reading serial from common block devices
    const char* devices[] = {
        "/sys/block/sda/device/serial", 
        "/sys/block/nvme0n1/device/serial",
        "/sys/class/block/sda/device/serial",
        "/sys/class/block/nvme0n1/device/serial"
    };
    for (const char* dev : devices) {
        std::ifstream file(dev);
        if (file.is_open()) {
            std::getline(file, ssdId);
            if (!ssdId.empty()) break;
        }
    }
#endif
    
    // Sanitize SSD ID
    ssdId.erase(std::remove_if(ssdId.begin(), ssdId.end(), ::isspace), ssdId.end());

    // Triple Binding: SSD + UUID + MAC
    std::string uuid = GetSystemUUID();
#ifndef _WIN32
    // Linux: Use /etc/machine-id for extreme stability if UUID fails
    if (uuid.empty() || uuid == "UNKNOWN-UUID") {
        std::ifstream machineIdFile("/etc/machine-id");
        if (machineIdFile.is_open()) {
            std::getline(machineIdFile, uuid);
        }
    }
#endif
    uuid.erase(std::remove_if(uuid.begin(), uuid.end(), ::isspace), uuid.end());

    std::string mac = GetMacAddress();
    mac.erase(std::remove_if(mac.begin(), mac.end(), ::isspace), mac.end());
    
    // Combine with fixed delimiters
    std::string compositeId = (ssdId.empty() ? "NOSSD" : ssdId) + "|" + 
                             (uuid.empty() ? "NOUUID" : uuid) + "|" + 
                             (mac.empty() ? "NOMAC" : mac);
    
    return compositeId;
}

// --- Node-API Exports ---
Napi::Value JS_IsRecordingActive(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, IsScreenRecordingActive());
}

Napi::Value JS_KillRecordingProcesses(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::vector<int> pids = GetRecordingPIDs();
    int killedCount = 0;
    for (int pid : pids) {
        if (KillProcess(pid)) killedCount++;
    }
    return Napi::Number::New(env, killedCount);
}

Napi::Value JS_ProtectWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
#ifdef _WIN32
    if (info.Length() < 1 || !info[0].IsBigInt()) {
        Napi::TypeError::New(env, "Expected BigInt HWND").ThrowAsJavaScriptException();
        return env.Null();
    }
    bool lossless;
    uint64_t hwndVal = info[0].As<Napi::BigInt>().Uint64Value(&lossless);
    HWND hwnd = reinterpret_cast<HWND>(hwndVal);
    return Napi::Boolean::New(env, ProtectWindow(hwnd));
#else
    return Napi::Boolean::New(env, false);
#endif
}

Napi::Value JS_GetHardwareID(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::String::New(env, GetHardwareFingerprint());
}

// --- Chunk Decryption ---
// Uses the Hardware-Locked Master Key passed from the license
Napi::Value JS_DecryptChunk(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsBuffer() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Expected Buffer and AbsoluteOffset").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Uint8Array dataArray = info[0].As<Napi::Uint8Array>();
    // Using DoubleValue to safely handle large offsets from JS (up to 2^53)
    uint64_t absoluteOffset = static_cast<uint64_t>(info[1].As<Napi::Number>().DoubleValue());

    uint8_t* data = dataArray.Data();
    size_t length = dataArray.ByteLength();
    
    // FORTRESS VAULT: Master Key is embedded, not passed from JS
    static const uint8_t VAULT_KEY[32] = {
        0xbc, 0xa8, 0x90, 0xd4, 0x71, 0xfe, 0x84, 0x02, 
        0x2e, 0xad, 0x47, 0x0b, 0x41, 0x1e, 0x17, 0x09, 
        0x59, 0x7b, 0xde, 0x7d, 0x60, 0x76, 0x3b, 0xdb, 
        0xa1, 0x41, 0x9a, 0x10, 0x6e, 0xb6, 0x15, 0xcb
    };
    const uint32_t* key = reinterpret_cast<const uint32_t*>(VAULT_KEY);

    uint32_t block[16];
    uint8_t* stream = reinterpret_cast<uint8_t*>(block);
    uint32_t currentChunkIndex = 0xFFFFFFFF; // Initialize to invalid to trigger first block generation

    // XOR Decryption
    for (size_t i = 0; i < length; i++) {
        uint64_t currentPos = absoluteOffset + i;
        uint32_t chunkIndex = static_cast<uint32_t>(currentPos / 64);

        // Generate a new keystream block only when we cross a 64-byte boundary
        if (chunkIndex != currentChunkIndex) {
            currentChunkIndex = chunkIndex;
            uint32_t state[16] = {
                0x61707865, key[0], key[1], key[2],
                key[3], 0x33322d6b, currentChunkIndex, 0, // Nonce uses chunkIndex
                0, 0, 0x6e647974, key[4],
                key[5], key[6], key[7], 0x616c6267
            };
            lms_salsa20_block(block, state);
        }

        data[i] ^= stream[currentPos % 64];
    }

    return dataArray;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("isRecordingActive",   Napi::Function::New(env, JS_IsRecordingActive));
    exports.Set("killRecorders",       Napi::Function::New(env, JS_KillRecordingProcesses));
    exports.Set("protectWindow",       Napi::Function::New(env, JS_ProtectWindow));
    exports.Set("getHardwareID",       Napi::Function::New(env, JS_GetHardwareID));
    exports.Set("decryptChunk",        Napi::Function::New(env, JS_DecryptChunk));
    exports.Set("isDebuggerAttached", Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
#ifdef _WIN32
        return Napi::Boolean::New(info.Env(), IsDebuggerAttached());
#else
        // WSL/Linux: Disable Debugger detection to prevent false positives in virtualized environments.
        return Napi::Boolean::New(info.Env(), false);
#endif
    }));
    exports.Set("isVirtualMachine",   Napi::Function::New(env, [](const Napi::CallbackInfo& info) {
#ifdef _WIN32
        return Napi::Boolean::New(info.Env(), IsVirtualMachine());
#else
        // WSL/Linux: Disable VM detection to prevent false positives in virtualized dev/production environments.
        return Napi::Boolean::New(info.Env(), false);
#endif
    }));
    return exports;
}

NODE_API_MODULE(recorder_detect, Init)
