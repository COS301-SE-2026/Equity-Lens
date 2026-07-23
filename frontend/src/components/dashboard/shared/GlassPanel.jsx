/** @param {{ children: any, className?: string }} props */
export const GlassPanel = ({ children, className = '' }) => (
  <div
    className={`overflow-hidden rounded-2xl backdrop-blur-xl ${className}`}
    style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} >
    {children}
  </div>
);

/** @param {{ label: string, hint?: string }} props */
export const PanelHead = ({ label, hint }) => (
  <div
    className="flex items-center justify-between px-5 py-4"
    style={{ borderBottom: '1px solid var(--border-subtle)' }} >
    <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
    </div>
    {hint && (
      <div className="font-mono text-[10px]" style={{ color: 'var(--text-ghost)' }}>
        {hint}
      </div>
    )}
  </div>
);
