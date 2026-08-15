import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import Sidebar from '../components/common/Sidebar/Sidebar';
import Topbar from '../components/common/Topbar/Topbar';
import useAuth from '../hooks/useAuth';
import AIChat from '../pages/AIChat/AIChat';
import Analytics from '../pages/Analytics/Analytics';
import ConfirmEmail from '../pages/Auth/ConfirmEmail';
import Login from '../pages/Auth/Login';
import Register from '../pages/Auth/Register';
import BrandStyleGuide from '../pages/BrandStyleGuide/BrandStyleGuide';
import Dashboard from '../pages/Dashboard/Dashboard';
import Help from '../pages/Help/Help';
import Landing from '../pages/Landing/Landing';
import News from '../pages/News/News';
import NotFound from '../pages/NotFound/NotFound';
import Portfolio from '../pages/Portfolio/Portfolio';
import { ROUTES } from '../utils/constants';

/** @param {{ children: React.ReactNode }} props */
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

/** @param {{ children: React.ReactNode }} props */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  );
  return isAuthenticated ? <AppLayout>{children}</AppLayout> : <Navigate to={ROUTES.LOGIN} replace />;
};

const HelpRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  );
  //signed in
  if (isAuthenticated) {
    return <AppLayout><Help/></AppLayout>
  }
  //signed out
  <div className = "min-h-screen bg-bg-primary p-6">
    <Help/>
  </div>
}

/** @param {{ children: React.ReactNode }} props */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return !isAuthenticated ? children : <Navigate to={ROUTES.DASHBOARD} replace />;
};

export const AppRoutes = () => (
  <Routes>
    <Route path={ROUTES.LOGIN} element={<PublicRoute><Login /></PublicRoute>} />
    <Route path={ROUTES.REGISTER} element={<PublicRoute><Register /></PublicRoute>} />

      <Route path={ROUTES.DASHBOARD} element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path={ROUTES.PORTFOLIO} element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
      <Route path={ROUTES.NEWS} element={<ProtectedRoute><News /></ProtectedRoute>} />
      <Route path={ROUTES.AI_CHAT} element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
      <Route path={ROUTES.ANALYTICS} element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path={ROUTES.CONFIRM_EMAIL} element={<PublicRoute><ConfirmEmail /></PublicRoute>} />
      <Route path={ROUTES.HELP} element={<HelpRoute />} />

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