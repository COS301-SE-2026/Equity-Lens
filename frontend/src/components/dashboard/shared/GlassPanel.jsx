import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';

/** @param {{ children: any, className?: string, style?: React.CSSProperties, elevated?: boolean, blurred?: boolean }} props */
export const GlassPanel = ({ children, className = '', style, elevated = false, blurred = false }) => (
  <div
    className={`${elevated ? 'glass-surface-elevated' : 'glass-surface'} ${
      blurred || elevated ? '' : 'glass-surface-flat'
    } overflow-hidden rounded-2xl ${className}`}
    style={style} >
    {children}
  </div>
);

/** @param {{ label: string, hint?: any, help?: string, action?: any }} props */
export const PanelHead = ({ label, hint, help, action }) => (
  <div
    className="flex items-center justify-between px-5 py-4"
    style={{ borderBottom: '1px solid var(--border-subtle)' }} >
    <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
      {help && <HelpTooltip text={help} />}
    </div>
    {(hint || action) && (
      <div className="flex items-center gap-2">
        {hint && (
          <div className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
            {hint}
          </div>
        )}
        {action}
      </div>
    )}
  </div>
);
