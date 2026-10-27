import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { clearAuthToken, getAuthToken } from '../auth/authToken.ts';

type ProtectedRouteProps = {
  children: ReactNode;
};

type AccessStatus = 'checking' | 'allowed' | 'signed-out' | 'connection-error';

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<AccessStatus>(() =>
    sessionStorage.getItem('authToken') ? 'checking' : 'signed-out',
  );
  const [retryNumber, setRetryNumber] = useState(0);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      return;
    }

    let requestIsCurrent = true;

    async function verifyToken() {
      try {
        const response = await fetch('/api/auth/check', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!requestIsCurrent) return;

        if (response.status === 401) {
          clearAuthToken();
          setStatus('signed-out');
          return;
        }

        if (!response.ok) {
          setStatus('connection-error');
          return;
        }

        setStatus('allowed');
      } catch {
        if (requestIsCurrent) setStatus('connection-error');
      }
    }

    void verifyToken();

    return () => {
      requestIsCurrent = false;
    };
  }, [retryNumber]);

  if (status === 'signed-out') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ notice: 'Please sign in to view the news catalog.' }}
      />
    );
  }

  if (status === 'connection-error') {
    return (
      <main className="auth-check-message">
        <p>We could not check your sign-in right now. Please try again.</p>
        <button type="button" onClick={() => setRetryNumber((number) => number + 1)}>
          Try again
        </button>
      </main>
    );
  }

  if (status === 'checking') {
    return <main className="auth-check-message">Checking your sign-in…</main>;
  }

  return children;
}

export default ProtectedRoute;
