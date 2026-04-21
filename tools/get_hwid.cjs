const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

/**
 * LMS IRONCLAD HARDWARE IDENTIFIER (v2)
 * Advanced parsing to skip headers and robust UUID detection in WSL.
 */

const executeSilent = (cmd) => {
    try {
        return execSync(cmd, {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (e) { return ''; }
};

function getUUID() {
    // Priority 1: Direct File Read (Standard Linux)
    try {
        if (os.platform() === 'linux') {
            if (fs.existsSync('/etc/machine-id')) return fs.readFileSync('/etc/machine-id', 'utf8').trim();
            if (fs.existsSync('/var/lib/dbus/machine-id')) return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
        }
    } catch (e) { }

    // Priority 2: Shell Command fallback
    try {
        if (os.platform() === 'linux') {
            const out = executeSilent('cat /etc/machine-id || cat /var/lib/dbus/machine-id');
            if (out && out.length >= 32) return out;
        }
    } catch (e) { }

    // Priority 3: WSL Cross-Platform Bridge (Fetch Windows MachineGuid)
    // This is critical for WSL environments where /etc/machine-id is not stable or missing.
    try {
        const isWSL = fs.existsSync('/proc/version') && fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
        if (isWSL) {
            const out = executeSilent('/mnt/c/Windows/System32/cmd.exe /c "reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid"');
            const match = out.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/i);
            if (match && match[1]) return match[1];
        }
    } catch (e) { }

    // Priority 4: Native Windows (cmd.exe or powershell)
    try {
        if (os.platform() === 'win32') {
            const out = executeSilent('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
            const match = out.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/i);
            if (match && match[1]) return match[1];
        }
    } catch (e) { }

    return 'NOUUID';
}

function getMAC() {
    try {
        const networkInterfaces = os.networkInterfaces();
        const macs = [];
        for (const interfaceName in networkInterfaces) {
            const iface = networkInterfaces[interfaceName];
            for (const details of iface) {
                if (!details.internal && details.mac && details.mac !== '00:00:00:00:00:00') {
                    macs.push(details.mac.toUpperCase());
                }
            }
        }
        if (macs.length > 0) {
            // Predictable sort: Pick the first physical MAC alphabetically
            return macs.sort()[0];
        }
    } catch (e) { }
    return 'NOMAC';
}

function getSSDSerial() {
    let ssdSerial = '';
    const isLinux = os.platform() === 'linux';

    if (isLinux) {
        // --- WSL HARDWARE BRIDGE ---
        const isWSL = fs.existsSync('/proc/version') && fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');

        if (isWSL) {
            const bridgeCmds = [
                '/mnt/c/Windows/System32/cmd.exe /c wmic diskdrive get SerialNumber',
                '/mnt/c/Windows/System32/Wbem/wmic.exe diskdrive get SerialNumber',
                '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command "Get-PhysicalDisk | Select-Object -First 1 -ExpandProperty SerialNumber"'
            ];

            for (const cmd of bridgeCmds) {
                const out = executeSilent(cmd);
                if (out) {
                    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                    // ADVANCED FILTER: Explicitly reject headers and tool noise
                    const cleanSerial = lines.find(l => {
                        const low = l.toLowerCase();
                        return !low.includes('wsl.localhost') &&
                            !low.includes('unc paths') &&
                            !low.includes('cmd.exe') &&
                            !low.includes('serialnumber') &&
                            !low.includes('diskdrive') &&
                            low.length > 4; // Serials are usually long
                    });

                    if (cleanSerial) {
                        // Remove spaces and trailing dots (common in wmic output)
                        ssdSerial = cleanSerial.replace(/\s/g, '').replace(/\.$/, '');
                        break;
                    }
                }
            }
        }

        // --- NATIVE LINUX METHODS ---
        if (!ssdSerial) {
            const sysPaths = [
                '/sys/block/nvme0n1/device/serial', '/sys/block/sda/device/serial',
                '/sys/class/block/nvme0n1/device/serial', '/sys/class/block/sda/device/serial'
            ];
            for (const p of sysPaths) {
                try {
                    const c = fs.readFileSync(p, 'utf8').replace(/\s/g, '');
                    if (c) { ssdSerial = c; break; }
                } catch (e) { }
            }
        }

        if (!ssdSerial) {
            const out = executeSilent('sudo hdparm -I /dev/sda | grep "Serial Number"');
            const m = out.match(/Serial Number:\s*([^\n\r]+)/i);
            if (m && m[1]) ssdSerial = m[1].replace(/\s/g, '');
        }
    } else {
        // Windows Native
        const out = executeSilent('wmic diskdrive get SerialNumber');
        const lines = out.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const cleanSerial = lines.find(l => l.toLowerCase() !== 'serialnumber' && l.length > 4);
        if (cleanSerial) ssdSerial = cleanSerial.replace(/\s/g, '');
    }

    const uuid = getUUID();
    let finalSSD = ssdSerial || `VDISK_${uuid.substring(0, 16)}`;

    // NORMALIZE: Always remove trailing dots and whitespace
    finalSSD = finalSSD.trim().replace(/\.$/, '');

    return finalSSD;
}

const hwid = `${getSSDSerial()}|${getUUID()}|${getMAC()}`;
// Output only the HWID string so parent can capture it
process.stdout.write(hwid);
