import { GlassPanel } from '../shared/GlassPanel';
import SecondaryButton from '../shared/SecondaryButton';

const TINT = {
  risk: {
    background: 'rgba(var(--signal-negative-rgb), 0.10)',
    border: '1px solid rgba(var(--signal-negative-rgb), 0.28)',
  },
  opportunity: {
    background: 'rgba(var(--signal-positive-rgb), 0.10)',
    border: '1px solid rgba(var(--signal-positive-rgb), 0.28)',
  },
  neutral: {
    background: 'var(--surface-hover)',
    border: '1px solid var(--border-subtle)',
  },
};

const MAX_ACTIONS = 3;

/**
 * @param {{
 *   summary: {
 *     headline: string,
 *     supportingText: string[],
 *     severity: 'risk'|'opportunity'|'neutral',
 *     badge: string,
 *     suggestedActions: { label: string, to?: string, target?: string, question?: string }[],
 *     signals: any[],
 *   },
 *   onScrollTo?: (target: string) => void,
 *   onAsk?: (question: string) => void,
 * }} props
 */
const DashboardSignals = ({ summary, onScrollTo, onAsk }) => {
  if (!summary || (summary.signals.length === 0 && !summary.headline)) return null;

  const tint = TINT[summary.severity] ?? TINT.neutral;
  const actions = summary.suggestedActions.slice(0, MAX_ACTIONS);

  return (
    <GlassPanel className="p-5" style={tint}>
      <div className="font-mono text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {summary.badge}
      </div>

      <p className="mt-2 text-[17px] font-medium" style={{ color: 'var(--text-primary)' }}>
        {summary.headline}
      </p>

      {summary.supportingText.length > 0 && (
        <div className="mt-2 space-y-1">
          {summary.supportingText.map((line) => (
            <p key={line} className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {line}
            </p>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => {
            const { target, question } = action;
            if (target) {
              return (
                <SecondaryButton key={action.label} onClick={() => onScrollTo?.(target)}>
                  {action.label}
                </SecondaryButton>
              );
            }
            if (question) {
              return (
                <SecondaryButton key={action.label} onClick={() => onAsk?.(question)}>
                  {action.label}
                </SecondaryButton>
              );
            }
            return (
              <SecondaryButton key={action.label} to={action.to}>
                {action.label}
              </SecondaryButton>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
};

export default DashboardSignals;
