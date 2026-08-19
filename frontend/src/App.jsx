import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import './styles/globals.css';

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
