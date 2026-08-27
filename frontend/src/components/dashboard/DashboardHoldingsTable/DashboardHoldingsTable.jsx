import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AnimatedReveal from '../shared/AnimatedReveal';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import CardMascotTrigger from '../../chat/CardMascotTrigger/CardMascotTrigger';
import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';
import Money from '../../common/Money/Money';
import { zar } from '../../../utils/currency';
import { getConcRisk, buildHoldingsQuestions, buildSectorQuestions } from '../../../utils/dashboardInsights';
import SectorAllocation from '../SectorAllocation/SectorAllocation';

/** @param {string|null|undefined} iso */
const formatMonthYear = (iso) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
};

/** @param {{ label: string, value: string, color?: string, money?: boolean }} props */
const HoldingDetailStat = ({ label, value, color = 'var(--text-primary)', money = true }) => (
  <div>
    <div className="font-mono text-[8px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
    </div>
    {money ? (
      <Money as="div" className="mt-0.5 font-mono text-[11px] font-semibold" style={{ color }}>
        {value}
      </Money>
    ) : (
      <div className="mt-0.5 font-mono text-[11px] font-semibold" style={{ color }}>
        {value}
      </div>
    )}
  </div>);

/** @param {{ label: string, value: string }} props */
const ExposureStat = ({ label, value }) => (
  <div>
    <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
    </div>
    <div className="mt-0.5 font-mono text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
      {value}
    </div>
  </div>);

  /**
  * @param {{ sector: string, tickers: string[], summary: string, isSelected?: boolean }} props
  */
  const MarketContextRow = ({ sector, tickers, summary, isSelected }) => (
  <div
    className="rounded-lg px-2.5 py-2.5 transition-colors"
    style={{
      background: isSelected ? 'var(--accent-subtle)' : undefined,
      borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
    <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
      {sector}
    </span>
    <p className="mt-1 text-[13px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
      {summary}
    </p>
    {tickers?.length > 0 && (
      <p className="mt-1 font-mono text-[10px] tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {tickers.join(', ')}
      </p>
    )}
  </div>
);

/**
 * @param {{
 *   holdings: any[],
 *   sectorData: { name: string, value: number }[],
 *   marketContext?: { available: boolean, label?: string, sectors: any[] } | null,
 *   flashHoldings?: boolean,
 *   flashSector?: boolean,
 * }} props
 */
const DashboardHoldingsTable = ({ holdings, sectorData, marketContext, flashHoldings, flashSector }) => {
  const [selectedSector, setSelectedSector] = useState(/** @type {string|null} */ (null));
  const [expandedTickers, setExpandedTickers] = useState(() => new Set());

  /** @param {string} ticker */
  const toggleExpanded = (ticker) => {
    setExpandedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const bySector = selectedSector
    ? holdings.filter((h) => (h.sector ?? 'Other') === selectedSector)
    : holdings;
  const sorted = [...bySector].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const contextSectors = [...(marketContext?.sectors ?? [])].sort(
    (a, b) => (b.weight_pct ?? 0) - (a.weight_pct ?? 0));

  return (
    <div className="group relative">
      <CardMascotTrigger
        questions={[...buildHoldingsQuestions(holdings), ...buildSectorQuestions(sectorData)]}
        label="Ask AI about your positions"
        className="-right-6 -top-6"/>
      <GlassPanel className="flex flex-col">
      <PanelHead label="All Positions" />
      {holdings.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px]" style={{ color: 'var(--text-ghost)' }}>
          Upload holdings to see them here.
        </div>
      ) : (
        <>
        <div className="flex flex-1 flex-col gap-5 p-5 lg:flex-row">
          <div
            id="holdings-table"
            className={`dashboard-highlight flex flex-col rounded-xl lg:w-1/2 lg:flex-none ${flashHoldings ? 'is-active' : ''}`}
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <HelpTooltip text="The Low/Moderate/High badge reflects position size only - it's one input into risk, not a full picture of it." />
            </div>
            <div className="mb-2.5 grid grid-cols-2 gap-2.5 pb-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <ExposureStat label="Positions" value={String(holdings.length)} />
              <ExposureStat label="Sectors" value={String(sectorData.length)} />
            </div>

            <div className="mb-1 flex items-center justify-between px-2">
              <span className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                Holding
              </span>
              <div className="flex items-center gap-2.5 font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                <span className="w-[68px] text-right">Risk</span>
                <span className="w-[44px] text-right">Weight</span>
                <span className="w-[60px] text-right">Today</span>
                <span className="w-[84px] text-right">Value</span>
              </div>
            </div>

            <div className="max-h-[420px] flex-1 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              {sorted.length === 0 ? (
                <p className="py-4 text-center text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                  No holdings in {selectedSector}
                </p>
              ) : (
                sorted.map((h) => {
                  const weight = totalValue ? ((h.value ?? 0) / totalValue) * 100 : 0;
                  const positive = (h.daily_change_pct ?? 0) >= 0;
                  const holdingSector = h.sector ?? 'Other';
                  const isExpanded = expandedTickers.has(h.ticker);
                  const gainLoss = h.gain_loss ?? 0;
                  const gainLossPct = h.gain_loss_pct ?? 0;
                  const gainPositive = gainLoss >= 0;
                  const heldSinceLabel = formatMonthYear(h.first_purchase_date);
                  return (
                    <div key={h.ticker} data-testid={`holding-row-${h.ticker}`}>
                      <div className="flex w-full items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSector(selectedSector === holdingSector ? null : holdingSector)}
                          className="flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-[12px] font-bold">{h.ticker}</div>
                            <div className="truncate text-[10px]" style={{ color: 'var(--text-ghost)' }}>{h.name}</div>
                          </div>
                          <div className="flex items-center gap-2.5 text-right">
                            <span
                              className="w-[68px] rounded px-1.5 py-0.5 text-center font-mono text-[9px] font-semibold tracking-widest"
                              style={{ color: getConcRisk(weight).color, background: 'var(--surface-hover)' }}
                              title={`${getConcRisk(weight).label} concentration - ${weight.toFixed(1)}% of your book`}
                            >
                              {getConcRisk(weight).label}
                            </span>
                            <span className="w-[44px] font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>{weight.toFixed(1)}%</span>
                            <span className="w-[60px] font-mono text-[11px]" style={{ color: positive ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
                              {positive ? '+' : ''}{(h.daily_change_pct ?? 0).toFixed(2)}%
                            </span>
                            <Money as="span" className="w-[84px] font-mono text-[12px] font-semibold">{zar(h.value ?? 0)}</Money>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpanded(h.ticker)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Hide cost basis and holding period' : 'Show cost basis and holding period'}
                          className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <ChevronDown
                            size={12}
                            style={{ color: 'var(--text-ghost)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                          />
                        </button>
                      </div>

                      <AnimatedReveal show={isExpanded}>
                        <div className="mb-0.5 grid grid-cols-3 gap-2 rounded-md px-2.5 py-2" style={{ background: 'var(--surface-hover)' }}>
                          <HoldingDetailStat label="Avg Cost" value={zar(h.avg_cost ?? 0)} />
                          <HoldingDetailStat
                            label="Total Return"
                            value={`${gainPositive ? '+' : ''}${zar(gainLoss)} (${gainPositive ? '+' : ''}${gainLossPct.toFixed(1)}%)`}
                            color={gainPositive ? 'var(--signal-positive)' : 'var(--signal-negative)'}
                          />
                          <HoldingDetailStat label="Held Since" value={heldSinceLabel ?? 'Cost data not available'} money={false} />
                        </div>
                      </AnimatedReveal>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="w-full shrink-0 lg:flex lg:h-full lg:w-1/2 lg:flex-col lg:justify-center">
            <SectorAllocation
              sectorData={sectorData}
              selected={selectedSector}
              onSelectSector={setSelectedSector}
              flashSector={flashSector}
            />
          </div>
        </div>

        {marketContext?.available && contextSectors.length > 0 && (
          <div className="border-t px-5 pb-2 pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="mb-1 flex items-center gap-1.5">
              <p className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                {marketContext.label ?? 'Illustrative market context'} - based on your holdings&apos; own price moves, not live news
              </p>
              <HelpTooltip text="Plain-language notes on how today's price moves in your own holdings are playing out, sector by sector. Not macro news or analyst commentary." />
            </div>
            {contextSectors.map((s) => (
              <MarketContextRow key={s.sector} {...s} isSelected={s.sector === selectedSector} />
            ))}
          </div>
        )}
        </>
      )}
      </GlassPanel>
    </div>
  );
};

export default DashboardHoldingsTable;