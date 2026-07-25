import { useState } from 'react';
import { AlertCircle, User, Lock, ArrowRight } from 'lucide-react';
import { loginRequest } from '../api.js';

export default function LoginSection({ active, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [showError, setShowError] = useState(false);

  async function submitLogin(e) {
    e.preventDefault();
    setShowError(false);

    try {
      const { ok, data } = await loginRequest(username.trim(), password);
      if (ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        setErrorText(data.message || 'Invalid username or password');
        setShowError(true);
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorText('Server error. Please try again.');
      setShowError(true);
    }
  }

  return (
    <section id="login-section" className={`view-section ${active ? 'active' : ''}`}>
      <div className="login-container">
        <div className="login-card glass-panel animate-slide-up">
          <img src="/hits_campus.jpg" alt="HITS Campus" className="login-hero-img" />
          <div className="login-header">
            <h2>HITS Attendance Login</h2>
            <p>Sign in to access Hindustan University portals</p>
          </div>

          <div className="login-error-msg" id="login-error" style={{ display: showError ? 'flex' : 'none' }}>
            <AlertCircle style={{ width: 16 }} />
            <span id="login-error-text">{errorText}</span>
          </div>

          <form id="login-form" onSubmit={submitLogin}>
            <div className="form-group">
              <label htmlFor="login-username">Teacher / HOD Username</label>
              <div className="input-with-icon">
                <User />
                <input
                  type="text"
                  id="login-username"
                  placeholder="e.g. teacher1, hod1"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="input-with-icon">
                <Lock />
                <input
                  type="password"
                  id="login-password"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-btn">
              <span>Sign In</span>
              <ArrowRight />
            </button>
          </form>

          <div className="demo-accounts-helper">
            <strong>Demo Accounts (for testing):</strong>
            <ul>
              <li>
                Teacher 1: <code>teacher1</code> / <code>password</code>
              </li>
              <li>
                Teacher 2: <code>teacher2</code> / <code>password</code>
              </li>
              <li>
                HOD: <code>hod1</code> / <code>password</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
