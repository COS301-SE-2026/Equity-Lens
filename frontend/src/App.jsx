import AppRouter from "./router/AppRouter";

import ThemeToggle from './components/common/ThemeToggle/ThemeToggle.jsx'
import Login from './pages/Auth/Login'
import Footer from './components/Footer'
import Navbar from './components/Navbar'


import {Register} from "/src/pages/Auth/Register.jsx"
function App() {
  return (
    <>
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }}>
       <Navbar />
      {/* This is the Theme toggling button */}
      <ThemeToggle />
        <Login />

          <Footer />
    </div>
    <AppRouter/>
    </>
  )
}
export default App
