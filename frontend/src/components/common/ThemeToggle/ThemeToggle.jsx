/*Base case so needs seperate file, not just a generic button*/
import { useTheme } from '../../../context/ThemeContext.jsx'

function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button onClick={toggle} className="p-2">
      <img
        src={dark ? '/assets/dark.png' : '/assets/light.png'}
        alt={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="w-8 h-8"
      />
    </button>
  )
}

export default ThemeToggle
