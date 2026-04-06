"use client";

import { useEffect, useState } from "react";

interface TabGuardOptions {
  onViolation: (reason: string) => void;
  enabled: boolean;
}

/**
 * useTabGuard
 * Uses BroadcastChannel to detect and prevent multiple concurrent tabs.
 */
export function useTabGuard({ onViolation, enabled }: TabGuardOptions) {
  const [isDuplicate, setIsDuplicate] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const channel = new BroadcastChannel("lms_tab_monitor");
    const tabId = Math.random().toString(36).substring(2, 11);

    const checkDuplicate = (msg: MessageEvent) => {
      if (msg.data.type === "PING") {
        // Someone is asking if other tabs exist
        channel.postMessage({ type: "PONG", id: tabId });
      } else if (msg.data.type === "PONG" && msg.data.id !== tabId) {
        // Someone else responded! I'm a duplicate.
        setIsDuplicate(true);
        onViolation("Multitab Policy Violation: Multiple LMS tabs detected.");
      }
    };

    channel.addEventListener("message", checkDuplicate);
    
    // Initial check: Broadcast a PING with a 1s delay
    // This allows other tabs to finish loading/unloading before we check.
    const initialTimeout = setTimeout(() => {
      channel.postMessage({ type: "PING" });
    }, 1000);

    // Periodic check every 3s
    const interval = setInterval(() => {
      channel.postMessage({ type: "PING" });
    }, 3000);

    return () => {
      channel.removeEventListener("message", checkDuplicate);
      clearTimeout(initialTimeout);
      clearInterval(interval);
      channel.close();
    };
  }, [enabled, onViolation]);

  return { isDuplicate };
}
