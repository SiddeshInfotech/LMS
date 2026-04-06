"use client";

import { useEffect, useState } from "react";

interface ElectronGuardOptions {
  onViolation: (reason: string, isHardBan?: boolean) => void;
  setViolationActive: (active: boolean, reason?: string) => void;
  enabled: boolean;
}

/**
 * useElectronGuard
 * Connects to the Electron Main process to listen for OS-level threats.
 */
export function useElectronGuard({ onViolation, setViolationActive, enabled }: ElectronGuardOptions) {
  const [isRecording, setIsRecording] = useState(false);
  
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.electronAPI) return;

    // 1. Listen for recording status changes (Responsive Guard)
    window.electronAPI.onRecordingStatus(({ isRecording: active }: { isRecording: boolean }) => {
      setIsRecording(active);
      // Toggle violation state in the context (reversible)
      setViolationActive(active, "Screen Recording Software Detected");
    });

    // 2. Listen for forced logouts from Main process
    window.electronAPI.onForceLogout(({ reason }: { reason: string }) => {
      onViolation(reason || "Security Policy Violation (Remote)");
    });

    // 3. Initial check (if login is even allowed)
    window.electronAPI.checkCanLogin().then(({ allowed }: { allowed: boolean }) => {
      if (!allowed) {
        onViolation("Recording software active before login.");
      }
    });

    // 4. Request OS-level protection (if available)
    window.electronAPI.setProtection?.(true)?.catch?.(console.error);

    // 5. Start Active Scanning
    window.electronAPI.startSecurityScan?.()?.catch?.(console.error);

    return () => {
      // Disarm protection when leaving
      if (window.electronAPI) {
        window.electronAPI.setProtection?.(false)?.catch?.(console.error);
        window.electronAPI.stopSecurityScan?.();
      }
    };
  }, [enabled, onViolation]);

  return { isRecording };
}
