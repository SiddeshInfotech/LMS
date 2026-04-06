"use client";

import React from "react";

export function CaptureAlert() {
  return (
    <div style={{
      position: 'fixed',
      top: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9998,
      backgroundColor: '#1a1a2e',
      padding: '0.8rem 1.5rem',
      borderRadius: '20px',
      boxShadow: '8px 8px 16px #131321, -8px -8px 16px #21213b',
      border: '1px solid rgba(255,255,255,0.02)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.8rem',
      pointerEvents: 'none',
      userSelect: 'none'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#e94560',
        boxShadow: '0 0 10px rgba(233, 69, 96, 0.5)'
      }} />
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#888'
      }}>
        Content Protection Active
      </span>
    </div>
  );
}
