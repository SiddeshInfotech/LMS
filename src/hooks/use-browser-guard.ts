"use client";

import { useEffect } from "react";

interface BrowserGuardOptions {
  onViolation: (reason: string) => void;
  enabled: boolean;
  isSensitive?: boolean;
}

/**
 * useBrowserGuard
 * Handles local browser-level threats (Keyboard shortcuts, context menus, focus loss).
 */
export function useBrowserGuard({ onViolation, enabled, isSensitive }: BrowserGuardOptions) {
  useEffect(() => {
    if (!enabled) return;

    // 1. Context Menu & Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Only log/notify on sensitive pages if they try to right-click
      if (isSensitive) onViolation("Context Menu Blocked on Sensitive Page");
    };

    // 2. Keyboard Shortcuts (PrintScreen, DevTools, Inspect)
    const handleKeyDown = (e: KeyboardEvent) => {
      const forbiddenKeys = ["PrintScreen", "Snapshot", "ScrollLock"];
      if (forbiddenKeys.includes(e.key) || e.keyCode === 44) {
        e.preventDefault();
        onViolation("Screenshot Attempted (PrintScreen)");
        return false;
      }

      const ctrlShift = e.ctrlKey && e.shiftKey;
      const cmdShift = e.metaKey && e.shiftKey;

      if (e.key === "F12" || (ctrlShift && (e.key === "I" || e.key === "J" || e.key === "C"))) {
        e.preventDefault();
        onViolation("DevTools Attempted");
        return false;
      }

      if (e.ctrlKey && (e.key === "P" || e.key === "S" || e.key === "U")) {
        e.preventDefault();
        onViolation(`Forbidden Action Blocked: ${e.key.toUpperCase()}`);
        return false;
      }

      // Snipping tool (Shift + Win + S)
      if (cmdShift && e.key === "S") {
        e.preventDefault();
        onViolation("Snipping Tool Blocked");
        return false;
      }

      // If sensitive (Course page), block almost all shortcuts
      if (isSensitive) {
         if (e.ctrlKey || e.altKey || e.metaKey) {
            e.preventDefault();
            return false;
         }
      }
    };

    // 3. Focus & Visibility (HDCP-like blackout)
    const handleBlur = () => {
      if (isSensitive) {
        // Give a small 2s grace for system toggles
        setTimeout(() => {
          if (!document.hasFocus()) {
            onViolation("LMS Window Lost Focus (Security Violation)");
          }
        }, 2000);
      }
    };

    // 4. Advanced DevTools detection (window size change)
    const detectDevTools = () => {
      if (!isSensitive) return;
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        onViolation("DevTools Detected via Window Size");
      }
    };

    const devToolsInterval = setInterval(detectDevTools, 2000);

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      clearInterval(devToolsInterval);
    };
  }, [enabled, isSensitive, onViolation]);
}
