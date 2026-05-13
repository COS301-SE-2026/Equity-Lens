import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/common/Button/Button';

const NotFound = () => (
  <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-6 px-4">
    <h1 className="text-6xl font-bold text-[var(--accent-primary)]">404</h1>
    <p className="text-xl font-semibold text-[var(--text-primary)]">Page not found</p>
    <p className="text-sm text-[var(--text-secondary)] text-center max-w-sm">
      The page you are looking for does not exist or has been moved.
    </p>
    <Link to={ROUTES.DASHBOARD}>
      <Button variant="primary">Back to Dashboard</Button>
    </Link>
  </div>
);

export default NotFound;