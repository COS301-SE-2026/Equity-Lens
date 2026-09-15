import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { BlurProvider } from './context/BlurContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRouter from './router/AppRouter';
import './styles/globals.css';

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <BlurProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BlurProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
