import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

const COUNT_MS = 600;
const MAX_SCORE = 10;

/** @param {number} delta */
const deltaColor = (delta) => {
  if (delta > 0) return 'var(--signal-positive)';
  if (delta < 0) return 'var(--signal-negative)';
  return 'var(--text-primary)';
};

/**
 * @param {{ deltas: { key: string, label: string, before: number, after: number, weight: number }[] }} props
 */
export const SubscoreDeltas = ({ deltas = [] }) => {
  if (deltas.length === 0) return null;
  const ordered = [...deltas].sort(
    (a, b) => Math.abs((b.after - b.before) * b.weight) - Math.abs((a.after - a.before) * a.weight),
  );

  return (
    <div>
      <dl className="space-y-1">
        {ordered.map((factor) => {
          const move = factor.after - factor.before;
          const contribution = move * factor.weight;
          const sign = contribution >= 0 ? '+' : '';
          return (
            <div key={factor.key} className="flex items-baseline justify-between gap-3">
              <dt className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                {factor.label}
              </dt>
              <dd className="flex items-baseline gap-3 font-mono text-[11px]">
                <span className="w-[72px] text-right" style={{ color: 'var(--text-ghost)' }} aria-hidden="true">
                  {factor.before.toFixed(1)} &rarr; {factor.after.toFixed(1)}
                </span>
                <span className="w-[104px] text-right" aria-hidden="true">
                  <span style={{ color: deltaColor(move) }}>{sign}{contribution.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-ghost)' }}> to overall</span>
                </span>
                <span className="sr-only">
                  {factor.label}, {factor.before.toFixed(1)} before, {factor.after.toFixed(1)} after,{' '}
                  {contribution >= 0 ? 'plus' : 'minus'} {Math.abs(contribution).toFixed(2)} to overall score
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
        &ldquo;to overall&rdquo; is each factor&apos;s weighted contribution to the overall score.
      </p>
    </div>
  );
};

/**
 * @param {{ before: number, after: number, label?: string, deltaDigits?: number }} props
 */
const ScoreDelta = ({ before, after, label = 'Portfolio Health', deltaDigits = 1 }) => {
  const shouldReduceMotion = useReducedMotion();
  const delta = after - before;
  const color = deltaColor(delta);
  const score = useMotionValue(shouldReduceMotion ? after : before);
  const text = useTransform(score, (v) => v.toFixed(1));
  const width = useTransform(score, (v) => `${(v / MAX_SCORE) * 100}%`);

  useEffect(() => {
    if (shouldReduceMotion) {
      score.set(after);
      return undefined;
    }
    score.set(before);
    const controls = animate(score, after, { duration: COUNT_MS / 1000, ease: 'easeOut' });
    return () => controls.stop();
  }, [before, after, score, shouldReduceMotion]);

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-hover)' }}>
      <div className="font-mono text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {label}
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[15px]" style={{ color: 'var(--text-ghost)' }}>
          {before.toFixed(1)}
        </span>
        <ArrowRight size={12} style={{ color: 'var(--text-ghost)' }} aria-hidden="true" />
        <motion.span aria-hidden="true" className="font-mono text-[26px] font-bold leading-none" style={{ color }}>
          {text}
        </motion.span>
        <span className="sr-only">
          {label} {before.toFixed(1)} changes to {after.toFixed(1)}
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
          style={{ background: 'var(--surface-raised)', color }}>
          {delta > 0 ? '+' : ''}{delta.toFixed(deltaDigits)}
        </span>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-subtle)' }}>
        <motion.div className="h-full rounded-full" style={{ width, background: color }} />
      </div>
    </div>);};

export default ScoreDelta;