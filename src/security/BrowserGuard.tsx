import React from "react";
import { useBrowserGuard } from "@/hooks/use-browser-guard";
import { useSecurity } from "@/context/security-context";
import { useLocation } from "react-router-dom";

/**
 * BrowserGuard
 * Protects the application from browser-level threats.
 * Blocks: F12, Ctrl+Shift+I, Right-Click, PrintScreen, etc.
 */
export const BrowserGuard: React.FC = () => {
  const { reportViolation, isBanned } = useSecurity();
  const location = useLocation();

  // Determine if the current page is sensitive (e.g., /courses)
  const isSensitive = location.pathname.includes("/courses");

  useBrowserGuard({
    onViolation: reportViolation,
    enabled: !isBanned,
    isSensitive: isSensitive,
  });

  return null; // This is a logic-only component
};
