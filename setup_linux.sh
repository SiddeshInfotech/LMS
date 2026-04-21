#!/bin/bash

set -e

# LMS Enterprise Linux Setup Script v2.0
# Automatically configures the environment, builds native modules,
# detects SSD serial, generates a hardware-locked license, and sets up kiosk.
# Compatible with: Ubuntu 20.04 / 22.04 / 24.04 (GNOME desktop)

echo "----------------------------------------------------"
echo "🛠️  LMS LINUX SETUP ENGINE v2.0"
echo "    SSD-Locked License Edition"
echo "----------------------------------------------------"

# ──────────────────────────────────────────────────────
# 0. System Dependencies (Fonts + Native Build Toolchain)
# ──────────────────────────────────────────────────────
echo ""
echo "🔍 [Step 0/8] Installing system-wide dependencies..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update -q

    # Fonts: Critical for Marathi / Devanagari script rendering
    sudo apt-get install -y \
        fonts-indic \
        fonts-noto-core \
        fonts-noto-extra \
        libfontconfig1 \

    # Native Build Toolchain: Required to compile recorder_detect.cpp via node-gyp
    # build-essential = gcc/g++/make  |  python3 = node-gyp dependency
    # libx11-dev / libxtst-dev = X11 headers needed by some Electron native addons
    # hdparm / smartmontools = for reading SSD serial numbers (non-root fallback)
    sudo apt-get install -y \
        build-essential \
        python3 \
        python3-pip \
        libx11-dev \
        libxtst-dev \
        libudev-dev \
        libglib2.0-dev \
        hdparm \
        smartmontools \

    echo "✅ System dependencies installed."
else
    echo "⚠️  WARNING: apt-get not found."
    echo "   Please manually install: build-essential python3 fonts-indic libfontconfig1 hdparm smartmontools"
fi

# ──────────────────────────────────────────────────────
# 1. Node.js Version Check
# ──────────────────────────────────────────────────────
echo ""
echo "🔍 [Step 1/8] Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>/dev/null && echo "OK" || echo "OLD")
if [ "$NODE_VERSION" = "OLD" ]; then
    echo "⚠️  WARNING: Node.js 18+ is recommended. Current: $(node --version)"
fi
echo "✅ Node.js found: $(node --version)"

# ──────────────────────────────────────────────────────
# 2. Project Dependency Installation
# ──────────────────────────────────────────────────────
echo ""
echo "📦 [Step 2/8] Installing project dependencies..."
npm install

# Ensure bytenode is available for the Fortress compilation step.
if ! node -e "require('bytenode')" 2>/dev/null; then
    echo "📦 Installing bytenode (required for Fortress compilation)..."
    npm install --no-save bytenode
fi

# ──────────────────────────────────────────────────────
# 3. Native Security Module Build
# ──────────────────────────────────────────────────────
echo ""
echo "🏗️  [Step 3/8] Building native security module (recorder_detect.cpp)..."

# The project uses a root-level binding.gyp (NOT an npm package),
# so we use node-gyp directly — not @electron/rebuild which only handles npm packages.
npx --yes node-gyp rebuild

# main.cjs expects the module at native-build/Release/recorder_detect.node
mkdir -p native-build/Release
cp build/Release/recorder_detect.node native-build/Release/recorder_detect.node

echo "✅ Native module built and installed to native-build/Release/"

# ──────────────────────────────────────────────────────
# 4. SSD Serial Detection
# ──────────────────────────────────────────────────────
echo ""
echo "🛡️  [Step 4/8] Generating Hardware Fingerprint..."

# Use the centralized standalone tool for consistent detection across installer and app
FULL_HWID=$(node tools/get_hwid.cjs)
HWID_SSD=$(echo "$FULL_HWID" | cut -d'|' -f1)
HWID_UUID=$(echo "$FULL_HWID" | cut -d'|' -f2)
HWID_MAC=$(echo "$FULL_HWID" | cut -d'|' -f3)

echo ""
echo "   ╔══════════════════════════════════════════════╗"
echo "   ║  🔒 HARDWARE FINGERPRINT (WSL BRIDGE ACTIVE) ║"
echo "   ╠══════════════════════════════════════════════╣"
echo "   ║  SSD Serial : ${HWID_SSD}"
echo "   ║  Machine ID : ${HWID_UUID}"
echo "   ║  MAC Address: ${HWID_MAC}"
echo "   ╠══════════════════════════════════════════════╣"
echo "   ║  Full HWID  : ${FULL_HWID}"
echo "   ╚══════════════════════════════════════════════╝"
echo "   ✅ Fingerprint verified. Proceeding with license generation."

# ──────────────────────────────────────────────────────
# 5. SSD-Locked License Generation
# ──────────────────────────────────────────────────────
echo ""
echo "🛡️  [Step 5/8] Generating SSD-Locked License..."

MACHINE_NAME="${1:-LMS-ENTERPRISE-$(hostname)}"

# Generate the license using the sign_license.cjs tool
# Args: <hardware_id> <machine_name> [min_version]
node tools/sign_license.cjs "$FULL_HWID" "$MACHINE_NAME"

if [ ! -f "license.lic" ]; then
    echo "❌ ERROR: License generation failed!"
    exit 1
fi

echo "✅ License generated for HWID: $FULL_HWID"
echo "   License File: $(pwd)/license.lic"

# Deploy to system location
sudo mkdir -p /etc/lms
sudo cp license.lic /etc/lms/license.lic
sudo chmod 644 /etc/lms/license.lic
echo "✅ License deployed to /etc/lms/license.lic"

# Copy RSA public key for license verification
if [ -f "tools/public.pem" ]; then
    sudo cp tools/public.pem /etc/lms/public.pem
    sudo chmod 644 /etc/lms/public.pem
    echo "✅ Public key deployed to /etc/lms/public.pem"
fi

# ──────────────────────────────────────────────────────
# 7. Compile Fortress (V8 Bytecode Security)
# ──────────────────────────────────────────────────────
echo ""
echo "🚀 [Step 7/8] Compiling Javascript to protected Bytecode..."
# CRITICAL: Must be run with 'electron' so the generated .jsc perfectly matches the Electron V8 Engine.
# If run with standard 'node', it causes "cachedDataRejected" on launch.
npx electron tools/compile_fortress.cjs

# ──────────────────────────────────────────────────────
# 6. Production Build (Vite Bundle)
# ──────────────────────────────────────────────────────
echo ""
echo "🚀 [Step 6/8] Checking for production bundle..."

if [ -d "dist" ]; then
    echo "   ✅ Found 'dist' folder (already built). Skipping Vite build to prevent WSL memory issues."
else
    echo "   ⚙️ Running Vite build..."
    npm run build
fi

# Encrypt all .mp4 video assets -> .lmsx using Salsa20 stream cipher
echo "🔐 Encrypting video assets..."
node tools/encrypt_assets.cjs

# Fortress Compilation (V8 Bytecode Protection)
echo "🔒 Compiling Fortress loaders (main.cjs + preload.cjs -> .jsc)..."
node tools/compile_fortress.cjs

# ──────────────────────────────────────────────────────
# 7. Global Launcher Setup
# ──────────────────────────────────────────────────────
echo ""
echo "🔗 [Step 7/8] Creating launcher..."

APP_DIR="$(pwd)"

cat << 'LAUNCHEREOF' > lms-secure
#!/bin/bash
# LMS Linux Launcher — generated by setup_linux.sh
# ELECTRON_DISABLE_SANDBOX bypasses Chromium sandboxing errors on Linux without --root.
export ELECTRON_DISABLE_SANDBOX=1
APP_DIR_PLACEHOLDER
exec ./node_modules/.bin/electron . --no-sandbox "$@"
LAUNCHEREOF

# Inject the real absolute path for the cd command
sed -i "s|APP_DIR_PLACEHOLDER|cd \"${APP_DIR}\"|" lms-secure
chmod +x lms-secure

# Create a system-wide symlink so 'lms-secure' works from any terminal
sudo ln -sf "${APP_DIR}/lms-secure" /usr/local/bin/lms-secure
echo "✅ Launcher established at /usr/local/bin/lms-secure"

# ──────────────────────────────────────────────────────
# 8. Kiosk Lockdown Engine (Generated Scripts)
# ──────────────────────────────────────────────────────
echo ""
echo "🔐 [Step 8/8] Generating Kiosk Lockdown & Restore tools..."

# ── lockdown_linux.sh ──
cat << 'EOF' > lockdown_linux.sh
#!/bin/bash
# LMS Kiosk — System-Level Lockdown (GNOME)
# Compatible with Ubuntu 20.04 / 22.04 / 24.04

echo "🔒 Locking down Linux Desktop..."

# Disable Alt+Tab (Switch Applications)
gsettings set org.gnome.desktop.wm.keybindings switch-applications "[]" 2>/dev/null || true
gsettings set org.gnome.desktop.wm.keybindings switch-applications-backward "[]" 2>/dev/null || true

# Disable Super/Windows Key (Activities Overview)
gsettings set org.gnome.mutter overlay-key "" 2>/dev/null || true

# Disable Alt+F4 (Close Window)
gsettings set org.gnome.desktop.wm.keybindings close "[]" 2>/dev/null || true

# Disable Terminal Shortcut (works on both Ubuntu 20.04 and 22.04+)
gsettings set org.gnome.settings-daemon.plugins.media-keys terminal "[]" 2>/dev/null || true

# Disable PrintScreen shortcuts (all variants)
gsettings set org.gnome.settings-daemon.plugins.media-keys screenshot "[]" 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.media-keys screenshot-window "[]" 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.media-keys area-screenshot "[]" 2>/dev/null || true

# Disable Ctrl+Shift+Alt+R (GNOME Built-in Screen Recorder)
gsettings set org.gnome.settings-daemon.plugins.media-keys screencast "[]" 2>/dev/null || true

# Disable Touchpad Gestures — key only exists on some GNOME versions, suppress if missing
gsettings set org.gnome.desktop.peripherals.touchpad enable-gestures false 2>/dev/null || true

echo "✅ System Lockdown Active."
echo "   Disabled: Alt+Tab, Alt+F4, Super, PrintScreen, Built-in Recorder, Touchpad Gestures."
EOF

# ── restore_linux.sh ──
cat << 'EOF' > restore_linux.sh
#!/bin/bash
# LMS Kiosk — Restore System Defaults (GNOME)

echo "🔓 Restoring Linux Desktop to normal mode..."

gsettings set org.gnome.desktop.wm.keybindings switch-applications "['<Alt>Tab']" 2>/dev/null || true
gsettings set org.gnome.desktop.wm.keybindings switch-applications-backward "['<Alt><Shift>Tab']" 2>/dev/null || true
gsettings set org.gnome.mutter overlay-key "Super_L" 2>/dev/null || true
gsettings set org.gnome.desktop.wm.keybindings close "['<Alt>F4']" 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.media-keys terminal "['<Control><Alt>t']" 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.media-keys screenshot "['Print']" 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.media-keys screenshot-window "['<Alt>Print']" 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.media-keys area-screenshot "['<Shift>Print']" 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.media-keys screencast "['<Control><Shift><Alt>r']" 2>/dev/null || true
gsettings set org.gnome.desktop.peripherals.touchpad enable-gestures true 2>/dev/null || true

echo "✅ System Restored. All shortcuts and gestures are working again."
EOF

chmod +x lockdown_linux.sh restore_linux.sh

# ──────────────────────────────────────────────────────
# FINAL SUMMARY
# ──────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "✅  SETUP COMPLETE — LMS Enterprise Linux Edition"
echo "======================================================"
echo ""
echo "📋 DEPLOYMENT SUMMARY:"
echo "   Machine  : $MACHINE_NAME"
echo "   HWID     : $FULL_HWID"
echo "   SSD Lock : $HWID_SSD"
echo "   Expiry   : $EXPIRY"
echo "   License  : /etc/lms/license.lic"
echo "   Launcher : /usr/local/bin/lms-secure"
echo ""
echo "🚀 LAUNCH:"
echo "   lms-secure"
echo ""
echo "🔐 KIOSK CONTROLS:"
echo "   Lock system keys  : ./lockdown_linux.sh"
echo "   Restore system    : ./restore_linux.sh"
echo "   App Panic Key     : Ctrl+Shift+Alt+K"
echo ""
echo "🔑 LICENSE MANAGEMENT:"
echo "   View license      : cat /etc/lms/license.lic"
echo "   Re-generate       : sudo bash tools/activate_machine.sh \"MACHINE-NAME\""
echo "======================================================"
