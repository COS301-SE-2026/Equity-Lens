import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AppRouter from './AppRouter';

vi.mock('../hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../pages/Auth/Login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('../pages/Auth/Register', () => ({ default: () => <div>Register Page</div> }));
vi.mock('../pages/Dashboard/Dashboard', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('../pages/Portfolio/Portfolio', () => ({ default: () => <div>Portfolio Page</div> }));
vi.mock('../pages/News/News', () => ({ default: () => <div>News Page</div> }));
vi.mock('../pages/AIChat/AIChat', () => ({ default: () => <div>AIChat Page</div> }));
vi.mock('../pages/NotFound/NotFound', () => ({ default: () => <div>Not Found Page</div> }));

vi.mock('../components/common/Sidebar/Sidebar', () => ({ default: () => <div>Sidebar</div> }));
vi.mock('../components/common/Topbar/Topbar', () => ({ default: () => <div>Topbar</div> }));
vi.mock('../components/common/LoadingSpinner/LoadingSpinner', () => ({
  default: () => <div>Loading...</div>,
}));

vi.mock('../utils/constants', () => ({
  ROUTES: {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    DASHBOARD: '/dashboard',
    PORTFOLIO: '/portfolio',
    NEWS: '/news',
    AI_CHAT: '/ai-chat',
  },
}));

import useAuth from '../hooks/useAuth';

const renderAtRoute = (route) => {
  window.history.pushState({}, '', route);
  return render(<AppRouter />);
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', '/');
});

describe('AppRouter', () => {

  describe('loading state', () => {
  it('renders nothing when auth is loading on public route', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: true });
    renderAtRoute('/login');
    expect(document.body.innerHTML).toBe('<div></div>');
  });
  });

  describe('public routes', () => {
    it('renders login page at /login when not authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
      renderAtRoute('/login');
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeDefined();
      });
    });

    it('renders register page at /register when not authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
      renderAtRoute('/register');
      await waitFor(() => {
        expect(screen.getByText('Register Page')).toBeDefined();
      });
    });

    it('redirects authenticated user from /login to dashboard', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
      renderAtRoute('/login');
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeDefined();
      });
    });

    it('redirects authenticated user from /register to dashboard', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
      renderAtRoute('/register');
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeDefined();
      });
    });
  });

  describe('protected routes', () => {
    it('renders dashboard when authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
      renderAtRoute('/dashboard');
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeDefined();
      });
    });

    it('renders portfolio when authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
      renderAtRoute('/portfolio');
      await waitFor(() => {
        expect(screen.getByText('Portfolio Page')).toBeDefined();
      });
    });

    it('renders news when authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
      renderAtRoute('/news');
      await waitFor(() => {
        expect(screen.getByText('News Page')).toBeDefined();
      });
    });

    it('renders ai-chat when authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
      renderAtRoute('/ai-chat');
      await waitFor(() => {
        expect(screen.getByText('AIChat Page')).toBeDefined();
      });
    });

    it('redirects unauthenticated user from /dashboard to login', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
      renderAtRoute('/dashboard');
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeDefined();
      });
    });

    it('redirects unauthenticated user from /portfolio to login', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
      renderAtRoute('/portfolio');
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeDefined();
      });
    });

    it('redirects unauthenticated user from /news to login', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
      renderAtRoute('/news');
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeDefined();
      });
    });

    it('shows sidebar and topbar for authenticated protected routes', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
      renderAtRoute('/dashboard');
      await waitFor(() => {
        expect(screen.getByText('Sidebar')).toBeDefined();
        expect(screen.getByText('Topbar')).toBeDefined();
      });
    });
  });

  describe('root and not found routes', () => {
    it('redirects / to /login when not authenticated', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
      renderAtRoute('/');
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeDefined();
      });
    });

    it('renders not found page for unknown route', async () => {
      useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
      renderAtRoute('/this-route-does-not-exist');
      await waitFor(() => {
        expect(screen.getByText('Not Found Page')).toBeDefined();
      });
    });
  });
});