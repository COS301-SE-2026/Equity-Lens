import AppRouter from "./router/AppRouter";

function App() {
  return <AppRouter />;
}

export default App;
import ThemeToggle from './components/common/ThemeToggle/ThemeToggle.jsx'

function App() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <h1>EquityLens</h1>
      <p>Frontend running</p>
      {/* This is the Theme toggling button */}
      <ThemeToggle />
    </div>
  )
}
export default App
