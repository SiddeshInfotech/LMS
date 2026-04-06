export interface ElectronAPI {
  setProtection: (enabled: boolean) => Promise<boolean>;
  checkCanLogin: () => Promise<{ allowed: boolean }>;
  startSecurityScan: () => Promise<boolean>;
  stopSecurityScan: () => void;
  onRecordingStatus: (callback: (data: { isRecording: boolean }) => void) => void;
  onForceLogout: (callback: (data: { reason: string }) => void) => void;
  exitApp: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
