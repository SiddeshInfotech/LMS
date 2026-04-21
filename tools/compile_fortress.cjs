const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');

// --- Fortress Configuration ---
const FILES_TO_COMPILE = [
  { input: 'main.cjs', output: 'main.jsc', loader: 'main-loader.cjs' },
  { input: 'preload.cjs', output: 'preload.jsc', loader: 'preload-loader.cjs' }
];

async function compileFortress() {
  console.log('🛡️ Starting Fortress Binary Compilation...');

  for (const item of FILES_TO_COMPILE) {
    const inputPath = path.resolve(item.input);
    const outputPath = path.resolve(item.output);
    const loaderPath = path.resolve(item.loader);

    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Source not found: ${item.input}`);
      continue;
    }

    console.log(`🔒 Compiling: ${item.input} -> ${item.output}`);
    
    // 0. Cleanup old binaries to prevent corruption (Project files only)
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }

    // 1. Compile to V8 Bytecode
    try {
      await bytenode.compileFile({
        filename: inputPath,
        output: outputPath,
        electron: false // Use current process (already Electron)
      });
      console.log(`✅ Success: Generated ${item.output}`);
    } catch (err) {
      console.error(`❌ Compilation Failed for ${item.input}:`, err);
      process.exit(1);
    }

    // 2. Generate the "Ghost" Loader Stub
    const loaderContent = `// LMS Fortress Ghost Loader
const path = require('path');
require('bytenode');
require(path.join(__dirname, '${item.output}'));
`;
    fs.writeFileSync(loaderPath, loaderContent);
    console.log(`🔗 Created Loader: ${item.loader}`);
  }

  console.log('-------------------------------------------');
  console.log('✅ Fortress Phase Complete. Binary Integrity Locked.');
  process.exit(0); // Force exit for Electron environment
}

compileFortress();
