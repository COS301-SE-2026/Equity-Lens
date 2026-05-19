import { Sun, Moon, LogOut, LayoutDashboard } from 'lucide-react';
import useAuth from '../../../hooks/useAuth';
import useTheme from '../../../hooks/useTheme';
import { ROUTES } from '../../../utils/constants';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      className="navbar navbar-expand-lg bg-body shadow-sm py-3"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="container">

        <Link
          to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN}
          className="navbar-brand fw-bold fs-3 text-primary d-flex align-items-center gap-2"
        >
          <img src="/assets/logo.svg" alt="EquityLens logo" style={{ height: '2rem', width: '2rem' }} />
          EquityLens
        </Link>

        <div className="d-flex flex-row gap-4 align-items-center">

          {isAuthenticated && (
            <>
              <Link
                to={ROUTES.DASHBOARD}
                className="text-body text-decoration-none d-flex align-items-center gap-1"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>

              <span className="text-body-secondary small">
                {user?.full_name}
              </span>
            </>
          )}

          <button
            onClick={toggleTheme}
            className="btn btn-light rounded-3 p-2"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isAuthenticated ? (
            <button
              onClick={logout}
              className="btn btn-outline-danger rounded-4 px-3 d-flex align-items-center gap-2"
              aria-label="Log out"
            >
              <LogOut size={16} />
              Logout
            </button>
          ) : (
            <Link to={ROUTES.LOGIN} className="btn btn-primary rounded-4 px-4">
              Sign Up
            </Link>
          )}

        </div>
      </div>
    </nav>
  );
}