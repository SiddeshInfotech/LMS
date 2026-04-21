#!/bin/bash

# --- LMS Fortress Activation Utility ---
# This script automates the Hardware Locking process for fresh .deb installations.

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛡️  LMS Security & Activation Utility${NC}"
echo "------------------------------------------"

# 1. Root Check
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Error: Please run as root (sudo ./activate.sh)${NC}"
  exit 1
fi

# 2. Identify Action
ACTION=$1

if [ "$ACTION" == "--get-id" ]; then
    echo -e "${BLUE}🔍 Scanning Hardware for Unique Fingerprint...${NC}"
    # Find the binary resources path
    RESOURCE_PATH="/opt/LMS/resources"
    if [ ! -d "$RESOURCE_PATH" ]; then
        # Fallback to current directory for dev testing
        RESOURCE_PATH="."
    fi

    HWID=$(node "$RESOURCE_PATH/tools/get_hwid.cjs" 2>/dev/null)
    if [ -z "$HWID" ]; then
        echo -e "${RED}Error: Could not capture Hardware ID. Ensure Node.js is installed.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ System Fingerprint Captured:${NC}"
    echo -e "\n${BLUE}------------------------------------------------------------${NC}"
    echo -e "  $HWID"
    echo -e "${BLUE}------------------------------------------------------------${NC}\n"
    echo "Please provide this ID to your LMS Administrator to receive your license.lic"
    exit 0

elif [ "$ACTION" == "--apply" ]; then
    LICENSE_SRC=$2
    if [ -z "$LICENSE_SRC" ] || [ ! -f "$LICENSE_SRC" ]; then
        echo -e "${RED}Error: Please provide the path to your license.lic file.${NC}"
        echo "Usage: sudo ./activate.sh --apply ./path/to/license.lic"
        exit 1
    fi

    echo -e "${BLUE}🔒 Applying Global Security Lock...${NC}"
    
    # Create Global Vault
    mkdir -p /etc/lms
    
    # Copy License
    cp "$LICENSE_SRC" /etc/lms/license.lic
    chmod 644 /etc/lms/license.lic
    
    # Fix Native Permissions
    RESOURCE_PATH="/opt/LMS/resources"
    if [ -f "$RESOURCE_PATH/recorder_detect.node" ]; then
        chmod +x "$RESOURCE_PATH/recorder_detect.node"
    fi

    echo -e "${GREEN}✅ Hardware Activation Successful!${NC}"
    echo "You can now launch the LMS application."
    exit 0

else
    echo "Usage:"
    echo "  sudo ./activate.sh --get-id         (Get the Hardware ID of this machine)"
    echo "  sudo ./activate.sh --apply [FILE]   (Install a license.lic for this machine)"
    exit 1
fi
