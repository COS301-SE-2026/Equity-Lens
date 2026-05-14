/*Base case so needs seperate file, not just a generic button*/
import { useTheme } from '../../../context/ThemeContext.jsx'
import '../../../styles/components/ThemeToggle.css'

function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="theme-toggle"
    >
      <img
        src={dark ? '/assets/dark.png' : '/assets/light.png'}
        alt=""
      />
    </button>
  )
}

export default ThemeToggle
