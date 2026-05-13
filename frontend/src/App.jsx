import { useState, useEffect } from 'react'

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setDark(d => !d)

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
