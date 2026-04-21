const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * SIDDESH GLOBAL - ACTIVATION CODE GENERATOR
 * Generates a 10-char code (4L, 4N, 2S) and maps it to a signed license.
 */

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing O, I
const NUMBERS = '23456789'; // Removed 0, 1
const SYMBOLS = '!@#$%^&*+=?';

function generateCode() {
    let code = '';
    // 4 Letters
    for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    // 4 Numbers
    for (let i = 0; i < 4; i++) code += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
    // 2 Symbols
    for (let i = 0; i < 2; i++) code += SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    return code;
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node tools/generate_activation_code.cjs <hardware_id> [machine_name]');
    console.log('Example: node tools/generate_activation_code.cjs "SSD-123|UUID-456" "Global-School-01"');
    process.exit(1);
}

const hardwareId = args[0];
const machineName = args[1] || "LMS-Station";
const customLicenseId = args[2] || `LIC-${Date.now().toString().slice(-6)}`;
const code = generateCode();


console.log(`\n🔑 GENERATING ACTIVATION CODE FOR: ${machineName}`);
console.log(`-----------------------------------------------`);
console.log(`👉 CODE: ${code}`);
console.log(`-----------------------------------------------\n`);

// Load Keys
const privateKeyPath = path.join(__dirname, 'private.pem');
const masterKeyPath = path.join(__dirname, 'master_key.txt');

if (!fs.existsSync(privateKeyPath) || !fs.existsSync(masterKeyPath)) {
    console.error('❌ ERROR: tools/private.pem or tools/master_key.txt missing.');
    process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const masterKeyHex = fs.readFileSync(masterKeyPath, 'utf8').trim();
const masterKey = Buffer.from(masterKeyHex, 'hex');

// SSD-Locked Security
const ssd = hardwareId.split('|')[0] || hardwareId;
const cipher = crypto.createCipheriv('aes-256-cbc', 
    crypto.createHash('sha256').update(ssd).digest(), 
    Buffer.alloc(16, 0)
);
const encryptedMasterKey = Buffer.concat([cipher.update(masterKey), cipher.final()]);

// Create License Object
const licenseData = {
    license_id: customLicenseId,
    machine_name: machineName,

    hardware_id: hardwareId,
    master_key: encryptedMasterKey.toString('base64'),
    min_app_version: "1.0.2"
};

// Canonical Stringify for Signing
function canonicalStringify(obj) {
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    sortedKeys.forEach(key => { result[key] = obj[key]; });
    return JSON.stringify(result);
}

const dataString = canonicalStringify(licenseData);
const signer = crypto.createSign('sha256');
signer.update(dataString);
signer.end();

const signature = signer.sign(privateKey, 'base64');
licenseData.signature = signature;

// Save Registry File
const outputDir = path.join(__dirname, '../registry');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, `${code}.json`);
fs.writeFileSync(outputPath, JSON.stringify(licenseData, null, 2));

console.log(`✅ SUCCESS! Registry file created at: ./registry/${code}.json`);
console.log(`🚀 UPLOAD THIS FILE TO: https://api.siddesh.com/license-keys/${code}.json\n`);
