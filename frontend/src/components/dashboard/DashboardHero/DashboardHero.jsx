import { motion, useReducedMotion  } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { zar, zarFull } from '../../../utils/currency';
import SecondaryButton from '../shared/SecondaryButton';

const SEVERITY = {
  risk: { color: 'var(--signal-negative)', bg: 'var(--signal-negative-bg)' },
  opportunity: { color: 'var(--signal-positive)', bg: 'var(--signal-positive-bg)' },
  neutral: { color: 'var(--signal-info)', bg: 'var(--signal-info-bg)' },
};

/** @param {number | null} score */
const healthTone = (score) => {
  if (score === null) return 'var(--text-ghost)';
  if (score >= 7) return 'var(--signal-positive)';
  if (score >= 5) return 'var(--signal-warning)';
  return 'var(--signal-negative)';
};

/** @param {number} hour */
function greet(hour) {
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

/** @param {Date|null|undefined} fetchedAt */
function newTime(fetchedAt) {
  if (!fetchedAt) { return null; }
  const mins = Math.floor((Date.now() - fetchedAt.getTime()) / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} minutes ago`;
  const hours = Math.floor(mins/60);
  return hours === 1 ? 'Updated 1 hour ago' : `Updated ${hours} hours ago`;
}

/**
 * @param {{
 *   action: { label: string, to?: string, target?: string, prefill?: string },
 *   onScrollTo?: (target: string) => void,
 * }} props
 */
const ActionChip = ({ action, onScrollTo }) => {
  if (action.prefill) { return <SecondaryButton to={`/ai?q=${encodeURIComponent(action.prefill)}`}>{action.label}</SecondaryButton>; }
  if (action.to) { return <SecondaryButton to={action.to}>{action.label}</SecondaryButton>; }
  return <SecondaryButton onClick={() => action.target && onScrollTo?.(action.target)}>{action.label}</SecondaryButton>;
};

/**
 * @param {{
 *   name: string,
 *   portfolioData: any,
 *   attribution: { contributors: any[], drags: any[], todayReturn: number },
 *   health: { score: number|null, label: string|null },
 *   summary: {
 *     headline: string,
 *     supportingText: string[],
 *     severity: 'risk'|'opportunity'|'neutral',
 *     badge: string,
 *     suggestedActions: { label: string, to?: string, target?: string, prefill?: string }[],
 *   },
 *   fetchedAt?: Date|null,
 *   onScrollToHealth: () => void,
 *   onScrollTo: (target: string) => void,
 * }} props
 */
const DashboardHero = ({ name, portfolioData, attribution, health, summary, fetchedAt, onScrollToHealth, onScrollTo }) => {
  const slowMo = useReducedMotion ();
  const greeting = greet(new Date().getHours());
  const totalVal = portfolioData?.summary?.total_value ?? 0;
  const changePct = portfolioData?.summary?.daily_change ?? 0;
  const todayReturn = attribution?.todayReturn ?? 0;
  const positive = todayReturn >= 0;
  const tone = SEVERITY[summary?.severity] ?? SEVERITY.neutral;
  const time = newTime(fetchedAt);

  return (
    <motion.div
      initial={slowMo ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl backdrop-blur-xl"
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              <span className="font-light" style={{ color: 'var(--text-secondary)' }}>
                {greeting}{' '}
              </span>
              <span style={{ color: 'var(--accent-primary)' }}>{name}</span>
            </h1>
          </div>

          <div className="flex shrink-0 gap-8 sm:text-right">
            <div>
              <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                Net Worth
              </div>
              <div className="mt-1 font-mono text-[28px] font-semibold leading-none tracking-tight sm:text-[32px]">
                {zarFull(totalVal)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                Today
              </div>
              <div
                className="mt-1 flex items-center gap-1.5 font-mono text-[20px] font-semibold sm:justify-end"
                style={{ color: positive ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
                {positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {positive ? '+' : ''}
                {zar(Math.abs(todayReturn))}
                <span className="text-[13px] font-normal" style={{ color: 'var(--text-ghost)' }}>
                  ({positive ? '+' : ''}
                  {changePct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
              Portfolio Summary
            </div>
            <div className="flex items-center gap-2">
              {time && (
                <span className="font-mono text-[9px]" style={{ color: 'var(--text-ghost)' }}> {time}
                </span> )}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold tracking-widest"
                style={{ color: tone.color, background: tone.bg }}>
                {summary.badge}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[16px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
            {summary.headline}
          </p>
          {summary.supportingText.map((line) => (
            <p key={line} className="mt-1.5 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              {line}
            </p>
          ))}
          {summary.suggestedActions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {summary.suggestedActions.map((action) => (
                <ActionChip key={action.label} action={action} onScrollTo={onScrollTo} />
              ))}
            </div>
          )}
        </div>
        {health.score !== null && (
          <div
            className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-5"
            style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                Portfolio Health
              </span>
              <span
                className="rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold"
                style={{ background: 'var(--surface-raised)', color: healthTone(health.score) }}>
                {health.label}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onScrollToHealth}
                className="rounded-md px-4 py-2 font-mono text-[11px] font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}>
                Review Portfolio Health
              </button>
              <Link
                to="/ai"
                className="rounded-md px-4 py-2 font-mono text-[11px] font-medium transition-colors"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Ask AI Assistant
              </Link>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );};

export default DashboardHero;