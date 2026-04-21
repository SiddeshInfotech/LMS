const crypto = require('crypto');

const masterKeyHex = 'bca890d471fe84022ead470b411e1709597bde7d60763bdba1419a106eb615cb';
const masterKey = Buffer.from(masterKeyHex, 'hex');
const keySource = 'SCHOOL_WIDE';

const cipher = crypto.createCipheriv('aes-256-cbc', 
    crypto.createHash('sha256').update(keySource).digest(), 
    Buffer.alloc(16, 0)
);

const encryptedMasterKey = Buffer.concat([cipher.update(masterKey), cipher.final()]);
const b64 = encryptedMasterKey.toString('base64');
console.log('Encrypted Base64:', b64);
console.log('Match expected:', b64 === 'Rm5j3raWW5/T9y9zPC+1xnWV+tYG/h0Qd+S1jmS/oxmK/PL6+NnGtymlvpXsyg2h');
