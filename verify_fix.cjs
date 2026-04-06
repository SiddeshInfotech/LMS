const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Mock for Electron app and recorderDetect
const app = {
    isReady: () => true,
    getPath: (name) => __dirname,
    isPackaged: false,
    getVersion: () => "1.0.0"
};

const recorderDetect = {
    getHardwareID: () => "5CD2_E436_11C0_B8AA.|d0d9bc90-d3b9-4fac-a0eb-92167f752921|00:15:5D:C0:66:C4"
};

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) return 1;
        if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
}

// Re-implement verifyLicense as it is in main.cjs for testing
function testVerifyLicense() {
  const getLicensePath = () => {
    return path.join(__dirname, 'license.lic');
  };

  const licensePath = getLicensePath();
  if (!fs.existsSync(licensePath)) return { valid: false, reason: 'MISSING' };

  try {
    const publicKey = fs.readFileSync(path.join(__dirname, 'tools/public.pem'), 'utf8');
    const licenseJson = fs.readFileSync(licensePath, 'utf8');
    const license = JSON.parse(licenseJson);
    const signature = license.signature;
    delete license.signature;

    const verifier = crypto.createVerify('sha256');
    verifier.update(JSON.stringify(license));
    const isValid = verifier.verify(publicKey, signature, 'base64');

    if (!isValid) return { valid: false, reason: 'TAMPERED' };

    const currentHwid = recorderDetect.getHardwareID();
    if (license.hardware_id !== currentHwid) return { valid: false, reason: 'HARDWARE_MISMATCH' };

    if (new Date(license.expiry) < new Date()) return { valid: false, reason: 'EXPIRED', expiry: license.expiry };

    const currentVersion = app.getVersion();
    const minVersion = license.min_app_version || "1.0.0";
    
    if (compareVersions(currentVersion, minVersion) < 0) {
      return { valid: false, reason: 'VERSION_OUTDATED' };
    }

    return { valid: true, reason: 'VALID', expiry: license.expiry };
  } catch (e) {
    return { valid: false, reason: 'TAMPERED', error: e.message };
  }
}

console.log('Verification Result:', testVerifyLicense());
