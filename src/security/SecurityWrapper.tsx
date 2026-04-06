import React from "react";
import { useLocation } from "react-router-dom";
import { useSecurity } from "@/context/security-context";
import { useElectronGuard } from "@/hooks/use-electron-guard";
import { BrowserGuard } from "./BrowserGuard";
import { TabGuard } from "./TabGuard";
import { LockoutOverlay } from "./LockoutOverlay";
import { CaptureAlert } from "./CaptureAlert";

/**
 * SecurityWrapper
 * The primary orchestrator for the LMS Security Architecture.
 * Combines Browser-level, Tab-level, and Native-level guards.
 */
export default function SecurityWrapper({ children }: { children: React.ReactNode }) {
  const {
    isBanned,
    isViolationActive,
    reportViolation,
    setViolationActive,
    isSecured,
    violationReason,
    resetSecurity
  } = useSecurity();
  const location = useLocation();

  // 0. Cross-platform "Blinding" Effect
  // (Removed document.body class manipulation to prevent total UI destruction)

  const isSensitivePage = location.pathname.includes("/courses");
  const isLoginPage = location.pathname === "/";

  // 1. Native Guard (Electron Interface)
  useElectronGuard({
    onViolation: reportViolation,
    setViolationActive: setViolationActive,
    enabled: true,
  });

  // 2. Integration of Component Guards
  const guards = (
    <>
      <BrowserGuard />
      <TabGuard />
    </>
  );

  return (
    <>
      {guards}

      {/* Content wrapper. Blacks out when a violation occurs, but stays in DOM to maintain state */}
      <div className={`min-h-screen transition-all duration-300 ${(isBanned || isViolationActive) ? "security-blackout" : ""} ${isSecured && !isLoginPage ? "select-none" : ""}`}>
        {children}
      </div>

      {/* Render Lockout OVER the blacked-out content */}
      {(isBanned || isViolationActive) && (
        <LockoutOverlay
          reason={violationReason || "Security Policy Violation"}
          onReset={resetSecurity}
          isTransient={isViolationActive && !isBanned}
        />
      )}

      {/* Visual indicator when content protection is active on sensitive pages */}
      {/* {isSensitivePage && <CaptureAlert />} */}
      {isSensitivePage && null}
    </>
  );
}
