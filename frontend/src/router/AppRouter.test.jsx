import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ROUTES } from '../utils/constants';

const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({ default: () => mockUseAuth() }));
vi.mock('../pages/Landing/Landing', () => ({ default: () => <div>Landing Page</div> }));
vi.mock('../pages/Auth/Login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('../pages/Auth/Register', () => ({ default: () => <div>Register Page</div> }));
vi.mock('../pages/Auth/ConfirmEmail', () => ({ default: () => <div>ConfirmEmail Page</div> }));
const pageState = vi.hoisted(() => ({ dashboardThrows: false }));
vi.mock('../pages/Dashboard/Dashboard', () => ({
  default: () => {
    if (pageState.dashboardThrows) throw new Error('this page is broken');
    return <div>Dashboard Page</div>;
  },
}));
vi.mock('../pages/Portfolio/Portfolio', () => ({ default: () => <div>Portfolio Page</div> }));
vi.mock('../pages/News/News', () => ({ default: () => <div>News Page</div> }));
vi.mock('../pages/AIChat/AIChat', () => ({ default: () => <div>AIChat Page</div> }));
vi.mock('../pages/Analytics/Analytics', () => ({ default: () => <div>Analytics Page</div> }));
vi.mock('../pages/NotFound/NotFound', () => ({ default: () => <div>NotFound Page</div> }));
vi.mock('../pages/Help/Help', () => ({ default: () => <div>Help Page</div> }));

vi.mock('../components/common/Sidebar/Sidebar', () => ({ default: () => <div data-testid="sidebar">Sidebar</div> }));
vi.mock('../components/common/Topbar/Topbar', () => ({ default: () => <div data-testid="topbar">Topbar</div> }));
vi.mock('../components/common/LoadingSpinner/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Loading...</div>,
}));

vi.mock('../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { AppRoutes } from './AppRouter';

/** @param {string} path */
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
  it('renders landing when unauthenticated', async () => {
    renderAt('/');
    expect(await screen.findByText('Landing Page')).toBeInTheDocument();
  });

  it('renders when authenticated', async () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt('/');
    expect(await screen.findByText('Landing Page')).toBeInTheDocument();
  });
});

describe('public routes', () => {
  it('renders Login when unauthenticated', async () => {
    renderAt(ROUTES.LOGIN);
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('renders Register when unauthenticated', async () => {
    renderAt(ROUTES.REGISTER);
    expect(await screen.findByText('Register Page')).toBeInTheDocument();
  });

  it('renders ConfirmEmail when unauthenticated', async () => {
    renderAt(ROUTES.CONFIRM_EMAIL);
    expect(await screen.findByText('ConfirmEmail Page')).toBeInTheDocument();
  });

  it('redirects Login to Dashboard when authenticated', async () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt(ROUTES.LOGIN);
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
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

  it.each(cases)('renders $page at $route when authenticated', async ({ route, page }) => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt(route);
    expect(await screen.findByText(page)).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('keeps the shell on screen while a page chunk is still loading', async () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt(ROUTES.DASHBOARD);

    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();

    await screen.findByText('Dashboard Page');
  });

  it.each(cases)('redirects $route to Login when unauthenticated', async ({ route }) => {
    renderAt(route);
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('shows loading spinner while auth resolves', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, loading: true });
    renderAt(ROUTES.DASHBOARD);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});

describe('not found', () => {
  it('renders NotFound for unknown routes', async () => {
    renderAt('/definitely-not-a-route');
    expect(await screen.findByText('NotFound Page')).toBeInTheDocument();
  });
});
describe('help route (signed-in and signed-out)', () => {
  it('renders through the same authenticated chrome as every other protected route', async () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    renderAt(ROUTES.HELP);
    expect(await screen.findByText('Help Page')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('renders Help without the authenticated chrome when signed out, instead of redirecting to Login', async () => {
    renderAt(ROUTES.HELP);
    expect(await screen.findByText('Help Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('topbar')).not.toBeInTheDocument();
  });

  it('shows loading spinner while auth resolves, same as any other protected route', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, loading: true });
    renderAt(ROUTES.HELP);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('does not remount AppLayout when navigating from another protected route to Help, or back', async () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    const Nav = () => {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate(ROUTES.HELP)}>go to help</button>
          <button onClick={() => navigate(ROUTES.DASHBOARD)}>go to dashboard</button>
        </>
      );
    };
    render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <Nav />
        <AppRoutes />
      </MemoryRouter>,
    );

    await screen.findByText('Dashboard Page');
    const layoutOnDashboard = document.querySelector('[data-testid="app-layout"]');
    expect(layoutOnDashboard).not.toBeNull();

    fireEvent.click(screen.getByText('go to help'));
    expect(await screen.findByText('Help Page')).toBeInTheDocument();
    const layoutOnHelp = document.querySelector('[data-testid="app-layout"]');
    expect(layoutOnHelp).toBe(layoutOnDashboard);

    fireEvent.click(screen.getByText('go to dashboard'));
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
    const layoutBackOnDashboard = document.querySelector('[data-testid="app-layout"]');
    expect(layoutBackOnDashboard).toBe(layoutOnDashboard);
  });
});
describe('a page that throws', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ user: { name: 'Test' }, isAuthenticated: true, loading: false });
    pageState.dashboardThrows = true;
  });

  afterEach(() => {
    pageState.dashboardThrows = false;
    vi.restoreAllMocks();
  });

  it('leaves the Topbar and Sidebar rendered so the user can navigate away', async () => {
    renderAt(ROUTES.DASHBOARD);

    expect(await screen.findByText('This section could not be displayed.')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
  });
});