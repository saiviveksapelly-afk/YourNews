const AUTH_TOKEN_KEY = 'authToken';

export function saveAuthToken(token: string) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}
