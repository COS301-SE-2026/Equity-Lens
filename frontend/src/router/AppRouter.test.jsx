import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ROUTES } from '../utils/constants';

const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({ default: () => mockUseAuth() }));
vi.mock('../pages/Landing/Landing', () => ({ default: () => <div>Landing Page</div> }));
vi.mock('../pages/Auth/Login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('../pages/Auth/Register', () => ({ default: () => <div>Register Page</div> }));
vi.mock('../pages/Auth/ConfirmEmail', () => ({ default: () => <div>ConfirmEmail Page</div> }));
vi.mock('../pages/Dashboard/Dashboard', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('../pages/Portfolio/Portfolio', () => ({ default: () => <div>Portfolio Page</div> }));
vi.mock('../pages/News/News', () => ({ default: () => <div>News Page</div> }));
vi.mock('../pages/AIChat/AIChat', () => ({ default: () => <div>AIChat Page</div> }));
vi.mock('../pages/Analytics/Analytics', () => ({ default: () => <div>Analytics Page</div> }));
vi.mock('../pages/NotFound/NotFound', () => ({ default: () => <div>NotFound Page</div> }));

vi.mock('../components/common/Sidebar/Sidebar', () => ({ default: () => <div data-testid="sidebar">Sidebar</div> }));
vi.mock('../components/common/Topbar/Topbar', () => ({ default: () => <div data-testid="topbar">Topbar</div> }));
vi.mock('../components/common/LoadingSpinner/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Loading...</div>,
}));

import { AppRoutes } from './AppRouter';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, loading: false });
});

describe('landing route', () => {
  it('renders landing when unauthenticated', () => {
    renderAt('/');
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });

  it('renders when authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt('/');
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });
  });

describe('public routes', () => {
  it('renders Login when unauthenticated', () => {
    renderAt(ROUTES.LOGIN);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders Register when unauthenticated', () => {
    renderAt(ROUTES.REGISTER);
    expect(screen.getByText('Register Page')).toBeInTheDocument();
  });

  it('renders ConfirmEmail when unauthenticated', () => {
    renderAt(ROUTES.CONFIRM_EMAIL);
    expect(screen.getByText('ConfirmEmail Page')).toBeInTheDocument();
  });

  it('redirects Login to Dashboard when authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt(ROUTES.LOGIN);
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});

describe('protected routes', () => {
  const cases = [
    { route: ROUTES.DASHBOARD, page: 'Dashboard Page' },
    { route: ROUTES.PORTFOLIO, page: 'Portfolio Page' },
    { route: ROUTES.NEWS, page: 'News Page' },
    { route: ROUTES.AI_CHAT, page: 'AIChat Page' },
    { route: ROUTES.ANALYTICS, page: 'Analytics Page' },
  ];

  it.each(cases)('renders $page at $route when authenticated', ({ route, page }) => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt(route);
    expect(screen.getByText(page)).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it.each(cases)('redirects $route to Login when unauthenticated', ({ route }) => {
    renderAt(route);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('shows loading spinner while auth resolves', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, loading: true });
    renderAt(ROUTES.DASHBOARD);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});

describe('not found', () => {
  it('renders NotFound for unknown routes', () => {
    renderAt('/definitely-not-a-route');
    expect(screen.getByText('NotFound Page')).toBeInTheDocument();
  });

  it('falls through to NotFound at /help (Help page not built yet)', () => {
    renderAt(ROUTES.HELP);
    expect(screen.getByText('NotFound Page')).toBeInTheDocument();
  });
});