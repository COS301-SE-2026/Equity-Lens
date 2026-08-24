import { motion, useReducedMotion  } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';
import Money from '../../common/Money/Money';
import { zar, zarFull } from '../../../utils/currency';
import { buildHeroSummary } from '../../../utils/dashboardInsights';

/** @param {number | null} score */
const healthTone = (score) => {
  if (score === null) return 'var(--text-ghost)';
  if (score >= 7) return 'var(--signal-positive)';
  if (score >= 5) return 'var(--signal-warning)';
  return 'var(--signal-negative)';
};

/** @param {number} n */
const signColor = (n) => {
  if (n > 0) return 'var(--signal-positive)';
  if (n < 0) return 'var(--signal-negative)';
  return 'var(--text-primary)';
};
/** @param {number} n */
const signPrefix = (n) => {
  if (n > 0) return '+';
  if (n < 0) return '-';
  return '';
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
 *   label: string,
 *   help?: string,
 *   value: string,
 *   pctText?: string,
 *   color?: string,
 *   icon?: import('react').ReactNode,
 *   marker?: boolean,
 *   markerHelp?: string,
 *   size?: 'lg' | 'sm',
 * }} props
 */
const HeroFigure = ({ label, help, value, pctText, color, icon, marker, markerHelp, size = 'sm' }) => (
  <div>
    <div className="flex items-center gap-1 font-mono text-[10px] tracking-widest sm:justify-end" style={{ color: 'var(--text-ghost)' }}>
      <span>{label}</span>
      {help && <HelpTooltip text={help} />}
    </div>
    <div
      className={`mt-1 flex items-center gap-1.5 font-mono font-semibold leading-none sm:justify-end ${
        size === 'lg' ? 'text-[28px] sm:text-[32px]' : 'text-[18px] sm:text-[20px]'
      }`}
      style={{ color: color ?? 'var(--text-primary)' }}>
      {icon}
      <Money as="span">{value}</Money>
      {pctText && (
        <Money as="span" className="text-[13px] font-normal" style={{ color: 'var(--text-ghost)' }}>
          {pctText}
        </Money>
      )}
      {marker && <HelpTooltip text={markerHelp ?? ''} />}
    </div>
  </div>
);

/**
 * @param {{
 *   name: string,
 *   portfolioData: any,
 *   health: { score: number|null, label: string|null },
 *   fetchedAt?: Date|null,
 *   onScrollToHealth: () => void,
 * }} props
 */
const DashboardHero = ({ name, portfolioData, health, fetchedAt, onScrollToHealth }) => {
  const slowMo = useReducedMotion ();
  const greeting = greet(new Date().getHours());
  const time = newTime(fetchedAt);

  const holdings = portfolioData?.holdings ?? [];
  const hasHoldings = holdings.length > 0;
  const returnsData = portfolioData?.returns ?? {};
  const portfolioValue = returnsData.portfolio_value ?? portfolioData?.summary?.total_value ?? 0;
  const investedCapital = returnsData.invested_capital ?? 0;
  const unrealisedGain = returnsData.unrealised_gain ?? 0;
  const gainPct = returnsData.simple_return_pct ?? null;
  const holdingsCount = returnsData.holdings_count ?? 0;
  const pricedLiveCount = returnsData.priced_live_count ?? 0;
  const allUnpriced = holdingsCount > 0 && pricedLiveCount === 0;
  const partiallyUnpriced = holdingsCount > 0 && pricedLiveCount > 0 && pricedLiveCount < holdingsCount;
  const gainKnown = hasHoldings && !allUnpriced;
  const unpricedCount = holdingsCount - pricedLiveCount;

  const gainHelp = allUnpriced
    ? "None of your holdings are currently priced live, so a gain figure can't be calculated yet."
    : 'Unrealised gain on your currently-held positions only. Realised gains from past sales and dividends received are shown separately.';
  const rawDailyValue = portfolioData?.summary?.daily_change_value;
  const rawDailyPct = portfolioData?.summary?.daily_change_pct;
  const dailyChangeKnown = rawDailyValue !== null && rawDailyValue !== undefined
    && rawDailyPct !== null && rawDailyPct !== undefined;
  const dailyChangeValue = dailyChangeKnown ? rawDailyValue : 0;
  const dailyChangePct = dailyChangeKnown ? rawDailyPct : 0;
  const todayIcon = !dailyChangeKnown
    ? null
    : dailyChangeValue > 0 ? <TrendingUp size={14} /> : dailyChangeValue < 0 ? <TrendingDown size={14} /> : null;

  const summaryText = hasHoldings && dailyChangeKnown
    ? buildHeroSummary({ dailyChangeValue, dailyChangePct, unrealisedGain, gainKnown })
    : null;

  return (
    <motion.div
      initial={slowMo ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-surface overflow-hidden rounded-2xl">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="sm:max-w-[50%]">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              <span className="font-light" style={{ color: 'var(--text-secondary)' }}>
                {greeting}{' '}
              </span>
              <span style={{ color: 'var(--accent-primary)' }}>{name}</span>
            </h1>
            {summaryText && (
              <p className="mt-2 text-[14px] leading-snug sm:text-[15px]" style={{ color: 'var(--text-primary)' }}>
                {summaryText}
              </p>)}
          </div>

          {hasHoldings ? ( <div className="sm:text-right"> <div className="flex items-center gap-1 font-mono text-[10px] tracking-widest sm:justify-end" style={{ color: 'var(--text-ghost)' }}> <span>Portfolio Value</span>
                <HelpTooltip text="Live value of your holdings, or cost where a live price isn't available." />
              </div>
              <div className="mt-1 font-mono font-semibold leading-none text-[32px] sm:text-[40px]" style={{ color: 'var(--text-primary)' }}> <Money as="span">{zarFull(portfolioValue)}</Money>
              </div>

              <div className="mt-2 sm:flex sm:justify-end">
                <HeroFigure
                  label="Today"
                  value={dailyChangeKnown
                    ? `${signPrefix(dailyChangeValue)}${zar(Math.abs(dailyChangeValue))}`
                    : '-'}
                  pctText={dailyChangeKnown ? `(${signPrefix(dailyChangePct)}${Math.abs(dailyChangePct).toFixed(2)}%)`
                    : undefined}
                  color={dailyChangeKnown ? signColor(dailyChangeValue) : 'var(--text-ghost)'}
                  help={dailyChangeKnown ? undefined
                    : "None of your holdings could be priced today, there's no daily move to report yet."}
                  icon={todayIcon}/>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 sm:justify-end">
                <HeroFigure label="Invested" help="The cost of your currently-held positions, not total money deposited, differs whenever you've sold something or hold uninvested cash."
                  value={zarFull(investedCapital)}/>
                <HeroFigure
                  label="Investment Gain"
                  help={gainHelp}
                  value={gainKnown ? `${signPrefix(unrealisedGain)}${zarFull(Math.abs(unrealisedGain))}` : '-'}
                  pctText={
                    gainKnown && gainPct !== null ? `(${signPrefix(gainPct)}${Math.abs(gainPct).toFixed(1)}%)`
                      : undefined}
                  color={gainKnown ? signColor(unrealisedGain) : 'var(--text-ghost)'}
                  marker={partiallyUnpriced}
                  markerHelp={`${unpricedCount} of ${holdingsCount} holding${unpricedCount === 1 ? '' : 's'} ${
                    unpricedCount === 1 ? 'is' : 'are'
                  } priced at cost`}/>
              </div>
            </div>
          ) : ( <div className="sm:text-right">
              <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                Portfolio Value
              </div>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                Import a portfolio to see your figures.
              </p>
            </div>
          )}
        </div>
        {time && (
          <div className="mt-5 text-right font-mono text-[9px]" style={{ color: 'var(--text-ghost)' }}>
            {time}
          </div>)}
        {health.score !== null && (
          <div
            className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-4"
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