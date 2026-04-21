#!/bin/bash

# =================================================================
# LMS Remote License Generator
# -----------------------------------------------------------------
# Run this on the TARGET Linux machine FIRST to collect the HWID,
# then paste the HWID here on the DEV machine to generate a license.
#
# WORKFLOW:
#   [On target Linux machine]
#     node tools/get_hwid.cjs   (after building native module)
#     -- OR --
#     cat /etc/machine-id        (for UUID-only fallback)
#
#   [On dev machine (Windows/Linux with private.pem)]
#     bash tools/gen_ssd_license.sh "<HWID>" "<MACHINE_NAME>"
#     e.g. bash tools/gen_ssd_license.sh "SAMSUNG_SSD_S5YUNX0T|abc123|AA:BB:CC:DD:EE:FF" "Lab-PC-01"
#
# =================================================================

FULL_HWID="${1}"
MACHINE_NAME="${2:-LMS-Enterprise}"
EXPIRY="${3:-2030-01-01}"

if [ -z "$FULL_HWID" ]; then
    echo "======================================================"
    echo "  ❌ Usage: bash tools/gen_ssd_license.sh <HWID> [MACHINE_NAME] [EXPIRY]"
    echo ""
    echo "  Example:"
    echo "    bash tools/gen_ssd_license.sh \"S5YUNX0T|a1b2c3d4|AA:BB:CC:DD:EE:FF\" \"Lab-PC-01\""
    echo ""
    echo "  To get the HWID from the target Linux machine, run:"
    echo "    node tools/get_hwid.cjs"
    echo "    -- or --"
    echo "    bash tools/activate_machine.sh   (auto-generates + deploys)"
    echo "======================================================"
    exit 1
fi

echo "======================================================"
echo "  🔑 LMS Remote License Generator"
echo "======================================================"
echo "  HWID    : $FULL_HWID"
echo "  Machine : $MACHINE_NAME"
echo "  Expiry  : $EXPIRY"
echo ""

# Validate that sign_license.cjs is accessible
if [ ! -f "tools/sign_license.cjs" ]; then
    echo "❌ ERROR: tools/sign_license.cjs not found."
    echo "   Run this script from the project root directory."
    exit 1
fi

# Validate that private.pem is accessible
if [ ! -f "tools/private.pem" ]; then
    echo "❌ ERROR: tools/private.pem not found."
    echo "   The RSA private key is required to sign the license."
    exit 1
fi

# Generate the license
node tools/sign_license.cjs "$FULL_HWID" "$EXPIRY" "$MACHINE_NAME"

if [ -f "license.lic" ]; then
    echo ""
    echo "======================================================"
    echo "✅ License generated: license.lic"
    echo ""
    echo "📋 License Contents:"
    cat license.lic
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Copy license.lic to the target Linux machine"
    echo "   2. Run: sudo mkdir -p /etc/lms && sudo cp license.lic /etc/lms/license.lic"
    echo "   3. Copy tools/public.pem too:"
    echo "      sudo cp tools/public.pem /etc/lms/public.pem"
    echo "   4. Launch: lms-secure"
    echo "======================================================"
else
    echo "❌ ERROR: License generation failed!"
    exit 1
fi
