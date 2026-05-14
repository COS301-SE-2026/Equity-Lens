import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRouter from './router/AppRouter';
import './styles/globals.css';

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </ThemeProvider>
);

export default App;
