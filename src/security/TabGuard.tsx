import React from "react";
import { useTabGuard } from "@/hooks/use-tab-guard";
import { useSecurity } from "@/context/security-context";
import { useLocation } from "react-router-dom";

/**
 * TabGuard
 * Detects multiple open tabs and triggers a violation.
 * Prevents the user from opening the application in more than one instance.
 */
export const TabGuard: React.FC = () => {
  const { reportViolation, isBanned } = useSecurity();
  const location = useLocation();

  // Multi-tab prevention usually only for authenticated or sensitive areas
  // but here we block it globally except for the login page if needed.
  const isLoginPage = location.pathname === "/";

  useTabGuard({
    onViolation: reportViolation,
    enabled: !isBanned && !isLoginPage,
  });

  return null; // Logic-only component
};
