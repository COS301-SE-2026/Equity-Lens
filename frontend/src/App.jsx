import ThemeToggle from './components/common/ThemeToggle/ThemeToggle.jsx'
import Login from './pages/Auth/Login'
import Footer from './components/Footer'
import Navbar from './components/Navbar'


function App() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }}>
       <Navbar />
      {/* This is the Theme toggling button */}
      <ThemeToggle />
        <Login />

          <Footer />
    </div>
  )
}
export default App
