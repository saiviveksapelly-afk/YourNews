import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import './AuthPage.css';
import { saveAuthToken } from '../auth/authToken.ts';
import { getConnectionErrorMessage, getRegistrationErrorMessage } from '../auth/authMessages.ts';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setMessage(getRegistrationErrorMessage(response.status));
        return;
      }

      const data = (await response.json()) as { token?: unknown };

      if (typeof data.token !== 'string' || !data.token) {
        setMessage('Your account may be created, but we could not sign you in. Please try signing in.');
        return;
      }

      saveAuthToken(data.token);
      navigate('/catalog', {
        replace: true,
        state: { notice: 'Your account is ready. Welcome to News!' },
      });
    } catch {
      setMessage(getConnectionErrorMessage());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page sky-page">
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
          Create an account to follow the latest technology headlines and ideas.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {message && <p className="login-message is-error" role="alert">{message}</p>}
          <label className="login-field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h14.5A1.75 1.75 0 0 1 21 6.75v10.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25V6.75Zm1.8-.25 7.2 5.4 7.2-5.4" />
            </svg>
            <input
              type="email"
              placeholder="Email"
              aria-label="Email"
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

          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
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
