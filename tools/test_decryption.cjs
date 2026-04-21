const path = require('path');
const fs = require('fs');

console.log('--- LMS NATIVE DECRYPTION DIAGNOSTIC ---');

const possiblePaths = [
    path.join(__dirname, '../native-build/Release/recorder_detect.node'),
    path.join(__dirname, '../build/Release/recorder_detect.node')
];

let recorderDetect = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        console.log(`🔍 Found module at: ${p}`);
        try {
            recorderDetect = require(p);
            console.log('✅ Module loaded successfully.');
            break;
        } catch (e) {
            console.error(`❌ Found but failed to load: ${e.message}`);
        }
    }
}

if (!recorderDetect) {
    console.error('❌ CRITICAL: No recorder_detect.node found or loaded.');
    process.exit(1);
}

// Test a basic HWID call
try {
    const hwid = recorderDetect.getHardwareID();
    console.log(`✅ Native HWID Test: ${hwid}`);
} catch (e) {
    console.error(`❌ HWID Test Failed: ${e.message}`);
}

// Test a decryption call
try {
    const testData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const decrypted = recorderDetect.decryptChunk(testData, 0);
    console.log(`✅ Decryption Test: Logic executed without crash.`);
} catch (e) {
    console.error(`❌ Decryption Test Failed: ${e.message}`);
}

console.log('-----------------------------------------');
console.log('Diagnostic Complete.');
