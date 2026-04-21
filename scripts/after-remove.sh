#!/bin/bash

# Siddesh Global LMS - Post Removal Script
# This script runs after the .deb package is removed

ACTION=$1

if [ "$ACTION" = "purge" ] || [ "$ACTION" = "remove" ]; then
    echo "🛡️ Cleaning up LMS Secure data..."

    # 1. Remove the system-wide hardware anchor
    if [ -d "/etc/lms" ]; then
        rm -rf /etc/lms
        echo "   - Removed /etc/lms (Hardware Anchors deleted)"
    fi

    # 2. Cleanup global symlink
    if [ -f "/usr/local/bin/lms-secure" ]; then
        rm -f "/usr/local/bin/lms-secure"
        echo "   - Removed global link: lms-secure"
    fi

    echo "✅ Cleanup complete. All security anchors have been wiped."
fi
