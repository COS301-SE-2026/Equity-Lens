import { useThemeContext } from '../../../context/ThemeContext.jsx'

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeContext()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      role="switch"
      aria-checked={isDark}
      className="theme-toggle"
      style={{
        position: 'relative',
        width: '40px',
        height: '22px',
        borderRadius: '999px',
        border: '1px solid var(--border-subtle,rgba(255,255,255,0.10))',
        background: isDark
          ? 'var(--accent-primary,#FF6A00)'
          : 'var(--border-subtle,rgba(255,255,255,0.10))',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 150ms ease-out',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: isDark ? '20px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: 'var(--bg-primary,#0a0a0a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'left 150ms ease-out',
        }}
      > 
      <img
        src={isDark ? '/assets/dark.png' : '/assets/light.png'}
        alt=""
        style={{ width: '16px', height: '16px' }}
      />
      </span>
    </button>
  )
}

export default ThemeToggle