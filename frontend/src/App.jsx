import AppRouter from "./router/AppRouter";

import ThemeToggle from './components/common/ThemeToggle/ThemeToggle.jsx'

import {Register} from "/src/pages/Auth/Register.jsx"
function App() {
  return (
    <>
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <h1>EquityLens</h1>
      <p>Frontend running</p>
    </div>
    <AppRouter/>
    </>
  )
}
export default App
