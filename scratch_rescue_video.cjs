const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Recover Old Key
const data = JSON.parse(fs.readFileSync('license.lic', 'utf8'));
const hardwareId = data.hardware_id;
const encryptedBuf = Buffer.from(data.master_key, 'base64');
const ssd = hardwareId.split('|')[0] || hardwareId;

const keysDecipher = crypto.createDecipheriv('aes-256-cbc', crypto.createHash('sha256').update(ssd).digest(), Buffer.alloc(16, 0));
const oldMasterKey = Buffer.concat([keysDecipher.update(encryptedBuf), keysDecipher.final()]);
console.log('Old Master Key Recovered.');

// 2. Define Salsa20 Logic
function rotl(x, b) { return (x << b) | (x >>> (32 - b)); }
function quarterRound(state, a, b, c, d) {
    state[b] ^= rotl((state[a] + state[d]) >>> 0, 7);
    state[c] ^= rotl((state[b] + state[a]) >>> 0, 9);
    state[d] ^= rotl((state[c] + state[b]) >>> 0, 13);
    state[a] ^= rotl((state[d] + state[c]) >>> 0, 18);
}
function salsa20_block(in_state) {
    let out = new Uint32Array(in_state);
    for (let i = 0; i < 10; i++) {
        quarterRound(out, 0, 4, 8, 12);
        quarterRound(out, 5, 9, 13, 1);
        quarterRound(out, 10, 14, 2, 6);
        quarterRound(out, 15, 3, 7, 11);
        quarterRound(out, 0, 1, 2, 3);
        quarterRound(out, 5, 6, 7, 4);
        quarterRound(out, 10, 11, 8, 9);
        quarterRound(out, 15, 12, 13, 14);
    }
    for (let i = 0; i < 16; i++) out[i] = (out[i] + in_state[i]) >>> 0;
    return out;
}

function processSalsa20(inputPath, outputPath, masterKey) {
    const data = fs.readFileSync(inputPath);
    const result = Buffer.alloc(data.length);
    const key = new Uint32Array(masterKey.buffer, masterKey.byteOffset, 8);

    for (let start = 0; start < data.length; start += 64) {
        const chunkIndex = Math.floor(start / 64);
        const state = new Uint32Array([
            0x61707865, key[0], key[1], key[2],
            key[3], 0x33322d6b, chunkIndex, 0,
            0, 0, 0x6e647974, key[4],
            key[5], key[6], key[7], 0x616c6267
        ]);
        const block = salsa20_block(state);
        const stream = Buffer.from(block.buffer);
        for (let i = 0; i < 64 && (start + i) < data.length; i++) {
            result[start + i] = data[start + i] ^ stream[i];
        }
    }
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, result);
}

// 3. Decrypt ALL .lmsx back to .mp4
const encDir = path.resolve('resources/encrypted');
const vidsDir = path.resolve('videos');
if (!fs.existsSync(vidsDir)) fs.mkdirSync(vidsDir, { recursive: true });

if (fs.existsSync(encDir)) {
    fs.readdirSync(encDir).forEach(file => {
        if (file.endsWith('.lmsx')) {
            const input = path.join(encDir, file);
            const output = path.join(vidsDir, file.replace('.lmsx', '.mp4'));
            console.log('Restoring:', file);
            processSalsa20(input, output, oldMasterKey);
        }
    });
}
