import { useEffect, useState } from 'react';

export function useAuthTheme() {
  const [isNightTheme, setIsNightTheme] = useState(
    () => localStorage.getItem('auth-theme') === 'night',
  );

  useEffect(() => {
    localStorage.setItem('auth-theme', isNightTheme ? 'night' : 'day');
  }, [isNightTheme]);

  function toggleTheme() {
    setIsNightTheme((currentTheme) => !currentTheme);
  }

  return { isNightTheme, toggleTheme };
}
