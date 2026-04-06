const crypto = require('crypto');
const fs = require('fs');

const privateKey = fs.readFileSync('tools/private.pem', 'utf8');

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node tools/sign_license.cjs <hardware_id> <expiry_date> [min_app_version]');
    process.exit(1);
}

const hardwareId = args[0];
const expiry = args[1];
const minVersion = args[2] || "1.0.0";

const masterKeyHex = fs.readFileSync('tools/master_key.txt', 'utf8').trim();
const masterKey = Buffer.from(masterKeyHex, 'hex');

if (masterKey.length !== 32) {
    console.error('❌ ERROR: tools/master_key.txt must be a 64-character hex string (32 bytes).');
    console.error('Current length:', masterKey.length, 'bytes');
    process.exit(1);
}

// SSD-Locked Security: Extract only the SSD portion for the encryption key
const ssd = hardwareId.split('|')[0] || hardwareId;

const cipher = crypto.createCipheriv('aes-256-cbc', 
    crypto.createHash('sha256').update(ssd).digest(), 
    Buffer.alloc(16, 0)
);
const encryptedMasterKey = Buffer.concat([cipher.update(masterKey), cipher.final()]);

const licenseData = {
    license_id: `LIC-${Date.now().toString().slice(-6)}`,
    hardware_id: hardwareId,
    master_key: encryptedMasterKey.toString('base64'),
    min_app_version: minVersion,
    issued_at: new Date().toISOString().split('T')[0],
    expiry: expiry
};

function canonicalStringify(obj) {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    sortedKeys.forEach(key => {
        result[key] = obj[key];
    });
    return JSON.stringify(result);
}

const dataString = canonicalStringify(licenseData);
const signer = crypto.createSign('sha256');
signer.update(dataString);
signer.end();

const signature = signer.sign(privateKey, 'base64');
licenseData.signature = signature;

fs.writeFileSync('license.lic', JSON.stringify(licenseData, null, 2));
console.log('Success: license.lic generated for', hardwareId);
