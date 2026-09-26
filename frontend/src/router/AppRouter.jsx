import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import AuthLayout from '../components/auth/AuthLayout/AuthLayout';
import ChatDock from '../components/chat/ChatDock/ChatDock';
import CardErrorBoundary from '../components/common/ErrorBoundary/CardErrorBoundary';
import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import Sidebar from '../components/common/Sidebar/Sidebar';
import Topbar from '../components/common/Topbar/Topbar';
import { ChatProvider } from '../context/ChatContext';
import useAuth from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
/** @param {() => Promise<any>} importer */
export const lazyWithRetry = (importer) =>
  lazy(() =>
    importer().catch(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 400);
      });
      return importer().catch(() => {
        window.location.reload();
        return /** @type {Promise<any>} */ (new Promise(() => {})); // never settles; the reload takes over
      });
    }),
  );

const Login = lazyWithRetry(() => import('../pages/Auth/Login'));
const Register = lazyWithRetry(() => import('../pages/Auth/Register'));
const Dashboard = lazyWithRetry(() => import('../pages/Dashboard/Dashboard'));
const Portfolio = lazyWithRetry(() => import('../pages/Portfolio/Portfolio'));
const NotFound = lazyWithRetry(() => import('../pages/NotFound/NotFound'));
const News = lazyWithRetry(() => import('../pages/News/News'));
const AIChat = lazyWithRetry(() => import('../pages/AIChat/AIChat'));
const Help = lazyWithRetry(() => import('../pages/Help/Help'));
const Analytics = lazyWithRetry(() => import('../pages/Analytics/Analytics'));
const ConfirmEmail = lazyWithRetry(() => import('../pages/Auth/ConfirmEmail'));
const ForgotPassword = lazyWithRetry(() => import('../pages/Auth/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('../pages/Auth/ResetPassword'));
const Landing = lazyWithRetry(() => import('../pages/Landing/Landing'));
const BrandStyleGuide = lazyWithRetry(() => import('../pages/BrandStyleGuide/BrandStyleGuide'));
const Settings = lazyWithRetry(() => import('../pages/Settings/Settings'));

/** @param {{ children: React.ReactNode }} props */
const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  return (
    <ChatProvider>
      <div data-testid="app-layout" className="flex flex-col h-screen overflow-hidden">
        <a
          href="#main-content"
          className="sr-only rounded-full px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
          style={{
            background: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          Skip to main content
        </a>
        <Topbar onMenuClick={() => setSidebarOpen((open) => !open)} sidebarOpen={sidebarOpen} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main id="main-content" className="flex-1 overflow-auto p-4">
          <CardErrorBoundary key={pathname} label="This page">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24">
                  <LoadingSpinner size="lg" />
                </div>
              }
            >
              {children}
            </Suspense>
          </CardErrorBoundary>
        </main>
        <ChatDock />
      </div>
    </ChatProvider>
  );
};

/**
 * @param {{ children: React.ReactNode, publicFallback?: React.ReactNode }} props
 */
const ProtectedRoute = ({ children, publicFallback }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading)
    return (
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
  <Suspense
    fallback={
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    }
  >
    <Routes>
      <Route
        path={ROUTES.LOGIN}
        element={
          <PublicRoute>
            <AuthLayout>
              <Login />
            </AuthLayout>
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.REGISTER}
        element={
          <PublicRoute>
            <AuthLayout>
              <Register />
            </AuthLayout>
          </PublicRoute>
        }
      />

      <Route
        path={ROUTES.DASHBOARD}
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.PORTFOLIO}
        element={
          <ProtectedRoute>
            <Portfolio />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.NEWS}
        element={
          <ProtectedRoute>
            <News />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.AI_CHAT}
        element={
          <ProtectedRoute>
            <AIChat />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.ANALYTICS}
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.CONFIRM_EMAIL}
        element={
          <PublicRoute>
            <ConfirmEmail />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.FORGOT_PASSWORD}
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.RESET_PASSWORD}
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />
      <Route
        path={ROUTES.HELP}
        element={
          <ProtectedRoute
            publicFallback={
              <div className="min-h-screen bg-bg-primary p-6">
                <Help />
              </div>
            }
          >
            <Help />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.SETTINGS}
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route path={ROUTES.HOME} element={<Landing />} />
      <Route path={ROUTES.BRAND_GUIDE} element={<BrandStyleGuide />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const AppRouter = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default AppRouter;
