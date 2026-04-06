import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UnlicensedScreen = () => {
  const [hwid, setHwid] = useState('FETCHING...');
  const [status, setStatus] = useState<any>(null);
  const navigate = useNavigate();

  const checkLicense = async () => {
    const result = await (window as any).electronAPI.getLicenseStatus();
    setStatus(result);
    if (result.valid) {
      navigate('/');
    }
  };

  useEffect(() => {
    const fetchHwid = async () => {
      const id = await (window as any).electronAPI.getHardwareID();
      setHwid(id);
    };
    fetchHwid();

    // Polling for license file updates
    const interval = setInterval(checkLicense, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(hwid);
    alert('Hardware ID copied to clipboard!');
  };

  const getReasonText = () => {
    if (!status) return 'Authenticating...';
    switch (status.reason) {
      case 'MISSING': return 'License file missing';
      case 'TAMPERED': return 'Signature mismatch';
      case 'HARDWARE_MISMATCH': return 'Hardware lock mismatch';
      case 'EXPIRED': return `Subscription expired on ${status.expiry}`;
      case 'VERSION_OUTDATED': return 'App version outdated';
      default: return 'Verification failed';
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: '#1a1a2e',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#e0e0e0',
      fontFamily: '"Inter", system-ui, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        padding: '3.5rem',
        borderRadius: '40px',
        boxShadow: '20px 20px 60px #131321, -20px -20px 60px #21213b',
        textAlign: 'center',
        maxWidth: '460px',
        border: '1px solid rgba(255,255,255,0.02)'
      }}>
        {/* Minimal Shield Icon */}
        <div style={{ 
          width: '80px', 
          height: '80px', 
          margin: '0 auto 2rem',
          borderRadius: '20px',
          backgroundColor: '#1a1a2e',
          boxShadow: 'inset 6px 6px 12px #131321, inset -6px -6px 12px #21213b',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '2rem'
        }}>
          🛡️
        </div>

        <h1 style={{ 
          fontSize: '1.8rem', 
          fontWeight: 700, 
          letterSpacing: '-0.02em', 
          marginBottom: '0.8rem',
          color: '#ffffff'
        }}>
          Access Restricted
        </h1>
        
        <div style={{
          fontSize: '0.9rem',
          color: '#e94560',
          padding: '0.5rem 1rem',
          borderRadius: '10px',
          backgroundColor: '#1a1a2e',
          boxShadow: 'inset 4px 4px 8px #131321, inset -4px -4px 8px #21213b',
          display: 'inline-block',
          marginBottom: '2.5rem',
          fontWeight: 500
        }}>
          {getReasonText()}
        </div>
        
        <div style={{ 
          marginBottom: '2.5rem',
          textAlign: 'left'
        }}>
          <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.8rem', marginLeft: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Device Fingerprint
          </p>
          <div style={{ 
            background: '#1a1a2e', 
            padding: '1.2rem', 
            borderRadius: '15px',
            boxShadow: 'inset 8px 8px 16px #131321, inset -8px -8px 16px #21213b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '1rem',
            color: '#aaa',
            fontFamily: 'monospace'
          }}>
            {hwid}
          </div>
        </div>

        <button 
          onClick={handleCopy}
          style={{
            width: '100%',
            padding: '1.1rem',
            backgroundColor: '#1a1a2e',
            color: '#ffffff',
            border: 'none',
            borderRadius: '15px',
            boxShadow: '6px 6px 12px #131321, -6px -6px 12px #21213b',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            marginBottom: '1.5rem'
          }}
          onMouseDown={(e: any) => {
            e.currentTarget.style.boxShadow = 'inset 4px 4px 8px #131321, inset -4px -4px 8px #21213b';
            e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onMouseUp={(e: any) => {
            e.currentTarget.style.boxShadow = '6px 6px 12px #131321, -6px -6px 12px #21213b';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Copy Fingerprint
        </button>

        <button 
          onClick={() => (window as any).electronAPI.exitApp()}
          style={{
            background: 'transparent',
            color: '#555',
            border: 'none',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e: any) => e.currentTarget.style.color = '#888'}
          onMouseOut={(e: any) => e.currentTarget.style.color = '#555'}
        >
          Terminate Session
        </button>
      </div>
    </div>
  );
};

export default UnlicensedScreen;
