const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Re-implement the SAME canonical stringify used in both files
function canonicalStringify(obj) {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    sortedKeys.forEach(key => {
        result[key] = obj[key];
    });
    return JSON.stringify(result);
}

// 2. Test signing and verification
function runTest() {
    console.log('--- License Logic Verification Test ---');

    const privateKey = fs.readFileSync('tools/private.pem', 'utf8');
    const publicKey = fs.readFileSync('tools/public.pem', 'utf8');

    const testData = {
        license_id: "TEST-123",
        hardware_id: "TEST-HWID",
        expiry: "2027-01-01",
        issued_at: "2026-04-04"
    };

    // SIGNING
    const dataString = canonicalStringify(testData);
    const signer = crypto.createSign('sha256');
    signer.update(dataString);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    
    console.log('Signature generated:', signature.slice(0, 20) + '...');

    // VERIFICATION
    const verifier = crypto.createVerify('sha256');
    // Simulate what happens in the app:
    // 1. Stringify the object (after removing signature)
    const verifyString = canonicalStringify(testData);
    verifier.update(verifyString);
    const isValid = verifier.verify(publicKey, signature, 'base64');

    if (isValid) {
        console.log('✅ SUCCESS: Signature verified perfectly with canonical JSON.');
    } else {
        console.error('❌ FAILURE: Signature verification failed!');
    }
}

runTest();
