import { useState, useEffect } from 'react';
import {useNavigate, Link} from 'react-router-dom';

import useIndicators from '../../hooks/useIndicators';
import { ROUTES } from '../../utils/constants';

const INDICATORS = {
  capm: {
    label: 'CAPM',
    tooltip: 'The return you\'d expect from this stock, given how much it tends to move with the market',
    signal:   (v) => v > 14 ? 'positive' : 'neutral',
    describe: (v) => `${v}% expected annual return for this risk level`,
    why: 'A rough benchmark for what return this stock should earn you, based on its risk. If it\'s actually returning much less than this over time, it may not be worth the risk.',
    plainFormula: 'Starts with a safe baseline return, then adds extra expected return based on how much more the stock swings compared to the market.',
    formula: 'Expected Return = Risk-Free Rate + Beta x (Market Return - Risk-Free Rate)',
  },
  pe_ratio: {
    label: 'P/E Ratio',
    tooltip: 'How much you\'re paying for every rand of profit the company makes. Below 15 is cheap; above 30 may be pricey unless it\'s a fast-growing company.',
    signal:   (v) => v < 15 ? 'positive' : v > 30 ? 'negative' : 'neutral',
    describe: (v) => v < 15 ? 'Below market average' : v > 30 ? 'Premium valuation' : 'In line with market',
    why: 'Shows how expensive a stock is relative to its actual profit. High usually means investors expect strong growth ahead; low can mean bargain, or a sign the market has doubts.',
    plainFormula: 'Takes current share price and divides it by how much profit the company made per share over the last year.',
    formula: 'P/E Ratio = Share Price / Earnings Per Share (EPS).',
    sectorCaveat:'A "normal" P/E looks very different accross industries - banks, retail and tech companies. A lower P/E here doesn\'t mean better, just a lower price relative to that company\'s earnings.',
  },
  altman_z: {
    label: 'Altman Z',
    tooltip: 'Score estimating how likely a company is to face financial trouble. Above 2.99 is safe; below 1.81 signals distress; in between is the grey zone.',
    signal:   (v) => v > 2.99 ? 'positive' : v < 1.81 ? 'negative' : 'neutral',
    describe: (v) => v > 2.99 ? 'Safe zone' : v < 1.81 ? 'Distress zone' : 'Grey zone — monitor',
    why: 'This is a financial health check - it blends several signals from a company\'s balance sheet to flag whether it might struggle to pay its debts in the upcoming years. Designed for manufacturers and retailers.',
    plainFormula: 'Combines a few balance-sheet signals into one score.',
    formula: '1.2x(Working Capital/Assets) + 1.4x(Retained Earnings/Assets) + 3.3x(EBIT/Assets) + 0.6x(Market Cap/Liabilities) + 1.0x(Sales/Assets)',
    sectorCaveat: 'Only fair to compare within similar industries. Better to check each stock against the base guidelines than rank holdings against each other',
  },
  sharpe: {
    label: 'Sharpe Ratio',
    tooltip: "How much you're getting relative to the ups and downs. Above 1.0 is good; negative means the risk isn't being rewarded.",
    signal:   (v) => v >= 1 ? 'positive' : v < 0 ? 'negative' : 'neutral',
    describe: (v) => v >= 1 ? 'Good risk-adjusted return' : v < 0 ? 'Below risk-free rate' : 'Modest return for risk',
    why: 'Lets you compare a smooth ride agaisnt a bumpy one fairly, instead of just looking at which stock ended up higher.',
    plainFormula: 'Return above what you\'d get risk-free, divided by how much the price bounces around.',
    formula: 'Sharpe = (Return - Risk-Free Rate) / Standard Deviation of Returns',
  },
  beta: {
    label: 'Beta',
    tooltip: 'Measures how much this stock moves relative to the market. Above 1 means it swings more than the market.',
    signal:   (v) => v < 1 ? 'positive' : v > 1.5 ? 'negative' : 'neutral',
    describe: (v) => v < 1 ? 'Less volatile than market' : v > 1.5 ? 'Highly volatile' : 'Moves with the market',
    why: 'Shows how "jumpy" a stock is next to the market as a whole - bigger swings both up and down above 1, calmer below 1.',
    plainFormula: 'Measures how closely this stock\'s price tracks the market\'s moves.',
    formula: 'Beta = Covariance(Stock Returns, Market Returns) / Variance(Market Returns)',
  },
  sortino: {
    label: 'Sortino Ratio',
    tooltip: 'Like the Sharpe ratio but only counts the downside swings against the stock. Above 1 is good.',
    signal:   (v) => v >= 1 ? 'positive' : v < 0 ? 'negative' : 'neutral',
    describe: (v) => v >= 1 ? 'Good downside-adjusted return' : v < 0 ? 'Poor downside performance' : 'Moderate',
    why: 'Fairer version of Sharpe - only counts bad, downward swings as risk, not upward surprises.',
    plainFormula: 'Same idea as Sharpe, but only counts the drops on bad days, not the good days.',
    formula: 'Sortino = (Return - Risk-Free Rate) / Downside Deviation',
  },
  rsi: {
    label: 'RSI',
    tooltip: 'A short-term momentum gauge on a 0-100 scale. Above 70 is overbought; below 30 is oversold.',
    signal:   (v) => v < 30 ? 'positive' : v > 70 ? 'negative' : 'neutral',
    describe: (v) => v > 70 ? 'Overbought - possible pullback' : v < 30 ? 'Oversold - possible bounce' : 'Neutral momentum',
    why: 'Insight into whether the price has moved unusally fast. Best used alongside other information.',
    plainFormula: 'Compares recent up-days to down-days over about two weeks.',
    formula: 'RSI = 100 - [100 / (1 + Average Gain / Average Loss)], typically over a 14-day window',
  },
};

const ALL_INDICATORS = Object.keys(INDICATORS);

const presets = [
  {id: 'popular', label: 'Most Popular', keys: ['capm', 'pe_ratio', 'sharpe', 'beta']},
  {id: 'value', label: 'Value Investing', keys: ['pe_ratio', 'altman_z', 'capm']},
  {id: 'risk', label: 'Risk & Volatility', keys: ['beta', 'sharpe', 'sortino', 'altman_z']},
  {id: 'technical', label: 'Technical / Momentum', keys: ['rsi', 'beta']},
  {id: 'all', label: 'All Indicators', keys: ALL_INDICATORS},
];

const STORAGE_KEY = 'analytics_indicator_pref';
const CUSTOM_PRESETS_KEY = 'analytics_custom_presets';

function loadIndicatorPrefs(){
  try{
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch{
    return {};
  }
}

function loadCustomPresets(){
  try{
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch{
    return [];
  }
}

const Tooltip = ({ text, children, align = 'left' }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-default" 
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}> 
    
      {children}
      {show && (
        <span className="absolute bottom-full mt-2 w-64 rounded-lg px-3.5 py-3 pointer-events-none"
          style={{
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            background: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-mid)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
            whiteSpace: 'normal',
            fontSize: '11px',
            lineHeight: '1.6',
            letterSpacing: '0.02em',
            fontWeight: 400,
            zIndex: 9999,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
};

const InfoIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-ghost)', flexShrink: 0 }}>
    <circle cx="6" cy="6" r="5.5" stroke="currentColor"/>
    <path d="M6 5.5v3M6 4h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const EditIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
  </svg>
);

const formatValue = (value) => {
  const numericValue = Number(value);
  if(!Number.isFinite(numericValue)){
    return value;
  }
    return numericValue.toFixed(2);
  };

const IndicatorCell = ({ indicatorKey, result, loading, onSelect }) => {
  const meta = INDICATORS[indicatorKey];
  const color = (sig) =>
    sig === 'positive' ? 'var(--signal-positive)'
    : sig === 'negative' ? 'var(--signal-negative)'
    : 'var(--text-primary)';

  if (loading) return (
    <div className="flex flex-col gap-1.5 animate-pulse pt-1">
      <div className="h-4 w-12 rounded" style={{ background: 'var(--border-subtle)' }}/>
      <div className="h-2.5 w-16 rounded" style={{ background: 'var(--border-subtle)' }}/>
    </div>
  );

  if (!result || result.status === 'error') return (
    <button onClick={onSelect} className="flex flex-col gap-0.5 pt-1 text-left w-full cursor-pointer">
      <span className="text-[11px] font-mono" style={{ color: 'var(--signal-negative,#ef4444)' }}>Error</span>
      <span className="text-[9px]" style={{ color: 'var(--text-ghost,#444)' }}>Calc failed</span>
    </button>
  );

  if (result.status === 'insufficient_data') return (
    <button onClick={onSelect} className="flex flex-col gap-0.5 pt-1 text-left w-full cursor-pointer">
      <span className="text-[11px] font-mono" style={{ color: 'var(--text-ghost,#444)' }}>N/A</span>
      <span className="text-[9px] leading-tight" style={{ color: 'var(--text-ghost,#444)' }}>
        {result.reason?.split('.')[0]}
      </span>
    </button>
  );

  const sig = meta.signal(result.value);
  return (
    <button data-testid={`indicator-${indicatorKey}`} onClick={onSelect} className="flex flex-col gap-0.5 pt-1 text-left w-full cursor-pointer">
      <span className="text-sm font-mono font-semibold tabular-nums"
        style={{ color: color(sig), letterSpacing: '-0.02em' }}>
        {formatValue(result.value)}{result.unit}
      </span>
      <span className="text-[9px] leading-tight" style={{ color: 'var(--text-ghost)' }}>
        {meta.describe(result.value)}
      </span>
    </button>
  );
};

const StockRow = ({ stock, loading, results, index, onCellSelect, visibleKeys, onEdit, onQuickRemove }) => (
  <div className="glass-surface rounded-xl"
    style={{ animation: 'fadeSlideIn 0.3s ease both', animationDelay: `${index * 70}ms` }}>
    <div className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0"
        style={{ background: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
        {stock.ticker.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{stock.ticker}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>{stock.name}</p>
      </div>
      <button onClick={onEdit} aria-label={`Customize indicators for ${stock.ticker}`}
      className="flex items-center gap-1 text-[9px] font-mono px-2 py-1.5 rounded flex-shrink-0 cursor-pointer"
      style={{color: 'var(--text-secondary)', border: '1px solid var(--border-mid)'}}>
        <EditIcon />
        Edit
      </button>
    </div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', overflow: 'visible'}}>
      {visibleKeys.map((key, i) => (
        <div key={key} className="px-3 pb-3" style={{ position: 'relative', overflow: 'visible', borderRight: i < visibleKeys.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
          <div className="flex items-start justify-between gap-1 pt-3">
            <Tooltip text={INDICATORS[key].tooltip} align={i >= visibleKeys.length - 2 ? 'right' : 'left'}>
            <span className="text-[9px] uppercase tracking-widest font-medium flex items-center gap-1"
              style={{ color: 'var(--text-ghost)' }}>
              {INDICATORS[key].label} <InfoIcon />
            </span>
          </Tooltip>
          <button onClick={() => onQuickRemove(key)} aria-label={`Remove ${INDICATORS[key].label}`}
            title={`Remove ${INDICATORS[key].label}`}
            className="opacity-0 group-hover:opacity-100 text-[11px] leading-none flex-shrink-0 cursor-pointer"
            style={{color: 'var(--text-ghost)'}}>
            x
          </button>
          </div>
          <IndicatorCell indicatorKey={key} result={results?.[key]} loading={loading} onSelect={() => onCellSelect(key, stock.ticker)}
            />
        </div>
      ))}
    </div>
  </div>
);

const IndicatorDetailModal = ({ indicatorKey, activeTicker, stocks, onClose }) => {
  if (!indicatorKey) return null;
  const meta = INDICATORS[indicatorKey];

  const color = (sig) =>
    sig === 'positive' ? 'var(--signal-positive,#22c55e)'
    : sig === 'negative' ? 'var(--signal-negative,#ef4444)'
    : 'var(--text-primary,#e5e5e5)';

  const comparisonRows = stocks
    .map((stock) => {
      const result = stock[indicatorKey];
      if (!result || result.status !== 'ok') return null;
      return { ticker: stock.ticker, name: stock.name, value: result.value, unit: result.unit, sig: meta.signal(result.value)};
    })
    .filter(Boolean)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

    return (
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10000}} onClick={onClose} role="presentation">
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div className="terminal-card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle,#2a2a2a)' }}>
            <h2 className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-primary,#e5e5e5)' }}>
              {meta.label}
            </h2>
            <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded text-xs leading-none" style={{ color: 'var(--text-ghost,#444)', border: '1px solid var(--border-subtle,#2a2a2a)' }}>
              x
            </button>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-medium mb-1.5" style={{ color: 'var(--text-ghost,#444)' }}>
                Why it matters
              </p>
              <p data-testid="indicator-explanation" className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary,#a0a0a0)' }}>
                {meta.why}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-medium mb-1.5" style={{ color: 'var(--text-ghost,#444)' }}>
                How it&apos;s worked out
              </p>
              <p className="text-[11px] leading-relaxed px-3 py-2.5 rounded" style={{ color: 'var(--text-primary,#e5e5e5)', background: 'var(--border-subtle,#2a2a2a)' }}>
                {meta.plainFormula}
              </p>
              <p className="text-[9px] font-mono mt-1.5" style={{ color: 'var(--text-ghost,#444)' }}>
                {meta.formula}
              </p>
            </div>
            {meta.sectorCaveat && (
              <div className="px-3 py-2.5 rounded" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary,#a0a0a0)' }}>
                  <span className="font-semibold" style={{ color: 'var(--signal-negative,#ef4444)' }}>
                    Sector note -
                  </span>
                  {meta.sectorCaveat}
                </p>
              </div>
            )}
            <div>
          <p className="text-[9px] uppercase tracking-widest font-medium mb-1.5" style={{ color: 'var(--text-ghost,#444)' }}>
            Across your holdings
          </p>
          {comparisonRows.length === 0 ? (
            <p className="text-[10px]" style={{ color: 'var(--text-ghost,#444)' }}>
              No holdings currently have a value for this indicator.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {comparisonRows.map((row) => (
                <div key={row.ticker} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: row.ticker === activeTicker ? 'var(--border-subtle,#2a2a2a)' : 'transparent', border: row.ticker === activeTicker ? '1px solid var(--text-ghost,#444)' : '1px solid transparent',}}>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-medium" style={{ color: 'var(--text-primary,#e5e5e5)' }}>
                      {row.ticker}
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--text-ghost,#444)' }}>
                      {row.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: color(row.sig)}}>
                    {formatValue(row.value)}{row.unit}
                  </span>
                </div>
              ))}
              </div>
          )}
          </div>
          </div>
        </div>
      </div>
    )
}

const IndicatorPickerModal = ({ticker, name, selectedKeys, customPresets, onSave, onApplyToAll, onSaveCustomPreset, onDeleteCustomPreset, onClose}) => {
  const [draft, setDraft] = useState(selectedKeys);
  const [newPresetName, setNewPresetName] = useState('');
  const[applyToAll, setApplyToAll] = useState(false);

  const toggle = (key) => {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const canSave = draft.length > 0;
  const canSavePreset = canSave && newPresetName.trim().length > 0;

  const handleSaveAsPreset = () => {
    const trimmed = newPresetName.trim();
    if(!trimmed || draft.length === 0) return;
    onSaveCustomPreset(trimmed, draft);
    setNewPresetName('');
  };

  const handleSave = () => {
    if(!canSave) return;
    if(applyToAll) {
      onApplyToAll(draft);
    } else{
      onSave(draft);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.6)', zIndex: 10000}} onClick={onClose} role="presentation">
      <div className="terminal-card w-full max-w-md max-h-[85vh] overflow-y-auto" style={{background: 'var(--bg-primary,#0a0a0a)', border: '1px solid var(--border-subtle,#2a2a2a)'}} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{borderBottom: '1px solid var(--border-subtle,#2a2a2a)'}}>
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest" style={{color: 'var(--text-primary,#e5e5e5)'}}>
              Customize Indicators
            </h2>
            <p className="text-[10px] mt-0.5" style={{color: 'var(--text-ghost,#444)'}}>{ticker} - {name}</p>
          </div>
          <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded text-xs leading-none" style={{color: 'var(--text-ghost,#444)', border: '1px solid var(--border-subtle,#2a2a2a)'}}>
            x
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-medium mb-2" style={{color: 'var(--text-ghost,#444)'}}>
              Presets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button key={preset.id} onClick={() => setDraft(preset.keys)}
                className="text-[10px] font-mono px-2.5 py-1.5 rounded cursor-pointer"
                style={{border: '1px solid var(--border-subtle,#2a2a2a)', color: 'var(--text-secondary,#a0a0a0)', background: 'transparent'}}>
                  {preset.label}
                </button>
              ))}
            </div>
            <Link to={ROUTES.AI_CHAT} target="_blank" rel="noopener noreferrer"
            className="text-[9px] mt-2 inline-block underline"
            style={{color: 'var(--accent-primary)'}}>
              Not sure which preset to pick? Ask the AI Assistant
            </Link>
          </div>
          {customPresets.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-medium mb-2" style={{color: 'var(--text-ghost,#444)'}}>
                Your Presets
              </p>
              <div className="flex flex-wrap gap-1.5">
                {customPresets.map((preset) => (
                  <span key={preset.id} className="inline-flex items-center rounded overflow-hidden" style={{border: '1px solid var(--border-subtle,#2a2a2a)'}}>
                    <button onClick={() => setDraft(preset.keys)} className="text-[10px] font-mono pl-2.5 pr-1.5 py-1.5 cursor-pointer" style={{color: 'var(--text-secondary,#a0a0a0)', background: 'transparent', border: 'none'}}>
                      {preset.label}
                    </button>
                    <button onClick={() => onDeleteCustomPreset(preset.id)} aria-label={`Delete preset ${preset.label}`} title={`Delete preset ${preset.label}`} className="text-[10px] pr-2 cursor-pointer" style={{color: 'var(--text-ghost,#444)', background: 'transparent', border: 'none'}}>
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] uppercase tracking-widest font-medium" style={{color: 'var(--text-ghost,#444)'}}>
                Indicators
              </p>
              <button onClick={() => setDraft([])} className="text-[9px] cursor-pointer" style={{color: 'var(--text-ghost,#444)'}}>
                Clear All
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {ALL_INDICATORS.map((key) => {
                const meta = INDICATORS[key];
                const isSelected = draft.includes(key);
                return(
                  <button key={key} onClick={() => toggle(key)}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded text-left cursor-pointer"
                  style={{background: isSelected ? 'var(--border-subtle,#2a2a2a)' : 'transparent',
                    border: isSelected ? '1px solid var(--text-ghost,#444)' : '1px solid transparent',
                  }}>
                    <span className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{border:'1px solid var(--text-ghost,#444)', background: isSelected ? 'var(--text-primary,#e5e5e5)' : 'transparent'}}>
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-6" stroke="var(--bg-primary,#0a0a0a)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium" style={{color: 'var(--text-primary,#e5e5e5)'}}>{meta.label}</span>
                      <span className="text-[9px] leading-tight" style={{color: 'var(--text-ghost,#444)'}}>{meta.tooltip}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-medium mb-2" style={{color: 'var(--text-ghost,#444)'}}>
              Save Current Selection As Preset
            </p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset name"
                className="flex-1 text-[10px] font-mono px-2.5 py-1.5 rounded"
                style={{background: 'transparent', border: '1px solid var(--border-subtle,#2a2a2a)', color: 'var(--text-primary,#e5e5e5)'}}
                />
                <button onClick={handleSaveAsPreset} disabled={!canSavePreset} className="text-[10px] font-mono px-2.5 py-1.5 rounded" style={{border: '1px solid var(--border-subtle,#2a2a2a)', color: canSavePreset ? 'var(--text-primary,#e5e5e5)' : 'var(--text-ghost,#444)',
                  cursor: canSavePreset ? 'pointer' : 'not-allowed',
                  background: 'transparent',
                }}>
                  Add
                </button>
            </div>
          </div>
          {!canSave && (
            <p className="text-[10px]" style={{color: 'var(--signal-negative,#ef4444)'}}>
              Select at least one indicator.
            </p>
          )}
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-3 text-[10px] cursor-pointer" style={{color: 'var(--text-secondary,#a0a0a0)'}}>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                style={{accentColor: 'var(--text-primary,#e5e5e5)'}}
                />
                Apply to all holdings instead of just {ticker}
            </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-[10px] font-mono px-3.5 py-2 rounded cursor-pointer"
            style={{color: 'var(--text-ghost,#444)', border: '1px solid var(--border-subtle,#2a2a2a)'}}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave} className="text-[10px] font-mono px-3.5 py-2 rounded"
              style={{
                background: canSave ? 'var(--text-primary,#e5e5e5)' : 'var(--border-subtle,#2a2a2a)',
                color: canSave ? 'var(--bg-primary,#0a0a0a)' : 'var(--text-ghost,#444)',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}>
                {applyToAll ? 'Apply to All' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Analytics() {
  const { stockData, loading, error } = useIndicators();
  const navigate = useNavigate();
  const stocks = Object.values(stockData).map((s) => s.results).filter(Boolean);
  const [selected, setSelected] = useState(null);
  const [editingTicker, setEditingTicker] = useState(null);
  const [indicatorPrefs, setIndicatorPrefs] = useState(loadIndicatorPrefs);
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);

  useEffect(() => {
    try{
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(indicatorPrefs));
    }
    catch{
      //Local storage not available
    }
  }, [indicatorPrefs]);

  useEffect(() => {
    try{
      window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
    }
    catch{
      //Local Storage not available
    }
  }, [customPresets]);

  const getVisibleKeys = (ticker) => {
    const saved = indicatorPrefs[ticker];
    return saved && saved.length > 0 ? saved : ALL_INDICATORS;
  }

  const updateVisibleKeys = (ticker, keys) => {
    setIndicatorPrefs((prev) => ({...prev, [ticker]: keys}));
  };

  const handleQuickRemove = (ticker, key) => {
    const current = getVisibleKeys(ticker);
    const next = current.filter((k) => k !== key);
    if(next.length === 0) return;
    updateVisibleKeys(ticker, next);
  }

  const handleApplyToAllHoldings = (keys) => {
    setIndicatorPrefs((prev) => {
      const next = {...prev};
      stocks.forEach((s) => {
        next[s.ticker] = keys;
      });
      return next;
    });
  };

  const handleSaveCustomPreset = (label, keys) => {
    const id = `custom-${Date.now()}`;
    setCustomPresets((prev) => [...prev, {id, label, keys}]);
  };

  const handleDeleteCustomPreset = (id) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  }

  const editingStock = stocks.find((s) => s.ticker === editingTicker)

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="p-4 flex flex-col gap-4 max-w-[1600px] mx-auto w-full" aria-label="Analytics page">
        <div className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h1 className="text-xs font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-page,#e5e5e5)' }}>Analytics</h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost,#444)' }}>
              How your holdings are doing - hover a label for a quick explanation, click a value to learn more
              </p>
              <Link to={ROUTES.AI_CHAT} target="_blank" rel="noopener noreferrer"
              className="text-[10px] mt-1 inline-block underline"
              style={{ color: 'var(--accent-primary)' }}>
                Still not understanding the indicators? Ask the AI Assistant
              </Link>
          </div>
          <span className="text-[10px] px-2 py-1 rounded font-mono"
            style={{ color: 'var(--text-ghost)', border: '1px solid var(--border-subtle)' }}>
            {stocks.length} holdings
          </span>
        </div>

        {error && (
          <div className="glass-surface rounded-xl text-center p-8" role="alert">
            <p className="text-xs font-medium" style={{ color: 'var(--signal-negative)' }}>
              Failed to load indicators
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        )}
        {!loading && !error && stocks.length === 0 && (
          <div className="glass-surface rounded-xl text-center p-8">
            <p className="text-xs font-medium" style={{color: 'var(--text-primary,#e5e5e5)'}}>
              No Holdings
              </p>
              <p className="text-[10px] mt-1" style={{color: 'var(--text-secondary,#a0a0a0)'}}>
                Add some holdings to your portfolio to see indicators here.
              </p>
              <button onClick={() => navigate('/Portfolio')}
               className="mt-4 text-[10px] font-mono px-4 py-2 rounded" 
               style={{background:'var(--accent-primary)',color:'var(--text-on-accent)'}}>
                Import Holdings
               </button>
          </div>
        )}
        {(loading || stocks.length > 0) && (
        <div className="flex flex-col gap-3">
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key -- static skeleton count, never reordered
                <div key={i} className="glass-surface rounded-xl overflow-hidden animate-pulse">
                  <div className="h-14 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="h-3 w-16 rounded mb-2" style={{ background: 'var(--border-subtle)' }}/>
                    <div className="h-2.5 w-24 rounded" style={{ background: 'var(--border-subtle)' }}/>
                  </div>
                  <div className="grid grid-cols-7 p-3 gap-3">
                    {Array.from({ length: 7 }).map((_, j) => (
                      // eslint-disable-next-line react/no-array-index-key -- static skeleton count, never reordered
                      <div key={j} className="h-10 rounded" style={{ background: 'var(--border-subtle)' }}/>
                    ))}
                  </div>
                </div>
              ))
            : stocks.map((stock, i) => (
                <StockRow
                  key={stock.ticker}
                  stock={stock}
                  index={i}
                  loading={false}
                  results={stock}
                  visibleKeys={getVisibleKeys(stock.ticker)}
                  onCellSelect={(indicatorKey, ticker) => setSelected({ indicatorKey, ticker })}
                  onEdit={() => setEditingTicker(stock.ticker)}
                  onQuickRemove={(key) => handleQuickRemove(stock.ticker, key)}
                />
              ))
          }
        </div>
        )}
      </div>
      <IndicatorDetailModal
        indicatorKey={selected?.indicatorKey}
        activeTicker={selected?.ticker}
        stocks={stocks}
        onClose={() => setSelected(null)}
      />
      {editingTicker && (
        <IndicatorPickerModal
        ticker={editingTicker}
        name={editingStock?.name}
        selectedKeys={getVisibleKeys(editingTicker)}
        customPresets={customPresets}
        onSave={(keys) => {updateVisibleKeys(editingTicker, keys); setEditingTicker(null);}}
        onApplyToAll={(keys) => {handleApplyToAllHoldings(keys); setEditingTicker(null);}}
        onSaveCustomPreset={handleSaveCustomPreset}
        onDeleteCustomPreset={handleDeleteCustomPreset}
        onClose={() => setEditingTicker(null)}
        />
      )}
    </>
  );
}
