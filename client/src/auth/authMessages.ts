export function getLoginErrorMessage(status: number) {
  if (status === 400) {
    return 'Enter a valid email address and password.';
  }

  if (status === 401) {
    return 'Those details did not match an account. Check them or create an account.';
  }

  return 'We could not sign you in right now. Please try again shortly.';
}

export function getRegistrationErrorMessage(status: number) {
  if (status === 400) {
    return 'Check your email and password, then try again. Choose a shorter password if it is very long.';
  }

  if (status === 409) {
    return 'An account with this email already exists. Sign in or use a different email address.';
  }

  return 'We could not create your account right now. Please try again shortly.';
}

export function getConnectionErrorMessage() {
  return 'We could not reach News right now. Check your connection and try again.';
}
