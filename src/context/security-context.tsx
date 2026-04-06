import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface SecurityState {
  isBanned: boolean; // Hard ban (requires reset/restart)
  isViolationActive: boolean; // Transient violation (e.g., app open)
  isSecured: boolean;
  violationReason: string | null;
  isGracePeriod: boolean;
}

interface SecurityContextType extends SecurityState {
  reportViolation: (reason: string, isHardBan?: boolean) => void;
  setViolationActive: (active: boolean, reason?: string) => void;
  setSecured: (secured: boolean) => void;
  resetSecurity: () => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<SecurityState>({
    isBanned: false,
    isViolationActive: false,
    isSecured: false,
    violationReason: null,
    isGracePeriod: false,
  });

  // 1. Violation Handler
  const reportViolation = useCallback((reason: string, isHardBan = false) => {
    console.warn(`SECURITY VIOLATION: ${reason} (Hard: ${isHardBan})`);
    
    setState(prev => {
      if (prev.isGracePeriod) return prev;
      
      if (isHardBan) {
        // Persist ONLY hard bans for session recovery
        localStorage.setItem("lms_violation", reason);
        localStorage.setItem("lms_violation_time", Date.now().toString());
        return { ...prev, isBanned: true, violationReason: reason };
      }

      return { ...prev, isViolationActive: true, violationReason: reason };
    });
  }, []);

  const setViolationActive = useCallback((active: boolean, reason: string = "Security Policy Violation") => {
    setState(prev => ({
      ...prev,
      isViolationActive: active,
      violationReason: active ? reason : (prev.isBanned ? prev.violationReason : null)
    }));
  }, []);

  const setSecured = useCallback((secured: boolean) => {
    setState(prev => ({ ...prev, isSecured: secured }));
  }, []);

  const resetSecurity = useCallback(() => {
    localStorage.removeItem("lms_violation");
    localStorage.removeItem("lms_violation_time");
    
    if (window.electronAPI?.exitApp) {
      window.electronAPI.exitApp();
    } else {
      setState({
        isBanned: false,
        isViolationActive: false,
        isSecured: false,
        violationReason: null,
        isGracePeriod: false,
      });
      navigate("/");
    }
  }, [navigate]);

  // 2. Initial Session Check (Persistence of HARD bans only)
  useEffect(() => {
    const violation = localStorage.getItem("lms_violation");
    if (violation) {
      setState(prev => ({ ...prev, isBanned: true, violationReason: violation }));
    }
  }, []);

  return (
    <SecurityContext.Provider value={{ ...state, reportViolation, setViolationActive, setSecured, resetSecurity }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error("useSecurity must be used within a SecurityProvider");
  }
  return context;
}
