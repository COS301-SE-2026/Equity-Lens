/*Base case so needs seperate file, not just a generic button*/ 
import { useTheme } from '../../../context/ThemeContext.jsx'

function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="px-4 py-2 border rounded bg-gray-200 hover:bg-gray-300"
    >
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}

export default ThemeToggle
