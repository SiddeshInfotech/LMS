import { useState } from 'react';
import LoginImages from '../assets/images/login/Login_Images.png';
import { useNavigate } from 'react-router-dom';
import '../css/Login.css';
import Welcome from './Welcome';

interface LoginProps {
  onLoginSuccess?: () => void;
}

function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check credentials
    if (email === 'admin@gmail.com' && password === '123') {
      console.log('Login successful!');
      setIsLoggedIn(true);
    } else {
      console.log('Login failed: Invalid credentials');
      alert('Invalid email or password. Please try again.');
    }
  };

  const handleWelcomeComplete = () => {
    if (onLoginSuccess) {
      onLoginSuccess();
    }
    navigate('/learning');
  };

  if (isLoggedIn) {
    return <Welcome onComplete={handleWelcomeComplete} />;
  }

  return (
    <div className="login-split-container">
      <div className="login-left">
        <div className="login-box">
          <h1>Welcome</h1>
          <p className="login-subtitle">Please login to your account</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            <button type="submit" className="login-button">
              Login
            </button>
          </form>
          <div className="login-footer">
            <a href="#" className="forgot-password">Forgot Password?</a>
          </div>
        </div>
      </div>
      <div className="login-right"> 
        <img src={LoginImages} alt="Login Visual" className="login-image-full" /> 
      </div> 
    </div>
  );
}

export default Login;
// 🎥, ❓, 📝