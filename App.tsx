import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SecurityProvider } from '@/context/security-context';
import SecurityWrapper from '@/security/SecurityWrapper';
import Login from '@/pages/Login';
import LearningOptions from '@/pages/LearningOptions';
import CoursesPage from '@/pages/CoursesPage';
import Welcome from '@/pages/Welcome';
import FaqsPage from '@/pages/FaqsPage';
import UnlicensedScreen from '@/pages/UnlicensedScreen';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';

function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkLicense = async () => {
      if (location.pathname === '/unlicensed') {
        setIsChecking(false);
        return;
      }

      if (!(window as any).electronAPI) {
        console.warn('RENDERER: Electron API missing. Assuming Dev/Browser mode.');
        setIsChecking(false);
        return;
      }

      try {
        const status = await (window as any).electronAPI.getLicenseStatus();
        console.log('🛡️ [SHIELD] License Status:', status);
        if (!status.valid) {
          console.warn('🛡️ [SHIELD] Access Denied. Redirecting to Wizard...');
          navigate('/unlicensed');
        } else {
          setIsChecking(false);
        }
      } catch (err) {
        console.error('🛡️ [SHIELD] Check Failed:', err);
        navigate('/unlicensed');
      }
    };

    checkLicense();
    const interval = setInterval(checkLicense, 10000); // Check every 10s

    // GLOBAL NAVIGATION LOCK: Prevent keyboard focus jumping (Tab key)
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        console.warn('RENDERER: Tab key blocked (Mouse-only mode enabled)');
      }
    };
    window.addEventListener('keydown', handleTabKey);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleTabKey);
    };
  }, [location.pathname, navigate]);

  if (isChecking) return <div style={{ background: '#1a1a2e', height: '100vh' }} />;
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <SecurityProvider>
          <SecurityWrapper>
            <SubscriptionGuard>
              <Routes>
                <Route path="/" element={<Login onLoginSuccess={() => { }} />} />
                <Route path="/unlicensed" element={<UnlicensedScreen />} />
                <Route path="/welcome" element={<Welcome onComplete={() => { }} />} />
                <Route path="/learning" element={
                  <LearningOptions
                    onStartLearning={() => { }}
                    onResumeLearning={() => { }}
                  />
                } />
                <Route path="/courses" element={<CoursesPage onHome={() => { }} />} />
                <Route path="/faqs" element={<FaqsPage />} />
              </Routes>
            </SubscriptionGuard>
          </SecurityWrapper>
        </SecurityProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App
