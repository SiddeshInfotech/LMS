const { execSync } = require('child_process');
try {
    const wmicOut = execSync('/mnt/c/Windows/System32/wbem/WMIC.exe diskdrive get SerialNumber /format:value', { encoding: 'utf8', timeout: 5000, stdio: ['pipe','pipe','ignore'] }).trim();
    console.log("SUCCESS:", wmicOut);
} catch (e) {
    console.error("FAIL:", e.message);
}
