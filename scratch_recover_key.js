const fs = require('fs');
const crypto = require('crypto');

const data = JSON.parse(fs.readFileSync('license.lic', 'utf8'));
const hardwareId = data.hardware_id;
const encryptedBuf = Buffer.from(data.master_key, 'base64');
const ssd = hardwareId.split('|')[0] || hardwareId;

const decipher = crypto.createDecipheriv('aes-256-cbc',
    crypto.createHash('sha256').update(ssd).digest(),
    Buffer.alloc(16, 0)
);

const oldMasterKey = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
console.log('RECOVERED_OLD_MASTER_KEY:', oldMasterKey.toString('hex'));
