import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { buildWorkingEquation, buildWorkingRows } from '../../../utils/eventNarrative';
import AnimatedReveal from '../shared/AnimatedReveal';
import SecondaryButton from '../shared/SecondaryButton';

/** @param {{ active?: boolean, payload?: any[], label?: any }} props */
const EventTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className="rounded-lg px-3 py-2 font-mono text-[11px]"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-mid)' }}>
      <div className="mb-1 text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {label === 0 ? 'event day' : `t${label > 0 ? '+' : ''}${label}`} · {row.date}
      </div>
      <Row label="Abnormal" value={row.abnormal_return_pct} />
      <Row label="Cumulative" value={row.cumulative_abnormal_return_pct} />
      <div className="mt-0.5" style={{ color: 'var(--text-ghost)' }}>
        band {row.car_lower_pct?.toFixed(1)}% to {row.car_upper_pct?.toFixed(1)}%
      </div>
    </div>
  );};

/** @param {{ label: string, value: number }} props */
const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-0.5">
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{ color: value >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
      {value >= 0 ? '+' : ''}{value?.toFixed(2)}%
    </span>
  </div>
);

/**
 * @param {any} detail
 * @returns {any[] | null}
 */
export function eventStudyRows(detail) {
  const rows = detail?.abnormal_returns ?? [];
  const usable = rows.length > 0 && rows.every((/** @type {any} */ r) =>
    typeof r.cumulative_abnormal_return_pct === 'number'
    && typeof r.car_lower_pct === 'number'
    && typeof r.car_upper_pct === 'number'
    && typeof r.offset === 'number',
  );
  if (!usable) return null;
  return rows.map((/** @type {any} */ r) => ({ ...r, band: [r.car_lower_pct, r.car_upper_pct] }));
}

/** @param {{ detail: any, initialWorkingOpen?: boolean }} props */
const EventStudyChart = ({ detail, initialWorkingOpen = false }) => {
  const [showWorking, setShowWorking] = useState(initialWorkingOpen);
  const data = eventStudyRows(detail);
  if (!data) return null;

  const rows = buildWorkingRows(detail);
  const equation = buildWorkingEquation(detail);

  return (
    <div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 16, left: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="offset"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={data.map((/** @type {any} */ r) => r.offset).filter((/** @type {number} */ o) => o % 5 === 0)}
              stroke="var(--text-ghost)"
              tick={{ fontSize: 11, fontFamily: 'monospace' }}
              tickFormatter={(/** @type {number} */ o) => (o > 0 ? `+${o}` : `${o}`)}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Trading days from the event',
                position: 'insideBottom',
                offset: -12,
                fontSize: 11,
                fill: 'var(--text-ghost)',
              }}/>
            <YAxis
              stroke="var(--text-ghost)"
              tick={{ fontSize: 11, fontFamily: 'monospace' }}
              tickFormatter={(/** @type {number} */ v) => `${v.toFixed(0)}%`}
              tickLine={false}
              axisLine={false}
              width={40}
              label={{
                value: 'How far from expected',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
                fill: 'var(--text-ghost)',
                style: { textAnchor: 'middle' },
              }}/>
            <Tooltip content={<EventTooltip />} />

            <Area
              dataKey="band"
              stroke="none"
              fill="var(--accent-primary)"
              fillOpacity={0.12}
              isAnimationActive={false}/>

            <ReferenceLine y={0} stroke="var(--border-mid)" />
            <ReferenceLine
              x={0}
              stroke="var(--text-ghost)"
              strokeDasharray="4 4"
              label={{ value: 'event', position: 'top', fontSize: 11, fill: 'var(--text-ghost)' }}/>

            <Line
              type="monotone"
              dataKey="cumulative_abnormal_return_pct"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <SecondaryButton
        size="sm"
        onClick={() => setShowWorking((open) => !open)}
        expanded={showWorking}
        className="mt-1 !px-1.5 !py-0.5 !text-[11px]">
        {showWorking ? 'Hide the working' : 'Show the working'}
      </SecondaryButton>

      <AnimatedReveal show={showWorking}>
        {equation && (
          <div className="mt-2 rounded-lg p-2.5" style={{ background: 'var(--surface-inset)' }}>
            <div className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
              {equation.formula}
            </div>
            <div className="mt-1 font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {equation.substituted}
            </div>
            <div className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--text-primary)' }}>
              {equation.result}
            </div>
          </div>
        )}

        <dl className="mt-2 space-y-2">
          {(rows ?? []).map((row) => (
            <Figure key={row.label} label={row.label} value={row.value} reading={row.reading} />
          ))}
        </dl>
      </AnimatedReveal>
    </div>
  );};

/** @param {{ label: string, value: any, reading: string }} props */
const Figure = ({ label, value, reading }) => (
  <div>
    <div className="flex flex-wrap items-baseline gap-1.5 font-mono text-[11px]">
      <dt style={{ color: 'var(--text-ghost)' }}>{label}</dt>
      <dd style={{ color: 'var(--text-primary)' }}>{value}</dd>
    </div>
    <p className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
      {reading}
    </p>
  </div>
);

export default EventStudyChart;