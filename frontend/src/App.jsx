import { useState } from 'react'

function App() {
  const [dark, setDark] = useState(false)

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <h1>EquityLens</h1>
      <p>Frontend running</p>
      <button
        onClick={toggle}
        className="px-4 py-2 border rounded bg-gray-200 hover:bg-gray-300"
      >
        {dark ? 'Light mode' : 'Dark mode'}
      </button>
    </div>
  )
}
export default App
