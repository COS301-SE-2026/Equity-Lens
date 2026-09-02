import { Link } from 'react-router-dom';
import Button from '../../components/common/Button/Button';
import { ROUTES } from '../../utils/constants';

const NotFound = () => (
  <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-6 px-4">
    <h1 className="text-6xl font-bold text-[var(--accent-primary)]">404</h1>
    <p className="text-xl font-semibold text-[var(--text-page)]">Page not found</p>
    <p className="text-sm text-[var(--text-page-secondary)] text-center max-w-sm">
      The page you are looking for does not exist or has been moved.
    </p>
    
    <Link to={ROUTES.HOME}>
      <Button variant="primary">Back to home</Button>
    </Link>
  </div>
);

export default NotFound;
