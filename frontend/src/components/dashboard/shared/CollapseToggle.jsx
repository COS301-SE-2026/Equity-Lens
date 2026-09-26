import { ChevronDown } from 'lucide-react';

/**
 * @param {{ open: boolean, onToggle: () => void, controls: string, label: string }} props
 */
const CollapseToggle = ({ open, onToggle, controls, label }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    aria-controls={controls}
    aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
    className="pressable flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-hover)]"
    style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-secondary)',
    }}>
    <ChevronDown
      size={14}
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}/>
  </button>
);

export default CollapseToggle;
