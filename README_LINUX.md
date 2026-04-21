# Linux Deployment Guide for LMS (Enterprise v3.0)

This guide explains how to build and run the Secure LMS on Linux (Ubuntu/Debian).

## Prerequisites

1.  **Node.js**: Ensure you have Node.js 18+ installed.
2.  **Git**: For cloning the repository.
3.  **Security Files**: You **must** manually copy the following from Windows to the `tools/` folder on Linux:
    - `tools/master_key.txt` (Critical for decryption)
    - `tools/public.pem` (Critical for license verification)

---

## 1. Automated Setup

Run the optimized setup script to handle dependencies, build the native security layer, and configure the system.

```bash
# 1. Give permission
chmod +x setup_linux.sh

# 2. Run setup (will ask for sudo for /usr/local/bin and /etc/lms)
./setup_linux.sh
```

---

## 2. Licensing (Strict HWID + SSD Priority)

Linux requires a unique license bound to your machine. 

1.  **Find HWID**: Run `node tools/get_hwid.cjs` or simply start the app.
2.  **Generate**: on Windows, run `node tools/sign_license.cjs "YOUR_LINUX_HWID" "2027-01-01"`
3.  **Place**: Copy `license.lic` to the project root OR `/etc/lms/license.lic`.

---

## 3. Launching

You can now launch the app using the enterprise command:

```bash
# Global command (if setup symlink succeeded)
lms-secure

# Local wrapper
./lms-secure
```

---

## Sync Checklist (Windows -> Linux)

When updating your environment, ensure these files are synced from Windows:
- `main.cjs` (License verification logic)
- `setup_linux.sh` (Dependency & Launcher logic)
- `license.lic` (The active license)
- `tools/public.pem` (Must match the one used to sign the license)

---

## Troubleshooting

- **"Tampered" or "Hardware Mismatch"**: Your `license.lic` was manually edited or doesn't match this machine's HWID. Re-sign the license using `tools/sign_license.cjs`.
- **"GLIBC" error**: We recommend Ubuntu 22.04 LTS or 24.04 LTS.
- **Log Files**: Check `~/.config/ai-and-mechatronix-lab/LMS_PRODUCTION_DEBUG.log` for detailed diagnostics.
