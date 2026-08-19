import { useThemeContext } from '../../../context/ThemeContext.jsx'

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeContext()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="theme-toggle"
    >
      <img
        src={isDark ? '/assets/dark.png' : '/assets/light.png'}
        alt=""
      />
    </button>
  )
}

export default ThemeToggle