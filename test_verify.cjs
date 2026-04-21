const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function canonicalStringify(obj) {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    sortedKeys.forEach(key => {
        result[key] = obj[key];
    });
    return JSON.stringify(result);
}

function debugVerify() {
    const licensePath = path.join(__dirname, 'license.lic');
    const publicKeyPath = path.join(__dirname, 'tools/public.pem');

    if (!fs.existsSync(licensePath)) {
        console.log('❌ License file missing at', licensePath);
        return;
    }

    if (!fs.existsSync(publicKeyPath)) {
        console.log('❌ Public key missing at', publicKeyPath);
        return;
    }

    const licenseJson = fs.readFileSync(licensePath, 'utf8');
    const license = JSON.parse(licenseJson);
    const signature = license.signature;
    
    // 1. Signature Check
    const licenseToVerify = JSON.parse(licenseJson);
    delete licenseToVerify.signature;

    const dataToVerify = canonicalStringify(licenseToVerify);
    console.log('\nData being verified:', dataToVerify);

    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    const verifier = crypto.createVerify('sha256');
    verifier.update(dataToVerify);
    const isSignatureValid = verifier.verify(publicKey, signature, 'base64');

    console.log('---------------------------------------');
    console.log('Signature Valid:  ', isSignatureValid ? '✅ YES' : '❌ NO');

    // 2. Hardware ID Check (Mocking fallback)
    const currentHwid = "NOSSD|342d4556ce3e4a008dd2ed02d7eac68b|00:15:5D:FA:D0:F7";
    const licenseHwid = license.hardware_id;

    console.log('License HWID:    ', licenseHwid);
    console.log('Current HWID:    ', currentHwid);

    const currentSSD = currentHwid.split('|')[0];
    const licenseSSD = licenseHwid.split('|')[0];

    let hwidMatch = false;
    if (licenseSSD !== "NOSSD" && currentSSD !== "NOSSD" && licenseSSD === currentSSD) {
        hwidMatch = true;
        console.log('HWID Match:       ✅ YES (SSD Match Priority)');
    } else if (licenseHwid === currentHwid) {
        hwidMatch = true;
        console.log('HWID Match:       ✅ YES (Full Match)');
    } else {
        console.log('HWID Match:       ❌ NO');
    }

    // 3. Expiry Check
    const isExpired = new Date(license.expiry) < new Date();
    console.log('Expiry:           ', license.expiry);
    console.log('Expired:          ', isExpired ? '❌ YES' : '✅ NO');
    console.log('---------------------------------------\n');

    if (!isSignatureValid && signature === "MOCK_SIGNATURE") {
        console.log('NOTE: Verification failed because the license uses a MOCK_SIGNATURE.');
        console.log('This is expected during development if the license was manually edited.');
    }
}

debugVerify();
