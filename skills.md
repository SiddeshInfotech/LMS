# LMS Enterprise Security Patterns

This document outlines the core architectural patterns used for the secure LMS deployment, ensuring hardware binding and content protection.

## 🛡️ 1. Hardware-Locked Licensing
The system uses a multi-stage hardware identification strategy to ensure licenses work across different Linux/Windows environments without manual intervention.

### Pattern: SSD-Priority Binding
- **Primary Match**: Disk Serial Number (extracted via native module).
- **Secondary Match**: System UUID (e.g., `/etc/machine-id` on Linux).
- **Format**: `SSD|UUID|MAC`

### Logic Implementation (`main.cjs`):
```javascript
const licenseParts = license.hardware_id.split('|');
const currentParts = currentHwid.split('|');

// 1. Check SSD (Serial)
if (licenseParts[0] !== "NOSSD" && currentParts[0] === licenseParts[0]) return true;

// 2. Fallback to UUID (System-wide ID)
if (licenseParts[1] === currentParts[1]) return true;
```

## 🔐 2. Production Security Handlers (IPC)
The renderer process communicates with the main process via standard IPC bridges to enforce content protection.

### core bridges:
1.  **`check-recorders`**: Scans for forbidden software (OBS, FFmpeg, screenshot tools).
2.  **`set-protection`**: Triggers `BrowserWindow.setContentProtection(true)`, which blocks OS-level screen capture and blackens the window for recording software.
3.  **`exit-app`**: Force-terminates the app during a security violation.

## 🏗️ 3. Linux Deployment Automation
Deployment on Linux (WSL2/Native) is handled via `setup_linux.sh` to ensure native modules and system permissions are correct.

### Key Deployment Steps:
- **Build**: Run `npm run rebuild` to compile `node-gyp` modules for the target Linux architecture.
- **Permissions**: Ensure `/etc/lms/` exists with read-access (`644`) for the license file.
- **Launcher**: symlink the executable to `/usr/local/bin/lms-secure` for global CLI access.

## 🖥️ 4. Dynamic Kiosk Lockdown
The application uses a 100% fullscreen kiosk mode with conditional keyboard blocking to prevent navigation outside of the course content.

### Pattern: Targeted Input Blocking
- **Initialization**: Launch with `kiosk: true`, `fullscreen: true`, and `frame: false`.
- **Conditional Blocking**: Intercept `before-input-event` on the `webContents` to sink all keyboard events.
- **Toggle Mechanism**: IPC signal `set-kiosk-lock` allows the renderer to enable/disable the keyboard (e.g., login vs course pages).

### Implementation Logic:
```javascript
win.webContents.on('before-input-event', (event, input) => {
    if (keyboardLocked && input.type === 'keyDown') {
        event.preventDefault(); // Deadlock the keyboard
    }
});
```
