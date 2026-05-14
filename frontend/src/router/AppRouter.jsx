import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import useAuth from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import Sidebar from '../components/common/Sidebar/Sidebar';
import Topbar from '../components/common/Topbar/Topbar';
import Login from '../pages/Auth/Login';
import Register from '../pages/Auth/Register';
import Dashboard from '../pages/Dashboard/Dashboard';
import Portfolio from '../pages/Portfolio/Portfolio';
import Analytics from '../pages/Analytics/Analytics';
import AIChat from '../pages/AIChat/AIChat';
import NotFound from '../pages/NotFound/NotFound';
import { ROUTES } from '../utils/constants';

const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  return isAuthenticated ? <AppLayout>{children}</AppLayout> : <Navigate to={ROUTES.LOGIN} replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  return !isAuthenticated ? children : <Navigate to={ROUTES.DASHBOARD} replace />;
};

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path={ROUTES.LOGIN} element={<PublicRoute><Login /></PublicRoute>} />
      <Route path={ROUTES.REGISTER} element={<PublicRoute><Register /></PublicRoute>} />
      
      <Route path={ROUTES.DASHBOARD} element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path={ROUTES.PORTFOLIO} element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
      <Route path={ROUTES.ANALYTICS} element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path={ROUTES.AI_CHAT} element={<ProtectedRoute><AIChat /></ProtectedRoute>} />

      <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.LOGIN} replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
