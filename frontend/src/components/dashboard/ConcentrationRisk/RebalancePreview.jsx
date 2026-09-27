import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Info } from 'lucide-react';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { zar } from '../../../utils/currency';
import ScoreDelta from '../shared/ScoreDelta';

const NEUTRAL_FILL = 'var(--border-mid)';
const FROM_FILL = 'rgba(var(--signal-negative-rgb), 0.75)';
const TO_FILL = 'rgba(var(--signal-positive-rgb), 0.75)';
const MIN_LABEL_PCT = 8;

/**
 * @param {{
 *   result: {
 *     from_sector: string, to_sector: string, value_shifted: number,
 *     from_sector_before_pct: number, to_sector_before_pct: number,
 *     health_score_before: number, health_score_after: number,
 *     explanation: string, disclaimer: string,
 *   },
 *   sectors: { sector: string, value?: number, percentage: number }[],
 * }} args
 * @returns {{ rows: Record<string, any>[], names: string[] } | null}
 */
export const buildRows = ({ result, sectors }) => {
  const total = sectors.reduce((sum, s) => sum + (s.value ?? 0), 0);
  if (!total || sectors.length < 2) return null;

  const shiftedPct = (result.value_shifted / total) * 100;

  /** @type {Record<string, number>} */
  const before = {};
  for (const s of sectors) before[s.sector] = s.percentage;
  before[result.from_sector] = result.from_sector_before_pct;
  before[result.to_sector] = result.to_sector_before_pct;

  const after = { ...before };
  after[result.from_sector] = Math.max(0, before[result.from_sector] - shiftedPct);
  after[result.to_sector] = before[result.to_sector] + shiftedPct;

  return {
    names: sectors.map((s) => s.sector),
    rows: [{ row: 'Now', ...before }, { row: 'Simulated', ...after }],
  };};

/** @param {{ active?: boolean, payload?: any[], label?: string }} props */
const AllocationTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-mid)' }}>
      <p className="mb-1 font-mono text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {entry.name} {Number(entry.payload[entry.name]).toFixed(1)}%
        </p>
      ))}
    </div>
  );};

/** @param {{ sector: string, rows: Record<string, any>[] }} config */
const segmentLabel = ({ sector, rows }) => {
  /** @param {any} props */
  const Label = ({ x, y, width, height, index }) => {
    const pct = Number(rows[index]?.[sector]);
    if (!Number.isFinite(pct) || pct < MIN_LABEL_PCT) return null;
    return (
      <text
        x={Number(x) + Number(width) / 2}
        y={Number(y) + Number(height) / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--text-on-accent)' }}>
        {pct.toFixed(0)}%
      </text>
    );};
  return Label;
};

/** @param {{ color: string, children: React.ReactNode }} props */
const LegendDot = ({ color, children }) => (
  <span className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
    {children}
  </span>);

/** @param {{ children: React.ReactNode }} props */
const Step = ({ children }) => (
  <span className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
    {children}
  </span>);

/**
 * @param {{
 *   result: any,
 *   sectors: { sector: string, value?: number, percentage: number }[],
 * }} props
 */
const RebalancePreview = ({ result, sectors }) => {
  const shouldReduceMotion = useReducedMotion();
  const chart = buildRows({ result, sectors });

  /** @param {string} name */
  const fillFor = (name) => {
    if (name === result.from_sector) return FROM_FILL;
    if (name === result.to_sector) return TO_FILL;
    return NEUTRAL_FILL;
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: 'hidden' }}>
      <div className="mt-3 space-y-3">
        <ScoreDelta
          before={result.health_score_before}
          after={result.health_score_after}
          label="Portfolio Health"/>

        {chart && (
          <div>
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
              <LegendDot color={FROM_FILL}>{result.from_sector} (out)</LegendDot>
              <LegendDot color={TO_FILL}>{result.to_sector} (in)</LegendDot>
              <LegendDot color={NEUTRAL_FILL}>unchanged</LegendDot>
            </div>

            <div className="h-[104px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart.rows}
                  layout="vertical"
                  stackOffset="expand"
                  margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis type="number" hide domain={[0, 1]} />
                  <YAxis
                    type="category"
                    dataKey="row"
                    width={62}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--text-ghost)' }}/>
                  <Tooltip content={<AllocationTooltip />} cursor={false} />
                  {chart.names.map((name) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="allocation"
                      fill={fillFor(name)}
                      stroke="var(--surface-elevated)"
                      strokeWidth={2}
                      isAnimationActive={!shouldReduceMotion}>
                      {(name === result.from_sector || name === result.to_sector) && (
                        <LabelList
                          dataKey={name}
                          content={segmentLabel({ sector: name, rows: chart.rows })}/>
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>)}

        <div className="flex flex-wrap items-center gap-2">
          <Step>
            {zar(result.value_shifted)} out of {result.from_sector}, into {result.to_sector}
          </Step>
          <ChevronRight size={12} style={{ color: 'var(--text-ghost)' }} aria-hidden="true" />
          <Step>{result.explanation}</Step>
          {result.from_sector !== result.to_sector && (
            <>
              <ChevronRight size={12} style={{ color: 'var(--text-ghost)' }} aria-hidden="true" />
              <Step>Sector Concentration is the subscore that moves.</Step>
            </>)}
        </div>

        <p className="flex items-start gap-1 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          <Info size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
          {result.disclaimer}
        </p>
      </div>
    </motion.div>
  );};

export default RebalancePreview;