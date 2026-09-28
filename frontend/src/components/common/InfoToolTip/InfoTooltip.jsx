import { Info } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

/**
 * @param {{ label: string, text: string }} props
 */
export default function InfoTooltip({ label, text }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;

    /** @param {KeyboardEvent} e */
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <span className="relative inline-flex items-center gap-1">
      {label}
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className="inline-flex items-center"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'help',
          color: 'var(--accent-primary)',
        }}
      >
        <Info size={13} />
      </button>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg p-3 text-xs"
        style={{
          background: 'var(--chart-tooltip-bg)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          fontWeight: 400,
          whiteSpace: 'normal',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        {text}
      </span>
    </span>
  );
}
