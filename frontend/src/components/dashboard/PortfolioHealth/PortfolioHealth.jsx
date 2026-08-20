import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import SecondaryButton from '../shared/SecondaryButton';

const toneColor = (x = 0) => {
  if (x >= 7) return 'var(--signal-positive)';
  if (x >= 5) return 'var(--signal-warning)';
  return 'var(--signal-negative)';
};

const RAD = 52;
const CIRC = 2 * Math.PI * RAD;

/** @type {Record<string, string>} */
const TARGET = {
  diversification: 'sector-allocation',
  sectorExposure: 'sector-allocation',
  singleStockRisk: 'holdings-table',
  portfolioBreadth: 'holdings-table',
  benchmarkPerformance: 'performance-vs-benchmark',
};

/**
 * @param {{
 *   health: {
 *     score: number|null,
 *     label: string|null,
 *     subscores: { key: string, label: string, weight: number, value: number, detail: string, target: string, improvement: string }[],
 *   },
 *   onScrollTo?: (target: string) => void,
 * }} props
 */
const PortfolioHealth = ({ health, onScrollTo }) => {
  const [expanded, setExpanded] = useState(() => new Set());

  /** @param {string} key */
  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (health.score === null) {
    return (
      <GlassPanel>
        <PanelHead label="Portfolio Health" />
        <div className="p-6 text-center">
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Health score appears once you have holdings to analyse.
          </p>
        </div>
      </GlassPanel>
    );}

  const color = toneColor(health.score);
  const dashoffset = CIRC * (1 - health.score / 10);

  return (
    <GlassPanel>
      <PanelHead
        label="Portfolio Health"
        help="A 0-10 score built from five weighted factor: sector diversification, sector exposure, single-stock risk, portfolio breadth, and performance vs your benchmark index."/>
      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="relative mx-auto h-[152px] w-[152px] shrink-0">
          <svg viewBox="0 0 130 130" className="h-full w-full -rotate-90">
            <circle cx="65" cy="65" r={RAD} fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
            <circle
              cx="65"
              cy="65"
              r={RAD}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashoffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-[34px] font-bold leading-none" style={{ color }}>
              {health.score.toFixed(1)}
            </div>
            <div className="font-mono text-[10px]" style={{ color: 'var(--text-ghost)' }}>
              / 10
            </div>
            <div className="mt-1.5 font-mono text-[10px] tracking-widest" style={{ color }}>
              {health.label}
            </div>
          </div>
        </div>

        <div>
          <div className="space-y-3">
            {health.subscores.map((x) => {
              const isOpen = expanded.has(x.key);
              return (
                <div key={x.key} data-testid={`health-factor-${x.key}`}>
                  <button
                    type="button"
                    onClick={() => onScrollTo?.(TARGET[x.key])}
                    className="block w-full text-left transition-opacity hover:opacity-80">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
                          {x.label}
                        </span>
                        <span className="font-mono text-[9px]" style={{ color: 'var(--text-ghost)' }}>
                          {Math.round(x.weight * 100)}% weight
                        </span>
                      </span>
                      <span className="font-mono text-[11px] shrink-0" style={{ color: toneColor(x.value) }}>
                        {x.value.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-subtle)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${x.value * 10}%`, background: toneColor(x.value), transition: 'width 0.5s ease' }}/>
                    </div>
                  </button>

                  <SecondaryButton
                    size="sm"
                    className="mt-1.5"
                    onClick={() => toggle(x.key)}
                    expanded={isOpen}
                    trailing={
                      <ChevronDown
                        size={10}
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                      />}>
                    Why
                  </SecondaryButton>
                  {isOpen && (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                        {x.detail}
                      </p>
                      <p className="font-mono text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Target: </span>
                        {x.target}
                      </p>
                      <p className="text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
                        {x.improvement}
                      </p>
                    </div>
                  )}
                </div>
              );})}
          </div>

          <SecondaryButton to="/portfolio" className="mt-4">
            View Health Analysis
          </SecondaryButton>
        </div>
      </div>
    </GlassPanel>
  );};
export default PortfolioHealth;
