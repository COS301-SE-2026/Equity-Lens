import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

import { zar, zarFull } from '../../../utils/currency';

/**
 * @param {{
 *   portfolioData: any,
 *   attribution: { contributors: any[], drags: any[], todayReturn: number },
 *   topHolding?: { ticker: string, weight: number },
 * }} props
 */
const PortfolioInsight = ({ portfolioData, attribution, topHolding }) => {
  const reduceMotion = useReducedMotion();
  /** @type {{ ticker: string, sector?: string }[]} */
  const holdings = portfolioData?.holdings || [];
  const totalVal = portfolioData?.summary?.total_value ?? 0;
  const dailyChangePct = portfolioData?.summary?.daily_change ?? 0;
  const todayPos = attribution.todayReturn >= 0;

  const pos = dailyChangePct >= 0;
  const dir = pos ? 'up' : 'down';
  const reason = pos ? 'led by' : 'weighed down by';


  let headline;
  if (!holdings.length) { headline = 'Import a portfolio to see your performance.';
  } else {
    const mover = pos ? attribution.contributors[0] : attribution.drags[0];
    if (!mover) {
      headline = `Your portfolio is ${dir} ${Math.abs(dailyChangePct).toFixed(1)}% today.`;
    } else {
      const holding = holdings.find((h) => h.ticker === mover.ticker);

      headline =
        `Your holdings are ${dir} ${Math.abs(dailyChangePct).toFixed(1)}% today, ` +
        `${reason} ${mover.ticker}` +
        `${holding?.sector ? ` in ${holding.sector}` : ''}.`;
    }}

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="overflow-hidden rounded-2xl backdrop-blur-xl"
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
      <div className="p-6 sm:p-8">
        <p className="max-w-2xl text-[19px] leading-snug sm:text-[22px]" style={{ color: 'var(--text-primary)' }}>
          {headline}
        </p>
        <div
          className="mt-6 grid grid-cols-1 gap-6 pt-6 sm:grid-cols-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
              Net Worth
            </div>
            <div className="mt-1 font-mono text-[30px] font-semibold leading-none tracking-tight sm:text-[34px]">
              {zarFull(totalVal)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
              Today
            </div>
            <div
              className="mt-1 flex items-center gap-1.5 font-mono text-[20px] font-semibold"
              style={{ color: todayPos ? 'var(--signal-positive)':'var(--signal-negative)' }}>
              {todayPos ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {todayPos ? '+':''}
              {zar(Math.abs(attribution.todayReturn))}
              <span className="text-[13px] font-normal" style={{ color: 'var(--text-ghost)' }}>
                ({todayPos ? '+':''}
                {dailyChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
              Top Holding Concentration
            </div>
            <div className="mt-1 font-mono text-[20px] font-semibold">
              {topHolding ? `${topHolding.weight.toFixed(1)}%` : '—'}
              {topHolding && (
                <span className="ml-1.5 text-[13px] font-normal" style={{ color: 'var(--text-ghost)' }}>
                  {topHolding.ticker}
                </span>)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );};
export default PortfolioInsight;