import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { BlurProvider } from './context/BlurContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
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
