import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/common/Button/Button';

const News = () => (
  <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-6 px-4">
    <p className="text-xl font-semibold text-[var(--text-primary)]">Market News</p>
    <p className="text-sm text-[var(--text-secondary)] text-center max-w-sm">
      Coming in Demo 2.
    </p>
    <Link to={ROUTES.DASHBOARD}>
      <Button variant="primary">Back to Dashboard</Button>
    </Link>
  </div>
);

export default News;