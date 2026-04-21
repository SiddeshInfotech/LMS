const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * LMS OFFLINE BUNDLE PREPARATOR
 * This script gathers all required files into a single distribution folder
 * for direct "paste" installation on offline Linux systems.
 */

const BUNDLE_DIR = path.resolve('LMS_OFFLINE_BUNDLE');
const APP_DIR = path.join(BUNDLE_DIR, 'LMS_APP');
const SECURITY_DIR = path.join(BUNDLE_DIR, 'SECURITY_CORE');
const DEPS_DIR = path.join(BUNDLE_DIR, 'DEPENDENCIES');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function prepareBundle() {
    console.log('📦 Starting Offline Bundle Preparation...');

    // 1. Clean and Create Dirs
    if (fs.existsSync(BUNDLE_DIR)) {
        console.log('🧹 Cleaning old bundle...');
        fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
    }
    ensureDir(APP_DIR);
    ensureDir(SECURITY_DIR);
    ensureDir(DEPS_DIR);
    ensureDir(path.join(DEPS_DIR, 'FONTS'));

    // 2. Identify and Copy App Files
    // Note: We expect 'npm run package-linux' to have been run already
    const unpackedSource = path.resolve('dist_electron/linux-unpacked');
    if (fs.existsSync(unpackedSource)) {
        console.log('🚚 Copying Linux Unpacked binaries...');
        copyRecursive(unpackedSource, APP_DIR);
    } else {
        console.warn('⚠️ WARNING: dist_electron/linux-unpacked not found! Run npm run package-linux first.');
    }

    // 3. Copy Security Core
    const securityFiles = ['license.lic', 'tools/public.pem', 'lockdown_linux.sh', 'restore_linux.sh'];
    console.log('🛡️  Copying Security Core...');
    securityFiles.forEach(f => {
        const src = path.resolve(f);
        if (fs.existsSync(src)) {
            const dest = path.join(SECURITY_DIR, path.basename(f));
            fs.copyFileSync(src, dest);
        }
    });

    // 4. Create START_HERE.sh for the target machine
    const startScript = `#!/bin/bash
# LMS OFFLINE INSTALLER
set -e

echo "----------------------------------------------------"
echo "🚀 LMS OFFLINE SETUP ENGINE"
echo "----------------------------------------------------"

# 1. Install Fonts
echo "🔡 Installing Marathi & System Fonts..."
mkdir -p ~/.local/share/fonts
cp ./DEPENDENCIES/FONTS/*.ttf ~/.local/share/fonts/ 2>/dev/null || true
fc-cache -f -v > /dev/null
echo "✅ Fonts Installed."

# 2. Setup Security Core
echo "🛡️  Setting up Security Core..."
sudo mkdir -p /etc/lms
sudo cp ./SECURITY_CORE/license.lic /etc/lms/license.lic
sudo cp ./SECURITY_CORE/public.pem /etc/lms/public.pem
sudo chmod 644 /etc/lms/*
echo "✅ Security Files Configured."

# 3. System Library Integrity Check
echo "🔍 Checking for required system libraries..."
MISSING=0
LIBS=("libnss3.so" "libatk-1.0.so.0" "libasound.so.2" "libgbm.so.1")
for lib in "\${LIBS[@]}"; do
    if ldconfig -p | grep -q "$lib"; then
        echo "✅ Found $lib"
    else
        echo "❌ MISSING $lib"
        MISSING=1
    fi
done

if [ $MISSING -eq 1 ]; then
    echo "⚠️  WARNING: Some libraries are missing. See OFFLINE_DEP_GUIDE.txt in the DEPENDENCIES folder."
fi

# 4. Application Launcher
echo "🔗 Creating local launcher..."
chmod +x ./LMS_APP/ai-and-mechatronix-lab
chmod +x ./SECURITY_CORE/*.sh

echo "----------------------------------------------------"
echo "✅ OFFLINE SETUP COMPLETE"
echo "----------------------------------------------------"
echo "To LOCK system keys:   ./SECURITY_CORE/lockdown_linux.sh"
echo "To START the app:      ./LMS_APP/ai-and-mechatronix-lab --no-sandbox"
echo "To UNLOCK system:      ./SECURITY_CORE/restore_linux.sh"
echo "----------------------------------------------------"
`;
    fs.writeFileSync(path.join(BUNDLE_DIR, 'START_HERE.sh'), startScript);

    // 5. Create Dependency Documentation
    const depDoc = `LMS OFFLINE DEPENDENCY GUIDE
=============================

Since this system is OFFLINE, you cannot use 'apt install'. 
If the app fails to start with "libnss3.so" or "libasound.so" errors, 
you must manually download these .deb files on an ONLINE machine 
and transfer them here.

REQUIRED SYSTEM LIBRARIES (Ubuntu 24.04):
-----------------------------------------
1. libnss3
2. libatk1.0-0
3. libatk-bridge2.0-0
4. libcups2
5. libdrm2
6. libxcomposite1
7. libxdamage1
8. libxrandr2
9. libgbm1
10. libasound2
11. libxkbcommon0
12. libpango-1.0-0

OFFLINE FONTS INCLUDED:
-----------------------
1. Noto Sans Devanagari (Main Marathi)
2. Hind (Backup Marathi)
3. Inter (System UI)

HOW TO INSTALL MANUALLY:
sudo dpkg -i <filename>.deb
`;
    fs.writeFileSync(path.join(DEPS_DIR, 'OFFLINE_DEP_GUIDE.txt'), depDoc);

    console.log('-------------------------------------------');
    console.log('✅ Final Bundle Created: LMS_OFFLINE_BUNDLE');
    console.log('👉 Copy this entire folder to your USB.');
    console.log('-------------------------------------------');
}

function copyRecursive(src, dest) {
    if (fs.lstatSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

prepareBundle();
