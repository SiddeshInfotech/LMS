const path = require('path');
const fs = require('fs');

// Path to the native module
const nativePath = path.join(__dirname, '../build/Release/recorder_detect.node');

if (!fs.existsSync(nativePath)) {
    console.error('Error: Native security module not found. Run "npm run rebuild" first.');
    process.exit(1);
}

try {
    const recorderDetect = require(nativePath);
    const hwid = recorderDetect.getHardwareID();
    
    console.log('\n=======================================');
    console.log('      LMS MACHINE FINGERPRINT         ');
    console.log('=======================================');
    console.log('\nHardware ID: ' + hwid);
    console.log('\nCopy the ID above and use it with the');
    console.log('sign_license.cjs tool to generate a license.');
    console.log('=======================================\n');

} catch (e) {
    console.error('Fatal: Failed to load native security module:', e.message);
}
