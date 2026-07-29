import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';

/** @param {{ children: any, className?: string }} props */
export const GlassPanel = ({ children, className = '' }) => (
  <div
    className={`overflow-hidden rounded-2xl backdrop-blur-xl ${className}`}
    style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }} >
    {children}
  </div>
);

/** @param {{ label: string, hint?: any, help?: string }} props */
export const PanelHead = ({ label, hint, help }) => (
  <div
    className="flex items-center justify-between px-5 py-4"
    style={{ borderBottom: '1px solid var(--border-subtle)' }} >
    <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
      {help && <HelpTooltip text={help} />}
    </div>
    {hint && (
      <div className="font-mono text-[10px]" style={{ color: 'var(--text-ghost)' }}>
        {hint}
      </div>
    )}
  </div>
);
