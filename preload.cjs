const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  setProtection: (enabled) => ipcRenderer.invoke('set-protection', enabled),
  setKioskLock: (enabled) => ipcRenderer.invoke('set-kiosk-lock', enabled),
  checkCanLogin: () => ipcRenderer.invoke('check-recorders').then(active => ({ allowed: !active })),
  startSecurityScan: () => ipcRenderer.invoke('check-recorders'),
  exitApp: () => ipcRenderer.send('exit-app'),

  // Licensing System
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  getHardwareID: () => ipcRenderer.invoke('get-hardware-id'),
  resolveShortCode: (code) => ipcRenderer.invoke('resolve-short-code', code),
  saveLicense: (content) => ipcRenderer.invoke('save-license', content),

  // Event Listeners
  onRecordingStatus: (callback) => {
    ipcRenderer.on('recording-status', (event, ...args) => callback(...args));
  },
  onForceLogout: (callback) => {
    ipcRenderer.on('force-logout', (event, ...args) => callback(...args));
  },
  onSecurityThreat: (callback) => {
    ipcRenderer.on('security-threat', (event, ...args) => callback(...args));
  }
});
