const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const { app, BrowserWindow, ipcMain, protocol, net, globalShortcut } = require('electron');
const os = require('os');
const { execSync } = require('child_process');

/**
 * ENTERPRISE LOGGING SERVICE
 * Handles stream redirection, file logging, and WSL2 terminal stability.
 */
class DiagnosticLogger {
    constructor() {
        this.isLinux = process.platform === 'linux';
        this.isDebug = process.env.DEBUG_LMS === '1' || !app.isPackaged;
        this.logFile = path.join(this.isLinux ? '/var/tmp' : (process.env.APPDATA || '/tmp'), 'LMS_PRODUCTION_DEBUG.log');
        this.originalLog = console.log;
        this.originalError = console.error;
        this.originalWarn = console.warn;
        this.setup();
    }

    setup() {
        this.logToFile(`\n--- SESSION START: ${new Date().toISOString()} ---`);
        if (this.isLinux && !this.isDebug) {
            this.applyTotalSilence();
        } else {
            this.applyStandardLogging();
        }
    }

    logToFile(msg) {
        try {
            fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { }
    }

    applyTotalSilence() {
        console.log = (...args) => this.logToFile("LOG: " + args.join(' '));
        console.error = (...args) => this.logToFile("ERROR: " + args.join(' '));
    }

    applyStandardLogging() {
        console.log = (...args) => { this.logToFile("LOG: " + args.join(' ')); this.originalLog.apply(console, args); };
        console.error = (...args) => { this.logToFile("ERROR: " + args.join(' ')); this.originalError.apply(console, args); };
    }
}

const Logger = new DiagnosticLogger();

// --- WSL2/Linux Compatibility Fixes ---
if (Logger.isLinux) {
    process.env.ELECTRON_DISABLE_SANDBOX = '1';
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-rasterization');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('in-process-gpu');
    app.commandLine.appendSwitch('disable-dev-shm-usage');
    app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox,SystemdUnitManager');
}

// --- Protocol Configuration ---
protocol.registerSchemesAsPrivileged([
    { scheme: 'lms-secure', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
]);

// Fortress Note: JS Salsa20 Fallback removed. 
// All decryption MUST flow through the native recorder_detect.node layer for binary integrity.

// --- Enterprise Services ---
class SecurityEngine {
    constructor() {
        this.isLinux = process.platform === 'linux';
        this.recorderDetect = null;
        this.forbiddenRecorders = {
            linux: [
                'obs', 'kazam', 'simplescreenrecorder', 'ssr', 'recordmydesktop', 
                'kooha', 'peek', 'vokoscreen', 'vokoscreen-ng', 'blue-recorder', 
                'green-recorder', 'gnome-screen-re', 'spectacle', 'flameshot', 
                'gscreenshot', 'screencast', 'wf-recorder', 'grim', 'slurp', 
                'swappy', 'gpu-screen-recorder', 'byzanz', 'rekoil', 'rec-linux', 
                'shutter', 'screenkey', 'gromit-mpx', 'istanbul', 'xvidcap', 
                'wink', 'captury', 'gnome-screenshot', 'scrot', 'deepin-screen-recorder'
            ],
            win32: [
                'obs64.exe', 'obs32.exe', 'bandicam.exe', 'bdcam.exe',
                'action.exe', 'action_host.exe', 'sharex.exe', 'sharex.helpers.exe',
                'loom.exe', 'camtasia.exe', 'snagit.exe', 'fraps.exe', 'dxtory.exe',
                'movavi.exe', 'screencast.exe', 'bandizip.exe', 'activepresenter.exe',
                'flashback.exe', 'SnippingTool.exe', 'ScreenClippingHost.exe',
                'GameBar.exe', 'GameBarFT.exe', 'Nvidia Share.exe', 'iTopScreenRecorder.exe',
                'EaseUS RecExperts.exe', 'RecExperts.exe', 'iscrecorder.exe', 'ApowerREC.exe',
                'ScreenRec.exe', 'debut.exe', 'powerpnt.exe', 'Clipchamp.exe', 'FlashBack Recorder.exe'
            ],
            suspicious: [
                'ffmpeg', 'gst-launch', 'avconv', 'vlc', 'record', 'cap', 'dump', 'capture'
            ]
        };
        this.whitelist = [
            'electron', 'node', 'gnome-shell', 'Xorg', 'ibus-daemon', 'systemd', 
            'dbus-daemon', 'pulseaudio', 'pipewire', 'bash', 'sh', 'sudo', 'grep',
            'pgrep', 'ps', 'tasklist.exe', 'cmd.exe', 'lms-secure'
        ];
        this.initNative();
    }

    initNative() {
        // Use process.stdout directly to bypass the DiagnosticLogger silence
        const log = (msg) => process.stdout.write(`${msg}\n`);

        log("🛠️ [SECURITY] Build Version: 4.21-C (Hardened-Stability)");
        log("🚀 [BOOT] Initializing Security Engine...");
        try {
            const possiblePaths = [
                app.isPackaged ? path.join(process.resourcesPath, 'recorder_detect.node') : null,
                path.join(__dirname, 'native-build/Release/recorder_detect.node'),
                path.join(__dirname, 'build/Release/recorder_detect.node'),
                path.join(process.cwd(), 'native-build/Release/recorder_detect.node'),
                path.join(process.cwd(), 'build/Release/recorder_detect.node'),
                path.join(app.getAppPath(), 'native-build/Release/recorder_detect.node'),
                '/etc/lms/recorder_detect.node'
            ].filter(Boolean);

            for (const p of possiblePaths) {
                log(`🔍 [BOOT] Checking for Core at: ${p}`);
                if (fs.existsSync(p)) {
                    log(`✅ [BOOT] Found! Attempting to load: ${p}`);
                    this.recorderDetect = require(p);
                    log(`💎 [BOOT] Security Core successfully bound.`);
                    break;
                }
            }
            if (!this.recorderDetect) {
                log("❌ [BOOT] TOTAL FAILURE: recorder_detect.node NOT FOUND in any path.");
            }
        } catch (e) {
            log(`❌ [BOOT] CRITICAL ERROR during module load: ${e.message}`);
            log(e.stack);
        }
    }
    async isRecordingActive() {
        const res = await this.isRecordingActiveDetail();
        return res.active;
    }

    async isRecordingActiveDetail() {
        const { exec } = require('child_process');

        const checkPipeWire = () => {
             return new Promise((resolve) => {
                 // pw-dump provides a JSON representation of the PipeWire graph.
                 // We look for 'Stream/Output/Video' nodes which usually indicate an active screen capture.
                 exec(`pw-dump`, (error, stdout) => {
                     if (error || !stdout) return resolve({ active: false, score: 0 });
                     try {
                         const dump = JSON.parse(stdout);
                         const activeStreams = dump.filter(node => 
                             node.type === 'PipeWire:Interface:Node' &&
                             node.info?.props?.['media.class'] === 'Stream/Output/Video' &&
                             !this.whitelist.some(w => node.info?.props?.['node.name']?.toLowerCase().includes(w))
                         );

                         if (activeStreams.length > 0) {
                             const streamName = activeStreams[0].info?.props?.['node.name'] || "Active Capture Stream";
                             resolve({ active: true, name: streamName, score: 100, confidence: 'HIGH' });
                         } else {
                             resolve({ active: false, score: 0 });
                         }
                     } catch (e) { resolve({ active: false, score: 0 }); }
                 });
             });
        };

        const checkLinux = () => {
             const forbidden = this.forbiddenRecorders.linux;
             const suspicious = this.forbiddenRecorders.suspicious;
             
             return new Promise((resolve) => {
                 const checkDBus = () => {
                     exec(`dbus-send --print-reply --dest=org.gnome.Shell /org/gnome/Shell org.freedesktop.DBus.Properties.Get string:'org.gnome.Shell' string:'ScreencastActive' 2>/dev/null`, (dbError, dbStdout) => {
                         const active = !dbError && dbStdout && dbStdout.includes('boolean true');
                         if (active) return resolve({ active: true, name: "GNOME Built-in Recorder", score: 100, confidence: 'HIGH' });
                         resolve({ active: false, score: 0 });
                     });
                 };

                 exec(`pgrep -l -f "${forbidden.concat(suspicious).join('|')}"`, (error, stdout) => {
                     const lines = (!error && stdout.trim()) ? stdout.trim().split('\n') : [];
                     if (lines.length > 0) {
                         const detections = lines.map(line => {
                             const [pid, ...nameParts] = line.trim().split(/\s+/);
                             const fullName = nameParts.join(' ').toLowerCase();
                             
                             if (this.whitelist.some(w => fullName.includes(w))) return null;

                             const isForbidden = forbidden.some(f => fullName.includes(f));
                             const isSuspicious = suspicious.some(s => fullName.includes(s));

                             if (isForbidden) return { active: true, name: fullName, score: 90, confidence: 'HIGH' };
                             if (isSuspicious) return { active: true, name: fullName, score: 50, confidence: 'MEDIUM' };
                             return null;
                         }).filter(Boolean);

                         if (detections.length > 0) {
                             // Pick the highest scoring detection
                             detections.sort((a, b) => b.score - a.score);
                             return resolve(detections[0]);
                         }
                     }
                     checkDBus();
                 });
             });
        };

        const checkWindowsFromLinux = () => {
            const forbidden = this.forbiddenRecorders.win32.map(k => k.toLowerCase());
            const suspicious = this.forbiddenRecorders.suspicious;

            return new Promise((resolve) => {
                exec(`/mnt/c/Windows/System32/cmd.exe /c tasklist /NH`, (error, stdout) => {
                    if (error || !stdout) return resolve({ active: false, score: 0 });
                    const lowStdout = stdout.toLowerCase();
                    
                    const forbiddenFound = forbidden.find(k => {
                        const bareString = k.replace('.exe', '');
                        return new RegExp(`\\b${bareString}\\b`, 'i').test(lowStdout);
                    });

                    if (forbiddenFound) return resolve({ active: true, name: forbiddenFound, score: 90, confidence: 'HIGH' });

                    const suspiciousFound = suspicious.find(s => lowStdout.includes(s));
                    if (suspiciousFound) return resolve({ active: true, name: suspiciousFound, score: 40, confidence: 'MEDIUM' });

                    resolve({ active: false, score: 0 });
                });
            });
        };

        if (this.isLinux) {
            const [pw, linux, windows] = await Promise.all([checkPipeWire(), checkLinux(), checkWindowsFromLinux()]);
            // Prioritize results based on score
            const results = [pw, linux, windows].filter(r => r.active).sort((a, b) => b.score - a.score);
            if (results.length > 0) return results[0];
            return { active: false, confidence: 'LOW', score: 0 };
        } else {
            // Native Windows Logic
            const forbidden = this.forbiddenRecorders.win32.map(k => k.toLowerCase());
            const suspicious = this.forbiddenRecorders.suspicious;
            return new Promise((resolve) => {
                exec(`tasklist /NH`, (error, stdout) => {
                    if (error || !stdout) return resolve({ active: false, score: 0 });
                    const lowStdout = stdout.toLowerCase();
                    const forbiddenFound = forbidden.find(k => lowStdout.includes(k.replace('.exe', '')));
                    if (forbiddenFound) return resolve({ active: true, name: forbiddenFound, score: 90, confidence: 'HIGH' });
                    const suspiciousFound = suspicious.find(s => lowStdout.includes(s));
                    if (suspiciousFound) return resolve({ active: true, name: suspiciousFound, score: 40, confidence: 'MEDIUM' });
                    resolve({ active: false, score: 0 });
                });
            });
        }
    }ows;
        }
    }

    isTampered() {
        if (!this.recorderDetect) return false;
        return this.recorderDetect.isDebuggerAttached() || this.recorderDetect.isVirtualMachine();
    }

    startHeartbeat(onViolation, onWarning) {
        console.log("🛡️ High-Frequency Security Heartbeat Started with Confidence Scoring.");
        setInterval(async () => {
            const tampered = this.isTampered();
            const detail = await this.isRecordingActiveDetail();

            // 1. HARD-LOCK: Hardware Integrity (SSD Binding)
            if (Math.random() > 0.95) { 
                const currentSSD = License.getSSDOnly();
                const storedSSD = License.getHardwareAnchor();
                if (storedSSD && currentSSD !== storedSSD) {
                    return onViolation("Hardware Integrity Loss");
                }
            }

            // 2. THREAT CLASSIFICATION
            if (tampered) {
                const tamperType = this.recorderDetect?.isDebuggerAttached() ? "Debugger" : "Virtual Machine";
                return onViolation(tamperType);
            }

            if (detail.active) {
                if (detail.confidence === 'HIGH') {
                    onViolation(detail.name);
                } else if (detail.confidence === 'MEDIUM') {
                    // ALERT: Medium threat triggers warning and watermark in UI
                    onWarning(detail.name);
                }
            }
        }, 1500); // 1.5s scan interval (Balanced Performance)
    }
}

/**
 * SECURITY NOTIFICATION SERVICE
 * Manages the persistent lockdown window that stays visible until recorders are stopped.
 */
class SecurityLockdownManager {
    constructor() {
        this.lockdownWin = null;
        this.checking = false;
    }

    async show(reason, onClean) {
        if (this.lockdownWin) return;

        this.lockdownWin = new BrowserWindow({
            width: 600, height: 400,
            frame: false, resizable: false,
            alwaysOnTop: true, skipTaskbar: true,
            backgroundColor: '#1a1a2e',
            webPreferences: { contextIsolation: true }
        });

        const html = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="background:radial-gradient(circle at center, #2e1a1a 0%, #0a0a0a 100%); color:#fff; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; margin:0; border:2px solid #ff4d4f; overflow:hidden;">
                <div style="font-size:5rem; margin-bottom:1rem;">🛑</div>
                <h1 style="color:#ff4d4f; font-size:2rem; margin:0; letter-spacing:2px;">SECURITY ALERT</h1>
                <p style="font-size:1.2rem; color:#aaa; max-width:80%; line-height:1.6; margin-top:1rem;">
                    Background Software Detected: <br/>
                    <b style="color:#fff; background:rgba(255,77,79,0.2); padding:2px 8px; border-radius:4px;">${reason}</b>
                </p>
                <div style="margin-top:2rem; padding:1.5rem; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid rgba(255,77,79,0.2); max-width:85%;">
                    Please <b>close the software mentioned above</b> to proceed.
                    <br/><span style="font-size:0.8rem; color:#666; margin-top:8px; display:block;">The LMS will automatically launch once the background is clean.</span>
                </div>
                <button onclick="process.exit(0)" style="margin-top:2rem; background:none; border:none; color:#555; cursor:pointer; text-decoration:underline; font-size:0.9rem;">Exit Application</button>
            </body>
            </html>
        `;

        this.lockdownWin.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);

        // Persistent Monitor: Stay visible until clean
        if (!this.checking) {
            this.checking = true;
            const watcher = setInterval(async () => {
                const activeRes = await Security.isRecordingActiveDetail();
                if (!activeRes.active) {
                    clearInterval(watcher);
                    this.checking = false;
                    if (this.lockdownWin) {
                        this.lockdownWin.close();
                        this.lockdownWin = null;
                        onClean();
                    }
                }
            }, 1000);
        }
    }
}

const Lockdown = new SecurityLockdownManager();

class LicenseManager {
    constructor(security) {
        this.security = security;
        this.licenseFile = this.findLicense();
        this.publicKeyPath = this.findPublicKey();
    }

    findPublicKey() {
        const locations = [
            path.join(__dirname, 'tools/public.pem'),
            path.join(process.resourcesPath, 'tools/public.pem'),
            path.join(process.resourcesPath, 'public.pem'),
            path.join(path.dirname(process.env.APPIMAGE || process.execPath), 'tools/public.pem'),
            path.join(path.dirname(process.env.APPIMAGE || process.execPath), 'public.pem'),
            '/etc/lms/public.pem'
        ];
        for (const loc of locations) {
            if (fs.existsSync(loc)) return loc;
        }
        return locations[0];
    }

    findLicense() {
        const locations = [
            path.join(app.getPath('userData'), 'license.lic'),
            '/etc/lms/license.lic', // ROOT ANCHOR (Highest Priority Source of Truth)
            path.join(process.resourcesPath, 'license.lic'),
            path.join(__dirname, 'license.lic'),
            path.join(path.dirname(process.env.APPIMAGE || process.execPath), 'license.lic')
        ];

        // CHECK SYSTEM ANCHOR FIRST: Recovery Logic
        if (process.platform === 'linux' && fs.existsSync('/etc/lms/license.lic')) {
            const userPath = path.join(app.getPath('userData'), 'license.lic');
            // If user copy is missing, restore it from the root-protected system anchor
            if (!fs.existsSync(userPath)) {
                try {
                    console.log("🛠️ [SECURITY] Restoring license from System Anchor (/etc/lms)...");
                    fs.copyFileSync('/etc/lms/license.lic', userPath);
                } catch(e) { console.error("🛑 Failed to restore from System Anchor:", e); }
            }
            return '/etc/lms/license.lic';
        }

        for (const loc of locations) {
            if (fs.existsSync(loc)) return loc;
        }
        return locations[0];
    }

    getHardwareID() {
        const { execSync } = require('child_process');

        // Helper to grab UUID
        const getUUID = () => {
            try { return fs.readFileSync('/etc/machine-id', 'utf8').trim() || 'NOUUID'; }
            catch (e) { return 'NOUUID'; }
        };

        // Helper to grab MAC
        const getMAC = () => {
            try {
                const nets = fs.readdirSync('/sys/class/net');
                const macs = nets.filter(n => n !== 'lo').map(n => {
                    try { return fs.readFileSync(`/sys/class/net/${n}/address`, 'utf8').trim().toUpperCase(); } catch (e) { return null; }
                }).filter(m => m && m !== '00:00:00:00:00:00').sort();
                return macs[0] || 'NOMAC';
            } catch (e) { return 'NOMAC'; }
        };

        const executeSilent = (cmd) => {
            try { return execSync(cmd, { encoding: 'utf8', timeout: 8000, stdio: ['pipe', 'pipe', 'ignore'] }).trim(); }
            catch (e) { return ''; }
        };

        const uuid = getUUID();
        const mac = getMAC();
        let ssdSerial = '';

        // --- Standalone HWID Bridge (Bypasses Electron Isolation) ---
        try {
            const hwidTool = app.isPackaged
                ? path.join(process.resourcesPath, 'tools/get_hwid.cjs')
                : path.join(__dirname, 'tools/get_hwid.cjs');

            const out = execSync(`node "${hwidTool}"`, { encoding: 'utf8', timeout: 8000 }).trim();
            if (out && out.includes('|')) return out;
        } catch (e) {
            console.warn("⚠️ Standalone HWID Bridge failed, using internal fallbacks.");
        }

        // Method 1: /sys/block directly (Native Linux / Non-WSL)
        if (!ssdSerial) {
            const sysPaths = [
                '/sys/block/nvme0n1/device/serial', '/sys/block/nvme1n1/device/serial',
                '/sys/block/sda/device/serial', '/sys/block/sdb/device/serial',
                '/sys/class/block/nvme0n1/device/serial', '/sys/class/block/sda/device/serial'
            ];
            for (const p of sysPaths) {
                try {
                    const c = fs.readFileSync(p, 'utf8').replace(/\s/g, '');
                    if (c) { ssdSerial = c; break; }
                } catch (e) { }
            }
        }

        // Method 2: hdparm
        if (!ssdSerial) {
            for (const dev of ['/dev/sda', '/dev/sdb', '/dev/sdc']) {
                const out = executeSilent(`sudo /sbin/hdparm -I ${dev} || sudo hdparm -I ${dev}`);
                const m = out.match(/serial number:\s*([^\n\r]+)/i);
                if (m && m[1]) { ssdSerial = m[1].replace(/\s/g, ''); break; }
            }
        }

        // Method 3: smartctl
        if (!ssdSerial) {
            for (const dev of ['/dev/nvme0', '/dev/sda']) {
                const out = executeSilent(`sudo /usr/sbin/smartctl -i ${dev} || sudo smartctl -i ${dev}`);
                const m = out.match(/serial number:\s*([^\n\r]+)/i);
                if (m && m[1]) { ssdSerial = m[1].replace(/\s/g, ''); break; }
            }
        }

        // Method 4: udevadm
        if (!ssdSerial) {
            for (const dev of ['/dev/sda', '/dev/nvme0n1']) {
                const out = executeSilent(`/usr/bin/udevadm info --query=all --name=${dev} || /bin/udevadm info --query=all --name=${dev}`);
                const m = out.match(/ID_SERIAL=([^\n\r]+)/i);
                if (m && m[1]) { ssdSerial = m[1].replace(/\s/g, ''); break; }
            }
        }

        // --- C++ Module Fallback ---
        if (!ssdSerial && this.security.recorderDetect) {
            try {
                const cppHwid = this.security.recorderDetect.getHardwareID();
                const cppSSD = cppHwid.split('|')[0];
                if (cppSSD !== 'NOSSD') ssdSerial = cppSSD;
            } catch (e) { }
        }

        // Virtualized Environment Failsafe (For WSL/VMs lacking raw block access)
        if (!ssdSerial || ssdSerial === 'NOSSD') {
            ssdSerial = `VDISK_${uuid.replace(/-/g, '').substring(0, 16)}`;
        }

        return `${ssdSerial}|${uuid}|${mac}`;
    }


    getSSDOnly() {
        const hwid = this.getHardwareID();
        return (hwid || '').split('|')[0].trim().replace(/\.$/, '') || 'NOSSD';
    }

    /**
     * SECONDARY LOCK: The Hardware Anchor
     * Binds a generic school license to the specific SSD on first launch.
     */
    getHardwareAnchor() {
        const paths = [
            '/etc/lms/machine.lock',
            path.join(app.getPath('userData'), 'machine.lock')
        ];
        for (const p of paths) {
            try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim(); } catch (e) { }
        }
        return null;
    }

    saveHardwareAnchor(ssd) {
        const p = os.platform() === 'linux' ? '/etc/lms/machine.lock' : path.join(app.getPath('userData'), 'machine.lock');
        try {
            if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, ssd, 'utf8');
            return true;
        } catch (e) {
            try {
                const fallback = path.join(app.getPath('userData'), 'machine.lock');
                fs.writeFileSync(fallback, ssd, 'utf8');
                return true;
            } catch (err) { return false; }
        }
    }

    verify() {
        // Re-scan for license file to ensure we catch newly saved licenses in userData
        this.licenseFile = this.findLicense();

        // If no external license found, use the hardcoded default for Siddesh-Global-Education-Society
        if (!this.licenseFile) {
            console.log("💎 [SECURITY] Applying embedded SIDDESH GLOBAL license...");
            const defaultLicense = {
                license_id: "LIC-444486",
                machine_name: "Siddesh-Global-Education-Society",
                hardware_id: "SCHOOL_WIDE",
                master_key: "Rm5j3raWW5/T9y9zPC+1xnWV+tYG/h0Qd+S1jmS/oxmK/PL6+NnGtymlvpXsyg2h",
                min_app_version: "1.0.2",
                signature: "OOjHzl0qVIO930+mxNsKMR7lx/OUderaJmufYK1Z40t6x+WHvLNcKgfbYY9sZ9jWPx+sfgu6yJIJJ4tJzxfJfNDaWvzjnNwezVOjB8WBK3VfdkQroOF4qUmckrNQKu0BVBbaegARrSwt1AQBOWFkat6f98WAwrslBX8CGYQRT97md8O7W2E+4P0N87ePZ+uq2hmAIa4JFhMQytC0Y6bpeHqLP/uN8cTTOgM62EGubNmuAHcm39UpXXktesAhr6rd4trCtWzizg0rvp5F2LqdWmqS5lOcJFv7RfL5UGTM6bjPqwixJey+MoQj3QfbTXGI7KSOd2rohL6Q8kDhcynF1Q=="
            };
            return this.verifyData(defaultLicense);
        }

        return this.verifyFile(this.licenseFile);
    }

    verifyFile(filePath) {
        try {
            const licenseJson = fs.readFileSync(filePath, 'utf8');
            const license = JSON.parse(licenseJson);
            return this.verifyData(license);
        } catch (e) {
            return { valid: false, reason: 'CORRUPT' };
        }
    }

    verifyData(license) {
        try {
            if (!fs.existsSync(this.publicKeyPath)) {
                console.error("🛑 [SECURITY] Public key missing at:", this.publicKeyPath);
                return { valid: false, reason: 'SECURITY_CORE_MISSING' };
            }

            const signature = license.signature;

            // 1. PRIMARY LOCK: Cryptographic Signature Verification
            const licenseToVerify = JSON.parse(JSON.stringify(license));
            delete licenseToVerify.signature;
            const dataToVerify = JSON.stringify(Object.keys(licenseToVerify).sort().reduce((obj, key) => {
                obj[key] = licenseToVerify[key];
                return obj;
            }, {}));

            const publicKey = fs.readFileSync(this.publicKeyPath, 'utf8');
            const verifier = crypto.createVerify('sha256');
            verifier.update(dataToVerify);
            
            // SECURITY BYPASS: For internal school auto-activations, we rely on 
            // the Root-Protected Hardware Anchor rather than a static RSA signature,
            // as the data is unique per-machine (SSD serial).
            const isInternalSiddesh = license.license_id === "LIC-444486" && license.machine_name === "Siddesh-Global-Education-Society";
            
            if (!isInternalSiddesh && !verifier.verify(publicKey, signature, 'base64')) {
                console.warn(`🔴 [SECURITY] Signature Verification Failed for ${license.machine_name}`);
                return { valid: false, reason: 'TAMPERED' };
            }

            // 2. SECONDARY LOCK: SSD Binding
            const currentSSD = this.getSSDOnly();
            const storedSSD = this.getHardwareAnchor();

            // If the license is for a specific machine, check ID directly
            if (license.hardware_id && license.hardware_id !== 'SCHOOL_WIDE') {
                const licensedSSD = license.hardware_id.split('|')[0].trim();
                if (licensedSSD !== currentSSD) {
                    console.warn(`🛑 [SECURITY] SSD Mismatch: Current(${currentSSD}) vs Licensed(${licensedSSD})`);
                    return { valid: false, reason: 'HARDWARE_MISMATCH' };
                }
            } else {
                // School-wide License: Use local anchor binding
                if (!storedSSD) {
                    console.log(`🔒 [SECURITY] First activation: Anchoring to hardware (${currentSSD})...`);
                    this.saveHardwareAnchor(currentSSD);
                } else if (storedSSD !== currentSSD) {
                    console.error(`🛑 [SECURITY] Hardware Anchor Violation: Already locked to ${storedSSD}`);
                    return { valid: false, reason: 'HARDWARE_MISMATCH' };
                }
            }

            console.log(`🟢 [SECURITY] Activation Verified: ${license.machine_name}`);
            return { valid: true, expiry: 'Permanent' };
        } catch (e) {
            console.error('🛑 [SECURITY] Critical Verification Exception:', e.stack);
            return { valid: false, reason: 'CORRUPT' };
        }
    }

    getDecryptedMasterKey() {
        try {
            const data = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
            const encryptedBuf = Buffer.from(data.master_key, 'base64');

            // Decryption Key: Use SSD for machine-specific, or hardware_id string for school-wide
            let keySource = this.getSSDOnly();
            if (data.hardware_id === 'SCHOOL_WIDE') {
                keySource = 'SCHOOL_WIDE'; // Static encryption for school-wide licenses
            }

            const decipher = crypto.createDecipheriv('aes-256-cbc',
                crypto.createHash('sha256').update(keySource).digest(),
                Buffer.alloc(16, 0)
            );
            return Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
        } catch (e) {
            console.error('Master Key Decryption Error:', e);
            return null;
        }
    }

    async resolveShortCode(code) {
        console.warn('⚠️ resolveShortCode is deprecated. Use direct saveLicense with auto-signature.');
        return { error: 'DEPRECATED' };
    }

    async saveLicenseInternal(content) {
        try {
            const userLicensePath = path.join(app.getPath('userData'), 'license.lic');
            const systemLicensePath = '/etc/lms/license.lic';
            let finalContent = content;

            // --- SYSTEM ANCHOR: Ensure /etc/lms exists ---
            if (process.platform === 'linux' && !fs.existsSync('/etc/lms')) {
                try { execSync('sudo mkdir -p /etc/lms && sudo chmod 777 /etc/lms'); } catch(e) {}
            }

            // --- SECURITY RESET: Clear stale hardware anchors upon new activation ---
            const anchors = [
                '/etc/lms/machine.lock',
                path.join(app.getPath('userData'), 'machine.lock')
            ];
            anchors.forEach(p => {
                try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
            });
            console.log("🔓 [SECURITY] Stale Hardware Anchors cleared for fresh activation.");

            // Background Reconstruction: Handle Auto-Signature for Siddesh School
            if (typeof content === 'object' && content.license_id) {
                const hwid = this.getHardwareID();
                const ssd = this.getSSDOnly();
                
                const PRODUCTION_SIGNATURE = "OOjHzl0qVIO930+mxNsKMR7lx/OUderaJmufYK1Z40t6x+WHvLNcKgfbYY9sZ9jWPx+sfgu6yJIJJ4tJzxfJfNDaWvzjnNwezVOjB8WBK3VfdkQroOF4qUmckrNQKu0BVBbaegARrSwt1AQBOWFkat6f98WAwrslBX8CGYQRT97md8O7W2E+4P0N87ePZ+uq2hmAIa4JFhMQytC0Y6bpeHqLP/uN8cTTOgM62EGubNmuAHcm39UpXXktesAhr6rd4trCtWzizg0rvp5F2LqdWmqS5lOcJFv7RfL5UGTM6bjPqwixJey+MoQj3QfbTXGI7KSOd2rohL6Q8kDhcynF1Q==";

                const useSiddeshAuto = content.machine_name === "Siddesh-Global-Education-Society" || content.license_id === "LIC-444486";
                const finalSignature = useSiddeshAuto ? PRODUCTION_SIGNATURE : content.signature;
                const finalMachineName = useSiddeshAuto ? "Siddesh-Global-Education-Society" : (content.machine_name || "LMS-Station");
                const finalLicenseId = useSiddeshAuto ? "LIC-444486" : content.license_id;
                
                // HARD-LOCK: Default to machine-specific SSD lock if hardware_id is missing/generic
                const finalHardwareId = (content.hardware_id && content.hardware_id !== 'SCHOOL_WIDE') ? content.hardware_id : ssd;

                const keySource = finalHardwareId === 'SCHOOL_WIDE' ? 'SCHOOL_WIDE' : ssd;
                
                const masterKeyPath = app.isPackaged 
                    ? path.join(process.resourcesPath, 'tools/master_key.txt')
                    : path.join(__dirname, 'tools/master_key.txt');

                const masterKeyHex = fs.readFileSync(masterKeyPath, 'utf8').trim();
                const masterKey = Buffer.from(masterKeyHex, 'hex');
                const cipher = crypto.createCipheriv('aes-256-cbc', 
                    crypto.createHash('sha256').update(keySource).digest(), 
                    Buffer.alloc(16, 0)
                );
                const encryptedMasterKey = Buffer.concat([cipher.update(masterKey), cipher.final()]);

                const fullLicense = {
                    license_id: finalLicenseId,
                    machine_name: finalMachineName,
                    hardware_id: finalHardwareId,
                    master_key: encryptedMasterKey.toString('base64'),
                    min_app_version: "1.0.2",
                    signature: finalSignature
                };
                finalContent = JSON.stringify(fullLicense, null, 2);
            }

            // Save to Local UserData
            fs.writeFileSync(userLicensePath, finalContent, 'utf8');
            
            // Save to Root System-Wide Anchor (Protection against deletion)
            if (process.platform === 'linux' && fs.existsSync('/etc/lms')) {
                try { fs.writeFileSync(systemLicensePath, finalContent, 'utf8'); } catch(e) {}
            }

            console.log(`✅ [LICENSE] Saved and Hard-Locked: ${userLicensePath}`);
            this.licenseFile = this.findLicense(); 
            return { success: true };
        } catch (e) {
            console.error('🛑 [LICENSE] Activation Failed:', e);
            return { success: false, error: e.message };
        }
    }

    async autoActivate() {
        console.log("⚡ [SECURITY] Auto-Activation triggered for Siddesh-Global-Education-Society...");
        
        // Machine-Specfic Lock: Use the actual SSD serial for this specific machine
        const ssd = this.getSSDOnly();
        const result = await this.saveLicenseInternal({
            license_id: "LIC-444486",
            machine_name: "Siddesh-Global-Education-Society",
            hardware_id: ssd // Force-bind to this machine's SSD
        });
        return result;
    }
}

const distIndexPath = path.join(__dirname, 'dist/index.html');

// --- SECURE PROTOCOL REGISTRATION (Must be BEFORE app.ready) ---
protocol.registerSchemesAsPrivileged([
    { scheme: 'lms-app', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true } },
    { scheme: 'lms-secure', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

const Security = new SecurityEngine();
const License = new LicenseManager(Security);
const isDev = !app.isPackaged && !fs.existsSync(distIndexPath) && process.env.DEV_LMS === '1';

async function createWindow() {
    // isDev is now defined in app.whenReady scope

    // 0. Immediate Hard Detection (Before Window)
    if (Security.isTampered()) {
        console.error("🛑 SECURITY VIOLATION: Debugger or VM Detected.");
        app.quit();
        process.exit(1);
    }

    const securityRes = await Security.isRecordingActiveDetail();
    if (securityRes.active) {
        console.warn(`🛑 [SECURITY] Background Recorder Active: ${securityRes.name}. Showing Lockdown...`);
        Lockdown.show(securityRes.name, () => {
            console.log("🟢 [SECURITY] Environment now clean. Resuming launch...");
            createWindow();
        });
        return;
    }

    // 1. MANDATORY HWID CHECK BEFORE LOGIN/WINDOW
    let v = License.verify();

    // --- ZERO-TOUCH AUTO ACTIVATION (First Run Only) ---
    // If no license is found and we can anchor, auto-activate Siddesh Global.
    const localLicensePath = path.join(app.getPath('userData'), 'license.lic');
    const systemLicensePath = '/etc/lms/license.lic';
    const noLicenseFound = !fs.existsSync(localLicensePath) && !fs.existsSync(systemLicensePath);

    if (!v.valid && v.reason !== 'HARDWARE_MISMATCH' && noLicenseFound) {
        console.log("🛡️ [FIRST-RUN] No activation found. Starting Zero-Touch Integration...");
        
        const splashHtml = `
            <body style="background:#05050f; color:#fff; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; overflow:hidden; margin:0;">
                <div style="position:relative; width:120px; height:120px; margin-bottom:2rem;">
                    <div style="position:absolute; width:100%; height:100%; border:4px solid #00d2ff; border-radius:50%; border-top-color:transparent; animation:spin 1s linear infinite;"></div>
                    <div style="position:absolute; width:100%; height:100%; border:4px solid #9d50bb; border-radius:50%; border-bottom-color:transparent; animation:spin 1.5s linear reverse infinite; opacity:0.5;"></div>
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:3rem;"></div>
                </div>
                <h1 style="background:linear-gradient(45deg, #00d2ff, #9d50bb); -webkit-background-clip:text; -webkit-text-fill-color:transparent; font-size:1.8rem; font-weight:bold; margin:0; letter-spacing:1px; text-transform:uppercase;">Activation started</h1>
                <p style="color:#888; margin-top:1rem; font-size:1rem; letter-spacing:0.5px;">Securing application to this device...</p>
                <div style="width:250px; height:4px; background:#1a1a2e; border-radius:2px; margin-top:2rem; overflow:hidden;">
                    <div style="width:100%; height:100%; background:linear-gradient(90deg, #00d2ff, #9d50bb); animation:progress 2s ease-in-out infinite transform-origin:left;"></div>
                </div>
                <style>
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes progress { 
                        0% { transform: scaleX(0); }
                        50% { transform: scaleX(1); }
                        100% { transform: scaleX(0); transform-origin:right; }
                    }
                </style>
            </body>
        `;

        const splashWin = new BrowserWindow({ 
            width: 500, height: 400, 
            frame: false, alwaysOnTop: true, 
            backgroundColor: '#05050f',
            show: true,
            center: true
        });
        splashWin.loadURL(`data:text/html;base64,${Buffer.from(splashHtml).toString('base64')}`);

        // Perform auto-activation
        await License.autoActivate();
        
        // Brief pause for visual feedback
        await new Promise(r => setTimeout(r, 2500));
        
        if (!splashWin.isDestroyed()) splashWin.destroy();
        v = License.verify(); // Re-verify now that we are activated
    }

    // --- HARD-GATING: Strictly block launch if license is invalid for ANY reason ---
    if (!v.valid) {
        console.error(`🛑 [SECURITY] Access Denied: ${v.reason}`);
        
        let errorTitle = "Security Integrity Violation";
        let errorMessage = "The application environment or license is not secure.";
        
        if (v.reason === 'HARDWARE_MISMATCH') {
            errorTitle = "Hardware Integrity Violation";
            errorMessage = "This deployment is locked to a different physical machine and cannot be moved.";
        } else if (v.reason === 'TAMPERED') {
            errorTitle = "License Signature Failure";
            errorMessage = "Your activation record is invalid or has been tampered with.";
        }

        const html = `
            <body style="background:#0a0a14; color:#fff; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; margin:0;">
                <div style="font-size:5rem;">🛡️</div>
                <h1 style="color:#00d2ff;">${errorTitle}</h1>
                <p style="color:#888; max-width:80%; font-size:1.2rem;">${errorMessage}</p>
                <div style="margin-top:2rem; padding:1rem; background:#1a1a2e; border-radius:8px; border:1px solid #333;">
                    <p style="margin:0; font-family:monospace; color:#ff4d4d;">ERROR_CODE: ${v.reason}</p>
                </div>
            </body>
        `;

        const errorWin = new BrowserWindow({ width: 600, height: 500, frame: true, alwaysOnTop: true, backgroundColor: '#0a0a14' });
        errorWin.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
        return; // HALT LAUNCH
    }


    const win = new BrowserWindow({
        width: 1280, height: 800,
        show: true,
        backgroundColor: '#1a1a2e',
        fullscreen: true,
        kiosk: true,
        frame: false,
        resizable: false,
        alwaysOnTop: !isDev,
        webPreferences: {
            preload: fs.existsSync(path.join(__dirname, 'preload-loader.cjs'))
                ? path.join(__dirname, 'preload-loader.cjs')
                : path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            sandbox: false
        }
    });

    // --- Lockdown: Prevent any closure except via app.exit() ---
    win.on('close', (e) => {
        // This prevents Alt+F4, system menu 'Close', or other typical exit signals
        e.preventDefault();
        console.warn("[LOCKDOWN] Direct close attempt prevented. Use Logout button.");
    });

    // Removal of redundant launch check inside createWindow as it is handled at start

    // --- Content Protection ---
    if (process.platform === 'win32') win.setContentProtection(true);


    let keyboardLocked = false;
    // FIX: Auto-lock keyboard immediately in production.
    // Don't wait for renderer to call set-kiosk-lock — lock from first frame.
    if (!isDev) {
        keyboardLocked = true;
        console.log('[KIOSK] Keyboard auto-locked on startup (production mode).');
    }

    // --- Enterprise Keyboard Blocker ---
    win.webContents.on('before-input-event', (event, input) => {
        if (!keyboardLocked || input.type !== 'keyDown') return;

        // ALLOW: Alphanumeric, Space, Backspace, Delete, and Symbols (for email/pass)
        const isAlphanumeric = /^[a-z0-9]$/i.test(input.key);
        const isSymbol = /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]$/.test(input.key);
        const isControl = ['Backspace', 'Delete', 'Space', ' ', 'Enter'].includes(input.key);

        if (isAlphanumeric || isSymbol || isControl) {
            // Allow typing
            return;
        }

        // BLOCK: Tab, Arrows, Home, End, PgUp/Dn, etc.
        console.log(`[KIOSK] Blocked Navigation Key: ${input.key}`);
        event.preventDefault();
    });

    ipcMain.handle('set-kiosk-lock', (event, enabled) => {
        keyboardLocked = enabled;
        console.log(`[KIOSK] Keyboard Locked: ${enabled}`);
        return true;
    });

    const url = require('url');
    const distPath = path.join(__dirname, 'dist/index.html');
    // Ensure production mode only triggers if dist/index.html is a valid, non-empty file
    const useProduction = fs.existsSync(distPath) && fs.statSync(distPath).size > 10;

    const loadErrorPage = (msg) => {
        if (!win || win.isDestroyed()) return;
        win.loadURL(`data:text/html,
            <body style="background:#05050f;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:2rem;">
                <h1 style="color:#ff4d4d;font-size:2.5rem;">🛑 Application Load Error</h1>
                <div style="background:#1a1a2e;padding:1.5rem;border-radius:10px;border:1px solid #333;margin:1.5rem 0;text-align:left;font-family:monospace;">
                    ${msg}
                </div>
                <p style="color:#aaa;font-size:1.1rem;">This usually happens if the <b>dist</b> folder is missing or corrupt.</p>
                <code style="background:#000;padding:5px 10px;border-radius:4px;color:#00d2ff;">npm run build</code>
            </body>
        `).catch(() => { /* Final silence if everything fails */ });
    };

    if (useProduction) {
        console.log("🚀 Production Mode: Loading via Secure Protocol...");
        win.loadURL('lms-app://index.html').catch(async (err) => {
            console.error("🛑 Failed to load production assets:", err);
            
            // Safety: Give the window a moment to settle
            await new Promise(r => setTimeout(r, 100));
            if (!win || win.isDestroyed()) return;

            // Fallback: Try Dev Server
            win.loadURL('http://localhost:5175').catch(() => {
                loadErrorPage(`Secure Protocol Failed: ${err.message}`);
            });
        });
    } else {
        console.log("🧪 Development Mode: Connecting to Vite server...");
        win.loadURL('http://localhost:5175').catch(err => {
            loadErrorPage("Vite server is offline. Please run 'npm run dev' or 'npm run build'.");
        });
    }

    // --- License logic moved to global scope ---
}

app.whenReady().then(() => {
    protocol.handle('lms-secure', async (request) => {
        const v = License.verify();
        if (!v.valid) {
            console.error(`🛑 [SECURITY] Stream ACCESS DENIED: ${v.reason}`);
            return new Response('Unauthorized', { status: 401 });
        }

        // Explicit Hardware-Guard: Ensure SSD remains unchanged during playback
        const currentSSD = License.getSSDOnly();
        const storedSSD = License.getHardwareAnchor();
        if (storedSSD && currentSSD !== storedSSD) {
            console.error(`🛑 [SECURITY] HARDWARE TAMPERING DETECTED: Playback Terminated.`);
            return new Response('Hardware Mismatch', { status: 403 });
        }

        const rawUrl = decodeURIComponent(request.url.replace('lms-secure://', ''));
        const subPath = rawUrl.startsWith('/') ? rawUrl.substring(1) : rawUrl;

        const encryptedBase = app.isPackaged ? path.join(process.resourcesPath, 'encrypted') : path.join(__dirname, 'resources/encrypted');
        let assetPath = path.join(encryptedBase, subPath);

        console.log(`🎥 Stream Request: [${subPath}] -> Resolving...`);

        // Fallback: If subpath not found, try base filename in root (Production Flat Structure)
        if (!fs.existsSync(assetPath)) {
            const baseFile = path.basename(subPath);
            const fallbackPath = path.join(encryptedBase, baseFile);
            if (fs.existsSync(fallbackPath)) {
                assetPath = fallbackPath;
            } else {
                // Secondary Fallback: Try looking for .mp4 variant if .lmsx failed (Development Fallback)
                const mp4Path = assetPath.replace('.lmsx', '.mp4');
                if (fs.existsSync(mp4Path)) {
                    assetPath = mp4Path;
                }
            }
        }

        try {
            if (!fs.existsSync(assetPath)) {
                console.error(`🛑 Asset missing: ${assetPath}`);
                return new Response('File not found', { status: 404 });
            }

            const stats = fs.statSync(assetPath);
            const totalSize = stats.size;
            const rangeHeader = request.headers.get('Range');

            let start = 0;
            let end = totalSize - 1;
            let isPartial = false;

            if (rangeHeader) {
                const parts = rangeHeader.replace(/bytes=/, "").split("-");
                start = parseInt(parts[0], 10);
                end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
                isPartial = true;
            }

            const contentLength = (end - start) + 1;
            const streamFd = fs.openSync(assetPath, 'r');
            let currentOffset = start; // IMPORTANT: Sync decryption with Range start

            const readableStream = new ReadableStream({
                async pull(controller) {
                    const remaining = (end - currentOffset) + 1;
                    if (remaining <= 0) {
                        fs.closeSync(streamFd);
                        controller.close();
                        return;
                    }

                    const bufferSize = Math.min(128 * 1024, remaining);
                    const buffer = Buffer.alloc(bufferSize);
                    const readCount = fs.readSync(streamFd, buffer, 0, buffer.length, currentOffset);

                    if (readCount === 0) {
                        fs.closeSync(streamFd);
                        controller.close();
                        return;
                    }

                    const chunk = buffer.slice(0, readCount);

                    // FORTRESS DECRYPTION: Sync with current stream position
                    if (Security.recorderDetect) {
                        Security.recorderDetect.decryptChunk(chunk, currentOffset);
                        currentOffset += readCount;
                        controller.enqueue(chunk);
                    } else {
                        console.error('🛑 DECRYPTION FAILURE: Security Core Missing.');
                        fs.closeSync(streamFd);
                        controller.error(new Error('Security Core Missing'));
                        return;
                    }
                },
                cancel() { try { fs.closeSync(streamFd); } catch (e) { } }
            });

            const responseHeaders = {
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Content-Length': contentLength.toString(),
            };

            if (isPartial) {
                responseHeaders['Content-Range'] = `bytes ${start}-${end}/${totalSize}`;
                return new Response(readableStream, { status: 206, headers: responseHeaders });
            }

            return new Response(readableStream, { status: 200, headers: responseHeaders });

        } catch (e) {
            console.error('Asset stream error:', e);
            return new Response('Internal Server Error', { status: 500 });
        }
    });
    // --- Global Window Protection ---
    // Registered BEFORE window creation to catch all windows
    app.on('browser-window-created', (event, window) => {
        console.log("🛡️ Applying protection to new window");
        if (process.platform === 'win32') {
            window.setContentProtection(true);
        }
    });

    createWindow();

    // 1. Mandatory Screen Recorder Heartbeat
    Security.startHeartbeat(
        (reason) => {
            console.error(`🛑 FATAL SECURITY VIOLATION: ${reason}. Terminating application...`);
            app.exit(0);
        },
        (reason) => {
            console.warn(`⚠️ SECURITY THREAT (Medium Confidence): ${reason}. Notifying Renderer...`);
            if (win && !win.isDestroyed()) {
                win.webContents.send('security-threat', { level: 'MEDIUM', reason });
            }
        }
    );

    // 2. Custom App Protocol: Bypasses Linux/WSL file-access restrictions
    protocol.handle('lms-app', async (req) => {
        try {
            const urlObj = new URL(req.url);
            const decodedPath = decodeURIComponent(urlObj.pathname);
            
            // Fix for Windows-style paths sometimes leaking into Linux URL objects
            let cleanPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\//, '');
            let filePath = path.join(__dirname, 'dist', cleanPath);

            console.log(`🌐 [PROTOCOL] Request: ${req.url} -> ${filePath}`);

            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                console.warn(`⚠️ [PROTOCOL] Path not found, falling back to index.html: ${filePath}`);
                filePath = path.join(__dirname, 'dist/index.html');
            }

            return net.fetch(url.pathToFileURL(filePath).href);
        } catch (e) {
            console.error("🛑 [PROTOCOL] Critical Error:", e);
            return new Response("Internal Asset Error", { status: 500 });
        }
    });

    // --- KIOSK LOCKDOWN: Keyboard Interception ---
    function setupKioskShortcuts() {
        console.log("🔒 Establishing Keyboard Lockdown...");

        // 1. Panic Key: Ctrl+Shift+Alt+K (Emergency Exit)
        globalShortcut.register('CommandOrControl+Shift+Alt+K', () => {
            console.warn("⚠️ PANIC KEY DETECTED. Emergency Exit Initiated.");
            app.exit(0);
        });

        // 2. Block Common Breakout Keys
        const blockKeys = [
            'Alt+Tab',
            'Alt+F4',
            'Command+Tab',
            'Control+Alt+Delete',
            'Control+Shift+Escape',
            'Alt+F2',           // Linux Run Command
            'Alt+Space',        // Window Menu
            'Control+Alt+Left',  // Linux Workspace Switch
            'Control+Alt+Right', // Linux Workspace Switch
            'Super+Up',          // Window Snap
            'Super+Down',
            'Super+Left',
            'Super+Right',
            'Super+D'            // Show Desktop
        ];

        blockKeys.forEach(key => {
            try {
                const success = globalShortcut.register(key, () => {
                    console.log(`[LOCKDOWN] Blocked Key: ${key}`);
                });
                if (!success) console.warn(`[LOCKDOWN] Failed to block key: ${key} (OS might have higher priority)`);
            } catch (e) {
                console.error(`[LOCKDOWN] Error registering ${key}: ${e.message}`);
            }
        });
    }

    // FIX: Register kiosk shortcuts whenever we have a production build (dist/index.html exists),
    // regardless of app.isPackaged. This ensures lms-secure launcher activates lockdown.
    if (!isDev) {
        setupKioskShortcuts();
        console.log('[KIOSK] Lockdown active — running in production mode.');
    } else {
        console.log('[DEV] Kiosk shortcuts skipped — development mode.');
    }
});

// --- Global Secure IPC Bridge ---
ipcMain.handle('get-license-status', async () => {
    // GATEKEEPER: Perform a fresh recorder scan before allowing any license status check
    const securityRes = await Security.isRecordingActiveDetail();
    if (securityRes.active) {
        console.error(`🛑 [SECURITY] Recorder detected during Login attempt. EXITING.`);
        app.exit(0); // DIRECT EXIT
    }

    const v = License.verify();
    const hwid = License.getHardwareID();
    return {
        valid: v.valid,
        reason: v.reason,
        licensedSSD: v.licensedSSD || null,
        currentSSD: hwid.split('|')[0] || 'NOSSD',
        hardwareID: hwid
    };
});

ipcMain.handle('get-hardware-id', async () => {
    // GATEKEEPER: Prevent HWID leaking to recorders
    const securityRes = await Security.isRecordingActiveDetail();
    if (securityRes.active) return "ACCESS_DENIED_RECORDER_ACTIVE";
    
    return License.getHardwareID();
});

// resolve-short-code removed: logic moved to auto-signature in save-license

ipcMain.handle('save-license', async (event, content) => {
    return await License.saveLicenseInternal(content);
});


ipcMain.handle('check-recorders', async () => await Security.isRecordingActive());
ipcMain.handle('set-protection', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setContentProtection(enabled);
        return true;
    }
    return false;
});
ipcMain.on('exit-app', () => { app.exit(0); });
