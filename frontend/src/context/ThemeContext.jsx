import { createContext, useContext, useState, useEffect } from 'react';
import { THEME_KEY } from '../utils/constants';

/**@type {any} */
const ThemeContext = createContext(null);

/**
 * @param {Object} object
 * @param {*} object.children
*/
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const painted = document.documentElement.getAttribute('data-theme');
    if (painted === 'light' || painted === 'dark') return painted;

    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {//
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeContext must be used within ThemeProvider');
  return context;
};