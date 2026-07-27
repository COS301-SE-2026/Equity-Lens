import { Link } from 'react-router-dom';

const BASE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full font-mono font-medium transition-colors hover:bg-[var(--surface-hover)]';
const SIZE_CLASS = {
  md: 'px-3 py-1.5 text-[11px]',
  sm: 'px-2 py-1 text-[10px]',
};
const STYLE = { border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };


/**
 * @param {{
 *   to?: string,
 *   onClick?: () => void,
 *   icon?: React.ReactNode,
 *   trailing?: React.ReactNode,
 *   expanded?: boolean,
 *   size?: 'md'|'sm',
 *   className?: string,
 *   children: React.ReactNode,
 * }} props
 */
const SecondaryButton = ({ to, onClick, icon, trailing, expanded, size = 'md', className = '', children }) => {
  const classes = `${BASE_CLASS} ${SIZE_CLASS[size]} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={classes} style={STYLE}>
        {icon}
        {children}
        {trailing}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} className={classes} style={STYLE}>
      {icon}
      {children}
      {trailing}
    </button>
  );
};

export default SecondaryButton;
