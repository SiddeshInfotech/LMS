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

const publicKeyPath = path.join(__dirname, '../tools/public.pem');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

const staticEntries = {
    "VCMG8987*&": {
        license_id: "LIC-444486",
        machine_name: "Siddesh-Global-Education-Society",
        hardware_id: "SCHOOL_WIDE",
        master_key: "Rm5j3raWW5/T9y9zPC+1xnWV+tYG/h0Qd+S1jmS/oxmK/PL6+NnGtymlvpXsyg2h",
        signature: "OOjHzl0qVIO930+mxNsKMR7lx/OUderaJmufYK1Z40t6x+WHvLNcKgfbYY9sZ9jWPx+sfgu6yJIJJ4tJzxfJfNDaWvzjnNwezVOjB8WBK3VfdkQroOF4qUmckrNQKu0BVBbaegARrSwt1AQBOWFkat6f98WAwrslBX8CGYQRT97md8O7W2E+4P0N87ePZ+uq2hmAIa4JFhMQytC0Y6bpeHqLP/uN8cTTOgM62EGubNmuAHcm39UpXXktesAhr6rd4trCtWzizg0rvp5F2LqdWmqS5lOcJFv7RfL5UGTM6bjPqwixJey+MoQj3QfbTXGI7KSOd2rohL6Q8kDhcynF1Q=="
    }
};

for (const [code, license] of Object.entries(staticEntries)) {
    const sig = license.signature;
    const toVerify = { ...license };
    delete toVerify.signature;

    const data1 = canonicalStringify(toVerify);
    const verifier1 = crypto.createVerify('sha256').update(data1);
    const ok1 = verifier1.verify(publicKey, sig, 'base64');
    console.log(`Code ${code} (No min_app_version):`, ok1 ? '✅ VALID' : '❌ INVALID');

    const toVerify2 = { ...toVerify, min_app_version: "1.0.2" };
    const data2 = canonicalStringify(toVerify2);
    const verifier2 = crypto.createVerify('sha256').update(data2);
    const ok2 = verifier2.verify(publicKey, sig, 'base64');
    console.log(`Code ${code} (With min_app_version):`, ok2 ? '✅ VALID' : '❌ INVALID');
}
