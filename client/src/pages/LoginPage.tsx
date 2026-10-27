import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import './AuthPage.css';
import { saveAuthToken } from '../auth/authToken.ts';
import { getConnectionErrorMessage, getLoginErrorMessage } from '../auth/authMessages.ts';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const routeNotice = (location.state as { notice?: string } | null)?.notice;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setMessage(getLoginErrorMessage(response.status));
        return;
      }

      const data = (await response.json()) as { token?: unknown };

      if (typeof data.token !== 'string' || !data.token) {
        setMessage('We could not complete your sign-in. Please try again.');
        return;
      }

      saveAuthToken(data.token);
      navigate('/catalog', {
        replace: true,
        state: { notice: 'Signed in successfully. Welcome back!' },
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

      <section className="login-card" aria-labelledby="login-heading">
        <div className="login-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M18 7h7v18h-7M4 16h16m-6-6 6 6-6 6" />
          </svg>
        </div>

        <h1 id="login-heading">Sign in with email</h1>
        <p className="login-subtitle">
          Sign in to discover the latest technology news, ideas, and breakthroughs.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {routeNotice && <p className="login-message" role="status">{routeNotice}</p>}
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
            {isSubmitting ? 'Signing in…' : 'Get Started'}
          </button>
        </form>

        <p className="login-register-link">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
