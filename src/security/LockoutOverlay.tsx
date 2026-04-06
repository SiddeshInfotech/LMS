"use client";

import React from "react";
import { Lock, RefreshCw, ShieldAlert } from "lucide-react";

interface LockoutOverlayProps {
  reason: string;
  onReset: () => void;
  isTransient?: boolean;
}

export function LockoutOverlay({ reason, onReset, isTransient }: LockoutOverlayProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: '#1a1a2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: '"Inter", sans-serif'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: '#1a1a2e',
        borderRadius: '40px',
        boxShadow: '20px 20px 60px #131321, -20px -20px 60px #21213b',
        padding: '3rem',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.02)'
      }}>
        <div style={{ 
          width: '70px', 
          height: '70px', 
          margin: '0 auto 2rem',
          borderRadius: '20px',
          backgroundColor: '#1a1a2e',
          boxShadow: 'inset 6px 6px 12px #131321, inset -6px -6px 12px #21213b',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '1.8rem'
        }}>
          🛡️
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginBottom: '0.8rem' }}>
          {isTransient ? "Security Alert" : "Security Protocol"}
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.6, marginBottom: '2rem' }}>
          {isTransient 
            ? "Content playback is temporarily hidden because the system detected a potential recording threat:" 
            : "Playback interrupted due to a permanent violation of security policy:"}
          <span style={{ color: '#e94560', display: 'block', marginTop: '0.5rem', fontWeight: 600 }}>"{reason}"</span>
        </p>

        {isTransient && (
          <p style={{ fontSize: '0.8rem', color: '#e94560', fontStyle: 'italic', marginBottom: '2rem' }}>
            Please close the offending application to resume.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isTransient && (
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '1rem',
                backgroundColor: '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '15px',
                boxShadow: '6px 6px 12px #131321, -6px -6px 12px #21213b',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              REFRESH SESSION
            </button>
          )}
          
          {!isTransient && (
            <button 
              onClick={onReset}
              style={{
                padding: '1rem',
                backgroundColor: 'transparent',
                color: '#555',
                border: 'none',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Reset Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
