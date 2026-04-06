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

      const status = await (window as any).electronAPI.getLicenseStatus();
      if (!status.valid) {
        navigate('/unlicensed');
      }
      setIsChecking(false);
    };

    checkLicense();
    const interval = setInterval(checkLicense, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [location.pathname, navigate]);

  if (isChecking) return <div style={{ background: '#1a1a2e', height: '100vh' }} />;
  return <>{children}</>;
}

function App() {
  return (
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
  );
}

export default App
