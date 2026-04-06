import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/Welcome.css';

interface WelcomeProps {
  onComplete?: () => void;
}

function Welcome({ onComplete }: WelcomeProps) {
  const navigate = useNavigate();
  const [showLogo, setShowLogo] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Show logo first
    const logoTimer = setTimeout(() => {
      setShowLogo(true);
    }, 300);

    // Show text after logo
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 1200);

    // Navigate to next page after animation
    const navigationTimer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
      navigate('/learning');
    }, 3500); // 3.5 seconds total display time

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(textTimer);
      clearTimeout(navigationTimer);
    };
  }, [onComplete, navigate]);

  return (
    <div className="welcome-container">
      <div className={`welcome-content ${showLogo ? 'show' : ''}`}>
        <div className="logo-wrapper">
          <svg className="logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            {/* Circuit board inspired design */}
            <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="3" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="white" strokeWidth="2" opacity="0.7" />
            
            {/* AI Brain representation */}
            <circle cx="100" cy="100" r="45" fill="white" opacity="0.1" />
            <path d="M 70 100 Q 85 70, 100 100 T 130 100" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <path d="M 70 100 Q 85 130, 100 100 T 130 100" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
            
            {/* Gear/Mechanical elements */}
            <circle cx="100" cy="100" r="15" fill="white" />
            <circle cx="100" cy="100" r="8" fill="#667eea" />
            
            {/* Connection nodes */}
            <circle cx="70" cy="70" r="5" fill="white" />
            <circle cx="130" cy="70" r="5" fill="white" />
            <circle cx="70" cy="130" r="5" fill="white" />
            <circle cx="130" cy="130" r="5" fill="white" />
            
            {/* Connecting lines */}
            <line x1="70" y1="70" x2="100" y2="100" stroke="white" strokeWidth="2" opacity="0.5" />
            <line x1="130" y1="70" x2="100" y2="100" stroke="white" strokeWidth="2" opacity="0.5" />
            <line x1="70" y1="130" x2="100" y2="100" stroke="white" strokeWidth="2" opacity="0.5" />
            <line x1="130" y1="130" x2="100" y2="100" stroke="white" strokeWidth="2" opacity="0.5" />
          </svg>
        </div>
        
        <h1 className={`welcome-text ${showText ? 'show' : ''}`}>
          Welcome to AI & Mechatronix Innovation Lab
        </h1>
      </div>
    </div>
  );
}

export default Welcome;
