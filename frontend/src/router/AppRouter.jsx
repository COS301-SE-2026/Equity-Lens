import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import useAuth from '../hooks/useAuth';
import { ChatProvider } from '../context/ChatContext';
import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import Sidebar from '../components/common/Sidebar/Sidebar';
import Topbar from '../components/common/Topbar/Topbar';
import AuthLayout from '../components/auth/AuthLayout/AuthLayout';
import Login from '../pages/Auth/Login';
import Register from '../pages/Auth/Register';
import Dashboard from '../pages/Dashboard/Dashboard';
import Portfolio from '../pages/Portfolio/Portfolio';
import NotFound from '../pages/NotFound/NotFound';
import News from '../pages/News/News';
import AIChat from '../pages/AIChat/AIChat';
import Help from '../pages/Help/Help';
// import HelpLandingPage from '../pages/HelpLandingPage/HelpLandingPage';
import { ROUTES } from '../utils/constants';
import Analytics from '../pages/Analytics/Analytics';
import ConfirmEmail from '../pages/Auth/ConfirmEmail';
import ForgotPassword from '../pages/Auth/ForgotPassword';
import ResetPassword from '../pages/Auth/ResetPassword';
import Landing from '../pages/Landing/Landing';
import BrandStyleGuide from '../pages/BrandStyleGuide/BrandStyleGuide';
import Settings from '../pages/Settings/Settings';

/** @param {{ children: React.ReactNode }} props */
const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <ChatProvider>
      <div data-testid="app-layout" className="flex flex-col h-screen overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen((open) => !open)} sidebarOpen={sidebarOpen} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </ChatProvider>
  );
};

/**
* @param {{ children: React.ReactNode, publicFallback?: React.ReactNode }} props
 */
const ProtectedRoute = ({ children, publicFallback }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  );
  if (isAuthenticated) return <AppLayout>{children}</AppLayout>;
  return publicFallback ?? <Navigate to={ROUTES.LOGIN} replace />;
};

/** @param {{ children: React.ReactNode }} props */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return !isAuthenticated ? children : <Navigate to={ROUTES.DASHBOARD} replace />;
};

export const AppRoutes = () => (
  <Routes>
    <Route path={ROUTES.LOGIN} element={<PublicRoute><AuthLayout><Login /></AuthLayout></PublicRoute>} />
    <Route path={ROUTES.REGISTER} element={<PublicRoute><AuthLayout><Register /></AuthLayout></PublicRoute>} />

      <Route path={ROUTES.DASHBOARD} element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path={ROUTES.PORTFOLIO} element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
      <Route path={ROUTES.NEWS} element={<ProtectedRoute><News /></ProtectedRoute>} />
      <Route path={ROUTES.AI_CHAT} element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
      <Route path={ROUTES.ANALYTICS} element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path={ROUTES.CONFIRM_EMAIL} element={<PublicRoute><ConfirmEmail /></PublicRoute>} />
      <Route path={ROUTES.FORGOT_PASSWORD} element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path={ROUTES.RESET_PASSWORD} element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route
        path={ROUTES.HELP}
        element={
          <ProtectedRoute publicFallback={<div className="min-h-screen bg-bg-primary p-6"><Help /></div>}>
            <Help />
          </ProtectedRoute>}/>
      {/* <Route path="/help-landing" element={<HelpLandingPage />} /> */}
      <Route path={ROUTES.SETTINGS} element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path={ROUTES.HOME} element={<Landing />} />  
      <Route path={ROUTES.BRAND_GUIDE} element={<BrandStyleGuide />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
);

const AppRouter = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default AppRouter;