const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function debugVerify() {
    const licensePath = path.join(__dirname, 'license.lic');
    const publicKeyPath = path.join(__dirname, 'tools/public.pem');

    if (!fs.existsSync(licensePath)) {
        console.log('License file missing at', licensePath);
        return;
    }

    if (!fs.existsSync(publicKeyPath)) {
        console.log('Public key missing at', publicKeyPath);
        return;
    }

    const licenseJson = fs.readFileSync(licensePath, 'utf8');
    const license = JSON.parse(licenseJson);
    const signature = license.signature;
    
    // Create a copy to match main.cjs behavior
    const licenseToVerify = JSON.parse(licenseJson);
    delete licenseToVerify.signature;

    const dataToVerify = JSON.stringify(licenseToVerify);
    console.log('Data being verified:', dataToVerify);

    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    const verifier = crypto.createVerify('sha256');
    verifier.update(dataToVerify);
    const isValid = verifier.verify(publicKey, signature, 'base64');

    console.log('Signature is valid:', isValid);

    if (!isValid) {
        // Try without any potential whitespace issues or different stringification
        console.log('Testing alternative stringification...');
        // Match the exact string used in sign_license.cjs
        // Note: sign_license.cjs does JSON.stringify(licenseData) before adding signature
    }
}

debugVerify();
