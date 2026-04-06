import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/LearningOptions.css';

interface LearningOptionsProps {
  onStartLearning?: () => void;
  onResumeLearning?: () => void;
}

function LearningOptions({ onStartLearning, onResumeLearning }: LearningOptionsProps) {
  const navigate = useNavigate();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleStartLearning = () => {
    console.log('Start Learning clicked');
    // Clear any previous progress
    localStorage.removeItem('completedVideos');
    localStorage.removeItem('lastWatchedVideoId');
    if (onStartLearning) {
      onStartLearning();
    }
    navigate('/courses');
  };

  const handleResumeLearning = () => {
    console.log('Resume Learning clicked');
    if (onResumeLearning) {
      onResumeLearning();
    }
    navigate('/courses');
  };

  const handleLogout = () => {
    console.log('Security logout initiated. Closing application.');
    if (window.electronAPI?.exitApp) {
      window.electronAPI.exitApp();
    } else {
      // Fallback for browser testing
      navigate('/');
    }
  };

  return (
    <div className="learning-options-container">
      <button 
        className="logout-button"
        onClick={handleLogout}
        style={{ position: 'absolute', top: 24, right: 32, zIndex: 10 }}
      >
        Log Out
      </button>
      <div className={`learning-options-content ${showContent ? 'show' : ''}`}>
        <h1 className="title">Choose Your Path</h1>
        <div className="buttons-container">
          <button 
            className="learning-button start-learning"
            onClick={handleStartLearning}
          >
            <div className="button-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="button-text">Start Learning</span>
            <p className="button-description">Begin your journey from the basics</p>
          </button>
          <button 
            className="learning-button resume-learning"
            onClick={handleResumeLearning}
          >
            <div className="button-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="button-text">Resume Learning</span>
            <p className="button-description">Continue where you left off</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LearningOptions;
