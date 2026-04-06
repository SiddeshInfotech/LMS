const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  setProtection: (enabled) => ipcRenderer.invoke('set-protection', enabled),
  checkCanLogin: () => ipcRenderer.invoke('check-recorders').then(active => ({ allowed: !active })),
  startSecurityScan: () => ipcRenderer.invoke('check-recorders'),
  exitApp: () => ipcRenderer.send('exit-app'),

  // Licensing System
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  getHardwareID: () => ipcRenderer.invoke('get-hardware-id'),

  // Event Listeners
  onRecordingStatus: (callback) => {
    ipcRenderer.on('recording-status', (event, ...args) => callback(...args));
  },
  onForceLogout: (callback) => {
    ipcRenderer.on('force-logout', (event, ...args) => callback(...args));
  }
});
