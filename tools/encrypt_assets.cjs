const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Salsa20 Implementation ---
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

function encryptFile(inputPath, outputPath, masterKey) {
    const data = fs.readFileSync(inputPath);
    const encrypted = Buffer.alloc(data.length);
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
            encrypted[start + i] = data[start + i] ^ stream[i];
        }
    }
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, encrypted);
    
    // Diagnostic: Log first 16 bytes of the encrypted file
    const header = encrypted.slice(0, 16).toString('hex').toUpperCase();
    console.log(`Success! [Hex Signature: ${header}]`);
}

// Work relative to current working directory (project root)
const assetsDir = path.resolve('videos');
const outputDir = path.resolve('resources/encrypted');

function processDirectory(currentDir, baseOutputDir, masterKey) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.forEach(entry => {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            processDirectory(fullPath, baseOutputDir, masterKey);
        } else if (entry.name.endsWith('.mp4')) {
            const relativePath = path.relative(assetsDir, fullPath);
            const outputPath = path.join(baseOutputDir, relativePath.replace('.mp4', '.lmsx'));
            console.log(`Encrypting: ${relativePath} -> ${path.basename(outputPath)}`);
            encryptFile(fullPath, outputPath, masterKey);
        }
    });
}

// --- Main ---
const MASTER_KEY_PATH = 'tools/master_key.txt';
if (!fs.existsSync(MASTER_KEY_PATH)) {
    fs.writeFileSync(MASTER_KEY_PATH, crypto.randomBytes(32).toString('hex'));
}
const masterKey = Buffer.from(fs.readFileSync(MASTER_KEY_PATH, 'utf8').trim(), 'hex');

console.log('Target Assets:', assetsDir);
if (!fs.existsSync(assetsDir)) {
    console.error('ERROR: AssetsDir not found!');
    process.exit(1);
}

processDirectory(assetsDir, outputDir, masterKey);
console.log('Success!');
