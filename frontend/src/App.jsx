import ThemeToggle from './components/common/ThemeToggle/ThemeToggle.jsx'
import Login from './pages/Auth/Login'


function App() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <h1>EquityLens</h1>
      <p>Frontend running</p>
      {/* This is the Theme toggling button */}
      <ThemeToggle />
        <Login />
    </div>
  )
}
export default App
