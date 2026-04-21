#!/bin/bash

# Siddesh Global LMS - Post Installation Script
# This script runs as root after the .deb package is installed

echo "🛡️ Configuring LMS Secure Security Engine..."

# 1. Create the system-wide hardware anchor directory
if [ ! -d "/etc/lms" ]; then
    mkdir -p /etc/lms
    echo "   - Created /etc/lms"
fi

# 2. Set permissive permissions for the hardware anchor
# This allows the app's security engine to write the 'machine.lock' file
chmod 777 /etc/lms
echo "   - Set permissions for /etc/lms to 777"

# 3. FIX: SUID Sandbox Permissions
# Chromium requires the sandbox helper to be owned by root with 4755 permissions
if [ -f "/opt/LMS/chrome-sandbox" ]; then
    chown root:root /opt/LMS/chrome-sandbox
    chmod 4755 /opt/LMS/chrome-sandbox
    echo "   - Configured SUID Sandbox permissions (4755)"
fi

# 4. Create a symlink to ensure the app is in the global path if not already
if [ ! -f "/usr/local/bin/lms-secure" ]; then
    ln -sf "/opt/LMS/lms-secure" "/usr/local/bin/lms-secure"
    echo "   - Created system-wide link: lms-secure"
fi

echo "✅ Security Engine configuration complete."
