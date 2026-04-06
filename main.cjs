const { app, BrowserWindow, ipcMain, protocol, net, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const url = require('url');

// --- 0. Protocol Configuration (MUST call before app is ready) ---
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'lms-secure', 
    privileges: { 
      standard: true, 
      secure: true, 
      supportFetchAPI: true, 
      stream: true, 
      bypassCSP: true 
    } 
  }
]);

function canonicalStringify(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  sortedKeys.forEach(key => {
      result[key] = obj[key];
  });
  return JSON.stringify(result);
}

// --- High Performance Salsa20 Decryption Fallback (JS Port of C++ Source) ---
const rotl = (x, b) => (x << b) | (x >>> (32 - b));
const qr = (s, a, b, c, d) => {
  s[b] ^= rotl((s[a] + s[d]) >>> 0, 7);
  s[c] ^= rotl((s[b] + s[a]) >>> 0, 9);
  s[d] ^= rotl((s[c] + s[b]) >>> 0, 13);
  s[a] ^= rotl((s[d] + s[c]) >>> 0, 18);
};
const salsa20_block = (out, in_state) => {
  let x = new Uint32Array(in_state);
  for (let i = 0; i < 10; i++) {
    qr(x, 0, 4, 8, 12); qr(x, 5, 9, 13, 1); qr(x, 10, 14, 2, 6); qr(x, 15, 3, 7, 11);
    qr(x, 0, 1, 2, 3); qr(x, 5, 6, 7, 4); qr(x, 10, 11, 8, 9); qr(x, 15, 12, 13, 14);
  }
  for (let i = 0; i < 16; i++) out[i] = x[i] + in_state[i];
};

// --- Unify and fix decryptChunkJS logic ---
function decryptChunkJS(data, absoluteOffset, keyBuffer) {
  const key = new Uint32Array(keyBuffer.buffer, keyBuffer.byteOffset, 8);
  const length = data.length;
  let currentChunkIndex = -1;
  const block = new Uint32Array(16);
  const stream = new Uint8Array(block.buffer);

  for (let i = 0; i < length; i++) {
    const currentPos = absoluteOffset + i;
    const chunkIndex = Math.floor(currentPos / 64);

    if (chunkIndex !== currentChunkIndex) {
      currentChunkIndex = chunkIndex;
      const state = new Uint32Array([
        0x61707865, key[0], key[1], key[2],
        key[3], 0x33322d6b, chunkIndex, 0,
        0, 0, 0x6e647974, key[4],
        key[5], key[6], key[7], 0x616c6267
      ]);
      salsa20_block(block, state);
    }
    data[i] ^= stream[currentPos % 64];
  }
  return data;
}

// EMERGENCY LOGGING - AppData Fallback (Permissions safe)
const logFile = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : '/var/tmp'), 'LMS_PRODUCTION_DEBUG.log');
function logToFile(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  logToFile("LOG: " + args.join(' '));
  originalLog.apply(console, args);
};

console.error = (...args) => {
  logToFile("ERROR: " + args.join(' '));
  originalError.apply(console, args);
};

console.warn = (...args) => {
  logToFile("WARN: " + args.join(' '));
  originalWarn.apply(console, args);
};

console.log('--- STARTUP DEBUG LOG VERSION 1.2 ---');

console.log(`--- LMS DIAGNOSTIC LOG SOURCE: ${logFile} ---`);
console.log('App version:', app.getVersion());
console.log('Platform:', process.platform);
console.log('Arch:', process.arch);
console.log('Exe Path:', process.execPath);
console.log('Resources Path:', process.resourcesPath);
console.log('App Dirname:', __dirname);

// 1. Disable Hardware Acceleration to ensure WDA_EXCLUDEFROMCAPTURE works
app.disableHardwareAcceleration();

// Load the native module securely
const nativePath = app.isPackaged
  ? path.join(process.resourcesPath, 'recorder_detect.node')
  : path.join(__dirname, 'build/Release/recorder_detect.node');

console.log('Initial Native Path Attempt:', nativePath);

let recorderDetect;
try {
  recorderDetect = require(nativePath);
  console.log('✅ Native module loaded successfully!');
} catch (e) {
  console.error('❌ Native security module failed to load:', e.message);
  
  // Try fallback path if it's missing in resources root
  if (app.isPackaged) {
    const fallbackPath = path.join(process.resourcesPath, 'app/build/Release/recorder_detect.node');
    console.log('Trying Fallback Path:', fallbackPath);
    try {
      recorderDetect = require(fallbackPath);
      console.log('✅ Native module loaded from fallback path!');
    } catch (e2) {
       console.error('❌ Fallback also failed:', e2.message);
    }
  }
}

// --- Unified Hardware ID Retrieval ---
function getCurrentHWID() {
  if (recorderDetect) return recorderDetect.getHardwareID();
  return "NATIVE_SECURITY_MODULE_FAILURE_PLEASE_REBUILD";
}

function getCurrentSSD() {
  const hwid = getCurrentHWID();
  return hwid.split('|')[0] || hwid;
}

// --- Unified License Path Retrieval ---
function getLicensePath() {
  let finalPath = '';
  if (app.isPackaged) {
      const userPath = path.join(app.getPath('userData'), 'license.lic');
      if (fs.existsSync(userPath)) {
        finalPath = userPath;
      }
  }
  
  if (!finalPath) {
    finalPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'license.lic') 
        : path.join(__dirname, 'license.lic');
  }

  return finalPath;
}

let cachedDecryptedMasterKey = null;

function getDecryptedMasterKey() {
  if (cachedDecryptedMasterKey) return cachedDecryptedMasterKey;
  
  const licensePath = getLicensePath();
  const licenseFile = fs.existsSync(licensePath) ? fs.readFileSync(licensePath, 'utf8') : null;
  
  if (licenseFile) {
    try {
      const license = JSON.parse(licenseFile);
      const hwid = getCurrentHWID();
      
      console.log('📜 LICENSE LOAD: Using file from:', licensePath);
      console.log('📜 LICENSE LOAD: Expected HWID in license:', license.hardware_id);
      console.log('📜 LICENSE LOAD: Current System HWID:', hwid);

      // SSD-Locked Security: We use ONLY the SSD portion for the decryption key to ensure
      // stability if the motherboard or network adapters change.
      const ssd = getCurrentSSD();
      const decipher = crypto.createDecipheriv('aes-256-cbc', 
        crypto.createHash('sha256').update(ssd).digest(), 
        Buffer.alloc(16, 0)
      );
      
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(license.master_key, 'base64')),
        decipher.final()
      ]);

      if (decrypted.length === 32) {
        cachedDecryptedMasterKey = decrypted;
        console.log('✅ SECURE STREAM: Derived master key from license (32 bytes).');
      } else {
        console.error('❌ SECURE STREAM: Decrypted key length mismatch!', decrypted.length, 'bytes (expected 32)');
      }
    } catch (e) {
      console.warn('License key derivation failed:', e.message);
    }
  }

  // Fallback ONLY if license decryption failed or was missing
  if (!cachedDecryptedMasterKey) {
    const fallbackPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tools/master_key.txt')
      : path.join(__dirname, 'tools/master_key.txt');
    
    if (fs.existsSync(fallbackPath)) {
      try {
        const hex = fs.readFileSync(fallbackPath, 'utf8').trim();
        const fallback = Buffer.from(hex, 'hex');
        if (fallback.length === 32) {
          cachedDecryptedMasterKey = fallback;
          console.log('✅ SECURE STREAM: Using local fallback key (32 bytes)');
        } else {
          console.error('❌ SECURE STREAM: Local fallback key length mismatch!', fallback.length);
        }
      } catch (e) {
        console.error('Failed to read fallback key:', e.message);
      }
    }
  }

  return cachedDecryptedMasterKey;
}

// --- License Verification Logic ---
function verifyLicense() {
  const licensePath = getLicensePath();
  if (!fs.existsSync(licensePath)) return { valid: false, reason: 'MISSING' };

  try {
    const publicKeyPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tools/public.pem')
      : path.join(__dirname, 'tools/public.pem');
    
    if (!fs.existsSync(publicKeyPath)) {
      console.error('License Error: Public key not found at:', publicKeyPath);
      return { valid: false, reason: 'KEY_MISSING' };
    }

    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    const license = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    const signature = license.signature;
    delete license.signature;

    const verifier = crypto.createVerify('sha256');
    verifier.update(canonicalStringify(license));
    const isValid = verifier.verify(publicKey, signature, 'base64');

    if (!isValid) return { valid: false, reason: 'TAMPERED' };

    // Hardware check: Fuzzy Matching
    const currentHwid = getCurrentHWID();
    const currentSsd = getCurrentSSD();
    const expectedHwid = license.hardware_id;
    const expectedSsd = expectedHwid.split('|')[0];

    console.log('Detected Current HWID:', currentHwid);

    if (expectedHwid !== currentHwid) {
      if (expectedSsd === currentSsd && currentSsd !== "" && currentSsd !== "NATIVE_SECURITY_MODULE_FAILURE_PLEASE_REBUILD") {
        console.warn('⚠️ HARDWARE DRIFT: Full HWID mismatch, but SSD matches. Granting access.');
      } else {
        return { valid: false, reason: 'HARDWARE_MISMATCH' };
      }
    }

    // Expiry check
    if (new Date(license.expiry) < new Date()) return { valid: false, reason: 'EXPIRED', expiry: license.expiry };

    // Version check (Anti-Rollback)
    const currentVersion = app.getVersion();
    const minVersion = license.min_app_version || "1.0.0";
    
    if (compareVersions(currentVersion, minVersion) < 0) {
      console.error(`Version Lock: Current v${currentVersion} < Required min v${minVersion}`);
      return { valid: false, reason: 'VERSION_OUTDATED' };
    }

    return { valid: true, reason: 'VALID', expiry: license.expiry };
  } catch (e) {
    console.error('License verification error:', e);
    return { valid: false, reason: 'TAMPERED' };
  }
}

// Simple semver comparison helper
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) return 1;
        if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
}

// --- Javascript Security Fallbacks (Used if Native Module Fails) ---
const forbiddenRecorders = {
    win32: ['obs64.exe', 'obs32.exe', 'bandicam.exe', 'bdcam.exe', 'action.exe', 'sharex.exe', 'loom.exe', 'camtasia.exe', 'snagit.exe', 'fraps.exe', 'movavi.exe', 'screencast.exe'],
    linux: ['obs', 'vokoscreen', 'simplescreenrecorder', 'recordmydesktop', 'peek', 'kooha'] 
};

async function isRecordingActiveJS() {
    const platform = process.platform;
    const forbidden = forbiddenRecorders[platform] || forbiddenRecorders.win32;

    return new Promise((resolve) => {
        const { exec } = require('child_process');
        // Use CSV format on Windows for robust parsing (handles spaces in process names)
        const cmd = platform === 'win32' ? 'tasklist /FO CSV /NH' : 'ps -A --no-headers';
        exec(cmd, (err, stdout) => {
            if (err) return resolve(false);
            
            const lines = stdout.split('\n');
            for (let line of lines) {
                if (!line.trim()) continue;
                
                let processName = '';
                if (platform === 'win32') {
                    // CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
                    const parts = line.split('","');
                    if (parts.length > 0) {
                        processName = parts[0].replace(/"/g, '').toLowerCase();
                    }
                } else {
                    processName = line.trim().split(/\s+/)[0].toLowerCase();
                }

                if (forbidden.some(f => f.toLowerCase() === processName)) {
                    console.warn(`SECURITY ALERT: Forbidden process '${processName}' active.`);
                    return resolve(true);
                }
            }
            resolve(false);
        });
    });
}

function isDebuggerAttachedJS() {
    const inspector = require('inspector');
    const hasInspector = !!inspector.url();
    const hasFlags = process.execArgv.some(arg => arg.includes('--inspect') || arg.includes('--debug'));
    if (hasInspector || hasFlags) {
        console.warn(`SECURITY ALERT: Debugger detected (Inspector: ${hasInspector}, Flags: ${hasFlags})`);
        return true;
    }
    return false;
}

async function performPanicCheck() {
  const isDev = !app.isPackaged;
  const isDebugger = isDebuggerAttachedJS() || (recorderDetect && recorderDetect.isDebuggerAttached());
  const isRecording = await isRecordingActiveJS() || (recorderDetect && recorderDetect.isRecordingActive());
  
  if (isDebugger || isRecording) {
    console.error('CRITICAL: Security violation detected at startup. Blocking launch.');
    return { valid: false, reason: isDebugger ? 'DEBUGGER' : 'RECORDER' };
  }
  return { valid: true };
}

function createWindow() {
  // Determine if we are in development or production
  const isDev = !app.isPackaged;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "LMS Security Test - VERSION 1.6",
    fullscreen: !isDev,
    kiosk: !isDev,
    alwaysOnTop: !isDev,
    frame: isDev,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged 
    }
  });

  // Enable built-in content protection (Windows/macOS)
  win.setContentProtection(true);

  if (!isDev) win.setMenu(null);

  // Global Shortcut Lockdown (swallow piracy keys)
  globalShortcut.register('PrintScreen', () => {
    console.warn('Security: PrintScreen blocked.');
  });

  // Block Ctrl+Shift+I, F12, and other direct piracy shortcuts
  win.webContents.on('before-input-event', (event, input) => {
    const forbiddenKeys = ['f12', 'printscreen'];
    const forbiddenCombos = [
      (input.control && input.shift && input.key.toLowerCase() === 'i'),
      (input.meta && input.key.toLowerCase() === 'g'), // Win+G
      (input.alt && input.key.toLowerCase() === 'f9'), // Alt+F9 (Nvidia)
      (input.control && input.key.toLowerCase() === 'p'), // Print
    ];

    if (forbiddenKeys.includes(input.key.toLowerCase()) || forbiddenCombos.some(c => c)) {
      event.preventDefault();
      console.warn(`Security: Keyboard input ${input.key} blocked.`);
    }
  });

  // Periodic Security Scan (Responsive Guard)
  const scannerInterval = setInterval(async () => {
    const isRecording = recorderDetect ? recorderDetect.isRecordingActive() : await isRecordingActiveJS();
    const isDebugger = recorderDetect ? recorderDetect.isDebuggerAttached() : isDebuggerAttachedJS();

    if (isRecording || isDebugger) {
      console.warn(`Background scan: violation detected (Rec: ${isRecording}, DBG: ${isDebugger})`);
      win.webContents.send('recording-status', { isRecording: true });
    } else {
      // Send clear status to allow UI recovery
      win.webContents.send('recording-status', { isRecording: false });
    }
  }, 3000);

  // Stop scanner when window closed
  win.on('closed', () => clearInterval(scannerInterval));

  if (isDev) {
    // In dev mode, we point to the Vite server (Update port if needed)
    win.loadURL('http://localhost:5175');
  } else {
    // In production (the .exe), we load the built index.html from the dist folder
    // Since main.cjs is at the root and files under dist are also at the root (flattened by electron-builder in some cases),
    // but usually dist folder structure is maintained. 
    // Given the 'files' glob in package.json (dist/**/*), index.html is likely at dist/index.html.
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    win.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
    });
  }

  // IPC Handlers for security
  // IPC Handlers for security
  ipcMain.handle('set-protection', (event, enabled) => {
    console.log(`Setting window protection: ${enabled}`);
    
    // On Linux, native window display affinity is not currently supported
    if (process.platform === 'linux') {
      return true;
    }

    if (recorderDetect) {
      try {
        const buffer = win.getNativeWindowHandle();
        let hwndBigInt = BigInt(0);
        
        if (buffer.length >= 8) {
          hwndBigInt = buffer.readBigInt64LE(0);
        } else if (buffer.length >= 4) {
          hwndBigInt = BigInt(buffer.readUInt32LE(0));
        }

        const result = recorderDetect.protectWindow(hwndBigInt);
        console.log(`Protection result: ${result}`);
        return result;
      } catch (e) {
        console.error('Failed to set window protection:', e.message);
      }
    }
    console.warn('Native module not loaded, cannot set protection.');
    return false;
  });


  ipcMain.handle('check-recorders', async () => {
    if (recorderDetect) {
      const isActive = recorderDetect.isRecordingActive();
      if (isActive) {
        console.warn('SCREEN RECORDER DETECTED!');
        win.webContents.send('recording-status', { isRecording: true });
      }
      return isActive;
    }
    // Fallback
    const isJSActive = await isRecordingActiveJS();
    if (isJSActive) win.webContents.send('recording-status', { isRecording: true });
    return isJSActive;
  });

  // --- Missing Handlers ---
  ipcMain.handle('get-license-status', () => verifyLicense());
  ipcMain.handle('get-hardware-id', () => {
    return recorderDetect ? recorderDetect.getHardwareID() : "NATIVE_SECURITY_MODULE_FAILURE_PLEASE_REBUILD";
  });

  ipcMain.on('exit-app', () => {
    app.quit();
  });

  console.log('--- LMS Security Heartbeat: ACTIVE ---');
}

app.whenReady().then(async () => {
  // --- Secure Stream Protocol ---
  let lastSecurityCheck = 0;
  let cachedSecurityResult = false;
  const validatedKeySessions = new Map();

  protocol.handle('lms-secure', async (request) => {
    // 1. Extract subPath while preserving directory hierarchy
    const subPath = decodeURIComponent(request.url.replace('lms-secure://', ''));
    const assetPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'encrypted', subPath) 
      : path.join(__dirname, 'resources/encrypted', subPath);
    
    const rangeHeader = request.headers.get('range') || 'NONE';
    console.log(`📡 SECURE REQUEST: [${subPath}] | Range: ${rangeHeader}`);

    // 2. Mandatory Real-time Guard Check (Recorder + License)
    const now = Date.now();
    if (now - lastSecurityCheck > 2000) {
        lastSecurityCheck = now;
        cachedSecurityResult = recorderDetect ? recorderDetect.isRecordingActive() : await isRecordingActiveJS();
        if (cachedSecurityResult) {
            console.error('SECURE PROTOCOL HALTED: Screen recorder detected during playback.');
        }
    }
    
    if (cachedSecurityResult) {
      return new Response('Security Violation: Content Protection Active', { status: 403 });
    }
    
    const licenseStatus = verifyLicense();
    if (!licenseStatus.valid) {
      console.error('SECURE PROTOCOL BLOCKED: License status:', licenseStatus.reason);
      return new Response('Unauthorized: Invalid License', { status: 401 });
    }

    try {
      const stats = fs.statSync(assetPath);
      const fileSize = stats.size;
      const rangeHeader = request.headers.get('range');
      
      let start = 0;
      let end = fileSize - 1;
      let isPartial = false;

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        isPartial = true;
      }

      if (start >= fileSize) return new Response('Range Not Satisfiable', { status: 416 });
      if (end >= fileSize) end = fileSize - 1;

      const totalResponseLength = (end - start) + 1;
      
      // Probing session key (Required for MP4 metadata validation)
      let workingKey = validatedKeySessions.get(subPath);
      if (!workingKey) {
        const licenseKey = getDecryptedMasterKey();
        const fallbackPath = app.isPackaged
          ? path.join(process.resourcesPath, 'tools/master_key.txt')
          : path.join(__dirname, 'tools/master_key.txt');
        let fallbackKey = null;
        if (fs.existsSync(fallbackPath)) {
          fallbackKey = Buffer.from(fs.readFileSync(fallbackPath, 'utf8').trim(), 'hex');
        }
        const candidateKeys = [licenseKey, fallbackKey].filter(k => k !== null);
        
        // Probe first 128 bytes of the file for the MP4 header
        const probeFd = fs.openSync(assetPath, 'r');
        const probeBuffer = Buffer.alloc(Math.min(fileSize, 128));
        fs.readSync(probeFd, probeBuffer, 0, probeBuffer.length, 0);
        fs.closeSync(probeFd);

        for (const key of candidateKeys) {
          const testBuffer = Buffer.from(probeBuffer); // Copy to avoid multiple decryption on same buffer
          if (recorderDetect) {
            recorderDetect.decryptChunk(testBuffer, 0, key);
          } else {
            decryptChunkJS(testBuffer, 0, key);
          }

          if (testBuffer.toString('ascii', 4, 12).includes('ftyp')) {
            console.log('✅ SECURE STREAM: Key VALIDATED for session:', subPath);
            validatedKeySessions.set(subPath, key);
            workingKey = key;
            
            // DIAGNOSTICS: Verify the decrypted signature
            const decryptedHex = testBuffer.slice(0, 16).toString('hex').toUpperCase();
            console.log(`🕵️ DIAGNOSTIC: Decrypted MP4 Prefix: ${decryptedHex}`);
            break;
          }
        }
        if (!workingKey) workingKey = candidateKeys[0]; // Fallback to avoid complete failure
      }

      // --- CREATE NATIVE READABLE STREAM ---
      const streamFd = fs.openSync(assetPath, 'r');
      let bytesRead = 0;
      const CHUNK_SIZE = 64 * 1024; // 64KB chunks for optimal streaming

      const readableStream = new ReadableStream({
        async pull(controller) {
          const currentOffset = start + bytesRead;
          const remaining = totalResponseLength - bytesRead;

          if (remaining <= 0) {
            fs.closeSync(streamFd);
            controller.close();
            return;
          }

          const toRead = Math.min(CHUNK_SIZE, remaining);
          const buffer = Buffer.alloc(toRead);
          const readCount = fs.readSync(streamFd, buffer, 0, toRead, currentOffset);

          if (readCount === 0) {
            fs.closeSync(streamFd);
            controller.close();
            return;
          }

          // Decrypt this chunk on-the-fly
          if (recorderDetect) {
            recorderDetect.decryptChunk(buffer, currentOffset, workingKey);
          } else {
            decryptChunkJS(buffer, currentOffset, workingKey);
          }

          controller.enqueue(buffer);
          bytesRead += readCount;
        },
        cancel() {
          try { fs.closeSync(streamFd); } catch (e) {}
        }
      });

      return new Response(readableStream, {
        status: isPartial ? 206 : 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': totalResponseLength.toString(),
          'Accept-Ranges': 'bytes',
          ...(isPartial && { 'Content-Range': `bytes ${start}-${end}/${fileSize}` }),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff'
        }
      });

    } catch (e) {
      console.error('SECURE PROTOCOL ERROR:', e);
      return new Response('Error loading content', { status: 500 });
    }
  });

  const startupSecurity = await performPanicCheck();
  if (!startupSecurity.valid) {
    // Show a minimal alert and exit if something is wrong before launch
    createWindow(); // This will immediately trigger the lockout screen in the UI
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
