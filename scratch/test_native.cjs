const path = require('path');
const fs = require('fs');

try {
    const nativePath = path.resolve('../dist_electron/linux-unpacked/resources/recorder_detect.node');
    console.log(`Checking path: ${nativePath}`);
    console.log(`File exists: ${fs.existsSync(nativePath)}`);
    
    if (fs.existsSync(nativePath)) {
        const recorder = require(nativePath);
        console.log('✅ Native module LOADED successfully!');
        if (recorder.getHardwareID) {
            console.log(`Detected HWID: ${recorder.getHardwareID()}`);
        } else {
            console.log('❌ getHardwareID function missing!');
        }
    } else {
        console.log('❌ Path not found!');
    }
} catch (e) {
    console.error('❌ Loading FAILED:', e);
}
