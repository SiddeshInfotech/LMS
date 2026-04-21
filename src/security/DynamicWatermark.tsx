import React, { useEffect, useState } from 'react';

interface DynamicWatermarkProps {
  userId?: string;
  isVisible: boolean;
}

/**
 * DynamicWatermark
 * Renders a semi-transparent, randomized overlay of user-specific info
 * to deter screen recording and capture. Only active during security threats.
 */
export const DynamicWatermark: React.FC<DynamicWatermarkProps> = ({ userId = 'SIDDESH_LMS_USER', isVisible }) => {
  const [position, setPosition] = useState({ top: '10%', left: '10%', rotate: '0deg' });
  const [timestamp, setTimestamp] = useState(new Date().toLocaleString());

  useEffect(() => {
    if (!isVisible) return;

    // Periodically update position to prevent easy masking/cropping
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 80) + 5;
      const left = Math.floor(Math.random() * 80) + 5;
      const rotate = Math.floor(Math.random() * 40) - 20; // -20 to 20 deg
      
      setPosition({
        top: `${top}%`,
        left: `${left}%`,
        rotate: `${rotate}deg`
      });
      setTimestamp(new Date().toLocaleString());
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      {/* Primary moving watermark */}
      <div style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: `rotate(${position.rotate})`,
        padding: '10px 15px',
        background: 'rgba(0, 0, 0, 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.03)',
        color: 'rgba(255, 255, 255, 0.15)',
        fontSize: '0.9rem',
        fontWeight: 600,
        fontFamily: 'monospace',
        whiteSpace: 'nowrap',
        transition: 'all 2s ease-in-out',
        textShadow: '0 0 1px rgba(0,0,0,0.5)',
      }}>
        {userId} • {timestamp} • SECURE_LMS
      </div>

      {/* Static background grid of subtle watermarks */}
      <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          width: '100%',
          height: '100%',
          opacity: 0.05,
          color: '#fff',
          fontSize: '0.7rem',
          pointerEvents: 'none',
      }}>
          {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transform: 'rotate(-25deg)'
              }}>
                  {userId}
              </div>
          ))}
      </div>
    </div>
  );
};
