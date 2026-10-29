import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import './AuthPage.css';
import { clearAuthToken } from '../auth/authToken.ts';
import { getConnectionErrorMessage, getRegistrationErrorMessage } from '../auth/authMessages.ts';
import { useAuthTheme } from '../auth/useAuthTheme.ts';

function getPasswordProblem(password: string): string {
  if (password.length < 10) return 'Use at least 10 characters.';
  if (!/[A-Z]/.test(password)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Add at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Add at least one number.';
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'Add at least one special character.';
  if (new TextEncoder().encode(password).length > 72) return 'Use a password no longer than 72 bytes.';
  return '';
}

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isNightTheme, toggleTheme } = useAuthTheme();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const passwordProblem = getPasswordProblem(password);
    if (passwordProblem) {
      setMessage(passwordProblem);
      return;
    }
    if (password !== confirmPassword) {
      setMessage('The passwords do not match. Check both password fields and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        setMessage(getRegistrationErrorMessage(response.status));
        return;
      }

      clearAuthToken();
      navigate('/login', {
        replace: true,
        state: { notice: 'Your account has been created. Please sign in.' },
      });
    } catch {
      setMessage(getConnectionErrorMessage());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`login-page sky-page ${isNightTheme ? 'theme-night' : 'theme-day'}`}>
      <button
        className="auth-theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-pressed={isNightTheme}
      >
        {isNightTheme ? 'Day mode' : 'Night mode'}
      </button>
      <Link className="login-brand" to="/login" aria-label="News home">
        <span className="brand-name">News</span>
        <span className="brand-tagline">News at your doorstep</span>
      </Link>

      <section className="login-card" aria-labelledby="register-heading">
        <div className="login-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M16 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-11 10a11 11 0 0 1 22 0M25 8v8m-4-4h8" />
          </svg>
        </div>

        <h1 id="register-heading">Create your account</h1>
        <p className="login-subtitle">
          Create an account to follow the latest headlines and stories.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {message && <p className="login-message is-error" role="alert">{message}</p>}

          <label className="login-field">
            <input
              type="text"
              placeholder="Username"
              aria-label="Username"
              autoComplete="username"
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              title="Use 3–30 letters, numbers, or underscores."
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h14.5A1.75 1.75 0 0 1 21 6.75v10.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25V6.75Zm1.8-.25 7.2 5.4 7.2-5.4" />
            </svg>
            <input
              type="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5V10Zm7 4v3" />
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              aria-label="Password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((isVisible) => !isVisible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </label>
          <p className="password-guidance">
            Use at least 10 characters, including uppercase and lowercase letters, a number, and a special character.
          </p>

          <label className="login-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5V10Zm7 4v3" />
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              aria-label="Confirm password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="login-register-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;
