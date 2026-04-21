#!/bin/bash

# =================================================================
# LMS "One-Touch" SSD-Locked Activator Script (Linux)
# -----------------------------------------------------------------
# IMPORTANT: SSD serial is MANDATORY. If no SSD serial is detected,
# this script will ABORT. UUID-based locking is NOT permitted.
#
# Usage: cd /path/to/lms && sudo bash tools/activate_machine.sh "MACHINE-NAME"
# =================================================================

MACHINE_NAME=${1:-"LMS-STATION-$(hostname)"}
EXPIRY="2030-01-01"

echo "----------------------------------------------------"
echo "🛡️  LMS ENTERPRISE SSD-LOCKED ACTIVATOR"
echo "----------------------------------------------------"
echo "   Machine: $MACHINE_NAME"
echo "   Expiry : $EXPIRY"
echo ""

# ── Step 1: Detect SSD Serial (MANDATORY) ──────────────
echo "🔍 Detecting SSD serial number (mandatory)..."
SSD_SERIAL=""

# ── Detect if running inside WSL ──────────────────────
IS_WSL=false
if grep -qiE "microsoft|wsl" /proc/version 2>/dev/null || [ -n "$WSL_DISTRO_NAME" ]; then
    IS_WSL=true
    echo "   ℹ️  WSL environment detected. Bridging to Windows host for SSD serial..."
fi

# Method 0: WSL Bridge — Windows wmic/PowerShell (WSL only)
if [ "$IS_WSL" = "true" ] && [ -z "$SSD_SERIAL" ]; then
    CANDIDATE=$(cmd.exe /c "wmic diskdrive get SerialNumber /format:value" 2>/dev/null \
        | grep -i "SerialNumber=" | head -1 \
        | cut -d= -f2 | tr -d '[:space:]\r\n')
    if [ -n "$CANDIDATE" ] && [ "$CANDIDATE" != "SerialNumber" ]; then
        SSD_SERIAL="$CANDIDATE"
        echo "   ✅ Found (WSL→wmic)      : $SSD_SERIAL"
    fi

    if [ -z "$SSD_SERIAL" ] && command -v powershell.exe &>/dev/null; then
        CANDIDATE=$(powershell.exe -NoProfile -Command \
            "Get-PhysicalDisk | Select-Object -First 1 -ExpandProperty SerialNumber" \
            2>/dev/null | tr -d '[:space:]\r\n')
        if [ -n "$CANDIDATE" ]; then
            SSD_SERIAL="$CANDIDATE"
            echo "   ✅ Found (WSL→PowerShell): $SSD_SERIAL"
        fi
    fi

    if [ -z "$SSD_SERIAL" ]; then
        CANDIDATE=$(cmd.exe /c "vol C:" 2>/dev/null \
            | grep -i "serial" | awk '{print $NF}' | tr -d '[:space:]\r\n-')
        if [ -n "$CANDIDATE" ]; then
            SSD_SERIAL="VOL-$CANDIDATE"
            echo "   ✅ Found (WSL→vol C:)    : $SSD_SERIAL  (Windows volume serial)"
        fi
    fi
fi

# Method 1: /sys/block — native Linux, no root needed
if [ -z "$SSD_SERIAL" ]; then
    for DEV_PATH in \
        /sys/block/nvme0n1/device/serial \
        /sys/block/nvme1n1/device/serial \
        /sys/block/sda/device/serial \
        /sys/block/sdb/device/serial \
        /sys/class/block/nvme0n1/device/serial \
        /sys/class/block/sda/device/serial; do
        if [ -f "$DEV_PATH" ]; then
            CANDIDATE=$(cat "$DEV_PATH" 2>/dev/null | tr -d '[:space:]')
            if [ -n "$CANDIDATE" ]; then
                SSD_SERIAL="$CANDIDATE"
                echo "   ✅ Found (sysfs) : $SSD_SERIAL  [$DEV_PATH]"
                break
            fi
        fi
    done
fi

# Method 2: hdparm (SATA drives, needs sudo)
if [ -z "$SSD_SERIAL" ] && command -v hdparm &> /dev/null; then
    for BLOCK_DEV in /dev/sda /dev/sdb /dev/sdc; do
        if [ -b "$BLOCK_DEV" ]; then
            CANDIDATE=$(sudo hdparm -I "$BLOCK_DEV" 2>/dev/null \
                | grep -i "serial number" | awk '{print $3}' | tr -d '[:space:]')
            if [ -n "$CANDIDATE" ]; then
                SSD_SERIAL="$CANDIDATE"
                echo "   ✅ Found (hdparm): $SSD_SERIAL  [$BLOCK_DEV]"
                break
            fi
        fi
    done
fi

# Method 3: smartctl (NVMe, needs sudo)
if [ -z "$SSD_SERIAL" ] && command -v smartctl &> /dev/null; then
    for BLOCK_DEV in /dev/nvme0 /dev/nvme1 /dev/sda /dev/sdb; do
        if [ -b "$BLOCK_DEV" ]; then
            CANDIDATE=$(sudo smartctl -i "$BLOCK_DEV" 2>/dev/null \
                | grep -i "serial number" | awk '{print $3}' | tr -d '[:space:]')
            if [ -n "$CANDIDATE" ]; then
                SSD_SERIAL="$CANDIDATE"
                echo "   ✅ Found (smartctl): $SSD_SERIAL  [$BLOCK_DEV]"
                break
            fi
        fi
    done
fi

# Method 4: udevadm
if [ -z "$SSD_SERIAL" ] && command -v udevadm &> /dev/null; then
    for BLOCK_DEV in /dev/nvme0n1 /dev/sda; do
        if [ -b "$BLOCK_DEV" ]; then
            CANDIDATE=$(udevadm info --query=all --name="$BLOCK_DEV" 2>/dev/null \
                | grep "ID_SERIAL=" | cut -d= -f2 | tr -d '[:space:]')
            if [ -n "$CANDIDATE" ]; then
                SSD_SERIAL="$CANDIDATE"
                echo "   ✅ Found (udevadm): $SSD_SERIAL  [$BLOCK_DEV]"
                break
            fi
        fi
    done
fi


# ── MANDATORY: Abort if SSD not found ─────────────────
if [ -z "$SSD_SERIAL" ]; then
    echo ""
    echo "   ╔══════════════════════════════════════════════╗"
    echo "   ║  ❌  SSD SERIAL NOT DETECTED — ABORTING      ║"
    echo "   ╠══════════════════════════════════════════════╣"
    echo "   ║  SSD locking is MANDATORY for this system.  ║"
    echo "   ║  UUID fallback is NOT acceptable.            ║"
    echo "   ╠══════════════════════════════════════════════╣"
    echo "   ║  FIX: Install tools and run with sudo:       ║"
    echo "   ║    sudo apt-get install hdparm smartmontools ║"
    echo "   ║    sudo bash tools/activate_machine.sh       ║"
    echo "   ╠══════════════════════════════════════════════╣"
    echo "   ║  Manual check:                               ║"
    echo "   ║    cat /sys/block/sda/device/serial          ║"
    echo "   ║    cat /sys/block/nvme0n1/device/serial      ║"
    echo "   ║    sudo hdparm -I /dev/sda | grep -i serial  ║"
    echo "   ╚══════════════════════════════════════════════╝"
    exit 1
fi

# ── Step 2: Machine UUID (supplementary, info only) ───
MACHINE_UUID=""
if [ -f "/etc/machine-id" ]; then
    MACHINE_UUID=$(cat /etc/machine-id | tr -d '[:space:]')
    echo "   ℹ️  Machine-ID  : $MACHINE_UUID  (supplementary)"
fi

# ── Step 3: MAC Address (supplementary, info only) ────
MAC_ADDR=""
for IFACE_PATH in /sys/class/net/*/address; do
    IFACE=$(dirname "$IFACE_PATH" | xargs basename)
    if [ "$IFACE" = "lo" ]; then continue; fi
    CANDIDATE=$(cat "$IFACE_PATH" 2>/dev/null | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')
    if [ -n "$CANDIDATE" ] && [ "$CANDIDATE" != "00:00:00:00:00:00" ]; then
        if [ -z "$MAC_ADDR" ] || [ "$CANDIDATE" \< "$MAC_ADDR" ]; then
            MAC_ADDR="$CANDIDATE"
        fi
    fi
done
if [ -n "$MAC_ADDR" ]; then
    echo "   ℹ️  MAC Address  : $MAC_ADDR  (supplementary)"
fi

# ── Step 4: Build Composite HWID ─────────────────────
# PRIMARY LOCK = SSD serial. UUID and MAC are stored but only
# used for display / logging. main.cjs verify() checks SSD only.
HWID_SSD="$SSD_SERIAL"
HWID_UUID="${MACHINE_UUID:-NOUUID}"
HWID_MAC="${MAC_ADDR:-NOMAC}"
FULL_HWID="${HWID_SSD}|${HWID_UUID}|${HWID_MAC}"

echo ""
echo "   ╔══════════════════════════════════════════════╗"
echo "   ║  🔒 SSD-LOCKED HARDWARE FINGERPRINT          ║"
echo "   ╠══════════════════════════════════════════════╣"
echo "   ║  SSD Serial : ${HWID_SSD}"
echo "   ║  Machine ID : ${HWID_UUID}  (info only)"
echo "   ║  MAC Address: ${HWID_MAC}  (info only)"
echo "   ╠══════════════════════════════════════════════╣"
echo "   ║  Full HWID  : ${FULL_HWID}"
echo "   ╚══════════════════════════════════════════════╝"
echo ""

# ── Step 5: Locate sign_license.cjs ──────────────────
if [ -f "tools/sign_license.cjs" ]; then
    SIGN_TOOL="tools/sign_license.cjs"
elif [ -f "sign_license.cjs" ]; then
    SIGN_TOOL="sign_license.cjs"
else
    echo "❌ ERROR: sign_license.cjs not found."
    echo "   Run this script from the project root: sudo bash tools/activate_machine.sh"
    exit 1
fi

# ── Step 6: Generate the SSD-Locked License ──────────
echo "🔐 Signing SSD-locked license..."
node "$SIGN_TOOL" "$FULL_HWID" "$EXPIRY" "$MACHINE_NAME"

if [ ! -f "license.lic" ]; then
    echo "❌ ERROR: License file was not generated!"
    exit 1
fi

echo "✅ License signed. SSD lock: $HWID_SSD"

# ── Step 7: Deploy to /etc/lms/ ──────────────────────
echo "📦 Deploying to /etc/lms/..."
sudo mkdir -p /etc/lms
sudo cp license.lic /etc/lms/license.lic
sudo chmod 644 /etc/lms/license.lic

# Deploy public key (needed for signature verification)
if [ -f "tools/public.pem" ]; then
    sudo cp tools/public.pem /etc/lms/public.pem
    sudo chmod 644 /etc/lms/public.pem
elif [ -f "public.pem" ]; then
    sudo cp public.pem /etc/lms/public.pem
    sudo chmod 644 /etc/lms/public.pem
fi

# ── Final Confirmation ────────────────────────────────
echo ""
echo "----------------------------------------------------"
echo "✅ SUCCESS: Machine activated with SSD lock!"
echo ""
echo "   Machine  : $MACHINE_NAME"
echo "   SSD Lock : $HWID_SSD   ← PRIMARY LOCK"
echo "   HWID     : $FULL_HWID"
echo "   Expiry   : $EXPIRY"
echo "   License  : /etc/lms/license.lic"
echo ""
echo "🚀 Launch: lms-secure"
echo "----------------------------------------------------"
