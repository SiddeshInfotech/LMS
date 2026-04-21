const crypto = require('crypto');
const fs = require('fs');

function verifyLicense() {
    console.log('--- Verifying Generated License ---');
    
    if (!fs.existsSync('license.lic')) {
        console.error('Error: license.lic not found!');
        return;
    }

    const licenseData = JSON.parse(fs.readFileSync('license.lic', 'utf8'));
    const signature = licenseData.signature;
    
    // Remove signature to verify the rest
    const toVerify = { ...licenseData };
    delete toVerify.signature;

    // Canonical stringify
    const sortedKeys = Object.keys(toVerify).sort();
    const result = {};
    sortedKeys.forEach(key => {
        result[key] = toVerify[key];
    });
    const dataString = JSON.stringify(result);

    const publicKey = fs.readFileSync('tools/public.pem', 'utf8');
    const verifier = crypto.createVerify('sha256');
    verifier.update(dataString);
    
    const isValid = verifier.verify(publicKey, signature, 'base64');
    
    console.log('License ID:', licenseData.license_id);
    console.log('Hardware ID:', licenseData.hardware_id);
    console.log('Expiry:', licenseData.expiry);
    
    if (isValid) {
        console.log('✅ VALID: License is cryptographically signed and correct.');
    } else {
        console.error('❌ INVALID: Signature mismatch!');
    }
}

verifyLicense();
