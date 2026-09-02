import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import { zar } from '../../../utils/currency';
import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';
import Money from '../../common/Money/Money';
import MoneyAxisTick from '../shared/MoneyAxisTick';

const MARKET_GAIN_CAVEAT =
  "Market gain = portfolio value minus money you've put in. Dividends reinvested into new shares count as market gain here - dividends paid into your EasyEquities wallet and left uninvested aren't tracked separately, so this figure may not capture every rand you've received. When the portfolio is worth less than you've put in, the red band is the shortfall between the two, not an amount added on top.";

/** @param {{ cumulative_net_contributions: number, cumulative_market_gain: number } | undefined} last */
function contributionsTakeaway(last) {
  if (!last) return null;
  const { cumulative_net_contributions: contributed, cumulative_market_gain: gain } = last;
  const contributedWord =
    contributed >= 0
      ? `put in ${zar(contributed)}`
      : `withdrawn ${zar(Math.abs(contributed))} more than you've deposited`;
  const gainWord =
    gain >= 0 ? `added ${zar(gain)} on top of that` : `taken away ${zar(Math.abs(gain))} of that`;
  return `You've ${contributedWord}. The market has ${gainWord}.`;
}

/** @param {{ active?: boolean, payload?: any[], label?: string }} props */
export const ContribTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const gainColor =
    row.cumulative_market_gain >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)';
  return (
    <div
      className="rounded-lg px-3 py-2 font-mono text-[11px]"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-mid)' }}
    >
      <div className="mb-1 text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {label}
      </div>
      <div className="flex items-center gap-3 py-0.5">
        <span style={{ color: 'var(--text-secondary)' }}>Portfolio value</span>
        <Money className="ml-auto font-semibold">{zar(row.portfolio_value)}</Money>
      </div>
      <div className="flex items-center gap-3 py-0.5">
        <span style={{ color: 'var(--text-secondary)' }}>Contributed</span>
        <Money className="ml-auto font-semibold">{zar(row.cumulative_net_contributions)}</Money>
      </div>
      <div className="flex items-center gap-3 py-0.5">
        <span style={{ color: gainColor }}>Market gain</span>
        <Money className="ml-auto font-semibold">{zar(row.cumulative_market_gain)}</Money>
      </div>
    </div>
  );
};

/** @param {{ color: string, label: string, line?: boolean, dashed?: boolean }} props */
const LegendItem = ({ color, label, line, dashed }) => (
  <div className="flex items-center gap-1.5" style={{ color: 'var(--chart-axis-text)' }}>
    {line ? (
      <span
        className="w-4 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
      />
    ) : (
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    )}
    {label}
  </div>
);

/**
 * @param {{
 *   series: { date: string, name: string, portfolio_value: number, cumulative_net_contributions: number, cumulative_market_gain: number }[],
 * }} props
 */
const ContributionsChart = ({ series }) => {
  if (series.length < 2) {
    return (
      <div
        className="flex h-[300px] items-center justify-center px-5 text-[12px]"
        style={{ color: 'var(--chart-axis-text)' }}
      >
        Not enough history yet to chart contributions vs market gain.
      </div>
    );
  }

  const last = series[series.length - 1];
  const takeaway = contributionsTakeaway(last);

  const rows = series.map((point) => ({
    ...point,
    marketBand: [
      Math.min(point.cumulative_net_contributions, point.portfolio_value),
      Math.max(point.cumulative_net_contributions, point.portfolio_value),
    ],
  }));

  const lo = Math.min(...rows.map((r) => r.marketBand[0]));
  const hi = Math.max(...rows.map((r) => r.marketBand[1]));
  const pad = (hi - lo) * 0.2 || hi * 0.05;

  return (
    <div aria-label="Contributions vs market gain chart">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div
          className="flex items-center gap-1 font-mono text-[10px] tracking-widest"
          style={{ color: 'var(--chart-axis-text)' }}
        >
          <span>{"What You Put In vs What It's Worth Now"}</span>
          <HelpTooltip text={MARKET_GAIN_CAVEAT} />
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <LegendItem color="var(--accent-primary)" label="Portfolio Value" line />
          <LegendItem color="var(--text-secondary)" label="Contributed" line dashed />
          <LegendItem color="var(--signal-positive)" label="Market gain" />
          <LegendItem color="var(--signal-negative)" label="Market loss" />
        </div>
      </div>

      {takeaway && (
        <Money as="p" className="px-5 pt-2 text-[13px]" style={{ color: 'var(--text-primary)' }}>
          {takeaway}
        </Money>
      )}

      <div className="h-[300px] p-5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 16, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="var(--chart-axis-text)"
              tick={{ fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
            />
            <YAxis
              stroke="var(--chart-axis-text)"
              tick={<MoneyAxisTick />}
              tickLine={false}
              axisLine={false}
              domain={[lo - pad, hi + pad]}
            />
            <Tooltip content={<ContribTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
            <Bar dataKey="marketBand" maxBarSize={28}>
              {rows.map((point) => (
                <Cell
                  key={point.date}
                  fill={
                    point.cumulative_market_gain >= 0
                      ? 'var(--signal-positive)'
                      : 'var(--signal-negative)'
                  }
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="cumulative_net_contributions"
              stroke="var(--text-secondary)"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="portfolio_value"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                fill: 'var(--accent-primary)',
                stroke: 'var(--surface-card)',
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ContributionsChart;
