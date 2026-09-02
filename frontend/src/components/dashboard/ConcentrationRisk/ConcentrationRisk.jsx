import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getSectorAllocation,
  simulateSectorInvestment,
  simulateSectorRebalance,
} from '../../../services/portfolioService';
import { zar } from '../../../utils/currency';
import { buildSectorQuestions } from '../../../utils/dashboardInsights';
import CardMascotTrigger from '../../chat/CardMascotTrigger/CardMascotTrigger';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import AnimatedReveal from '../shared/AnimatedReveal';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import GlassSelect from '../shared/GlassSelect';
import SecondaryButton from '../shared/SecondaryButton';

const CARD_BUTTON_CLASS = '!rounded-lg !px-4 !py-2 !text-[12px]';
const SECTION_HEADING_CLASS = 'mb-2 text-[13px] font-semibold';
const SECTION_HEADING_STYLE = { color: 'var(--text-primary)' };

/**
 * @typedef {
 *   | { available: true, health_score_before: number, health_score_after: number, illustrative_amount: number, sector: string, current_weight_pct: number, projected_weight_pct: number, explanation: string, disclaimer: string }
 *   | { available: false }
 * } InvestSimResult
 * @typedef {
 *   | { available: true, health_score_before: number, health_score_after: number, value_shifted: number, from_sector: string, from_sector_before_pct: number, to_sector: string, to_sector_before_pct: number, explanation: string, disclaimer: string }
 *   | { available: false, reason: string }
 * } RebalanceSimResult
 */

/**
 * @param {{ before: number, after: number }} props
 */
const HealthDelta = ({ before, after }) => {
  const improved = after >= before;
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-hover)' }}>
      <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        Portfolio Health
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[12px]" style={{ color: 'var(--text-ghost)' }}>
          Currently {before.toFixed(1)}
        </span>
        <span
          className="font-mono text-[20px] font-bold"
          style={{ color: improved ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
          New Portfolio Health: {after.toFixed(1)}
        </span>
      </div>
    </div>);};

/** @param {{ open: boolean }} props */
const ToggleChevron = ({ open }) => (
  <ChevronDown
    size={10}
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
  />
);

/**
 * @param {{ sectors: { sector: string, percentage: number }[] }} props
 */
const SectorMoves = ({ sectors }) => {
  const [investExpanded, setInvestExpanded] = useState(false);
  const [rebalanceExpanded, setRebalanceExpanded] = useState(false);
  const sorted = useMemo(() => [...sectors].sort((a, b) => a.percentage - b.percentage), [sectors]);
  const [selectedSector, setSelectedSector] = useState(sorted[0]?.sector ?? null);
  const [investSim, setInvestSim] = useState(
  /** @type {{ loading: boolean, error: string | null, result: InvestSimResult | null }} */
  ({ loading: false, error: null, result: null }),);
  const [rebalanceSim, setRebalanceSim] = useState(
  /** @type {{ loading: boolean, error: string | null, result: RebalanceSimResult | null }} */
  ({ loading: false, error: null, result: null }),); 
  const runInvest = async () => {
    if (!selectedSector) return;
    setInvestSim({ loading: true, error: null, result: null });
    try {
      const result = await simulateSectorInvestment(selectedSector);
      setInvestSim({ loading: false, error: null, result });
    } 
    catch (err) 
    {
      console.warn('sector investment simulation failed:', err);
      setInvestSim({
        loading: false,
        error: "Couldn't run this simulation right now.",
        result: null,
      });}};

  const runRebalance = async () => {
    setRebalanceSim({ loading: true, error: null, result: null });
    try {
      const result = await simulateSectorRebalance();
      setRebalanceSim({ loading: false, error: null, result });
    } 
    catch (err) 
    {
      console.warn('sector rebalance simulation failed:', err);
      setRebalanceSim({
        loading: false,
        error: "Couldn't run this simulation right now.",
        result: null,
      });}};

  if (sectors.length < 2) return null;

  return (
    <div className="p-4">
      <SecondaryButton
        size="sm"
        onClick={() => setInvestExpanded((o) => !o)}
        expanded={investExpanded}
        className={CARD_BUTTON_CLASS}
        trailing={<ToggleChevron open={investExpanded} />}>
        {investExpanded ? 'Hide sector moves' : 'Show sector moves'}
      </SecondaryButton>

      <AnimatedReveal show={investExpanded}>
        <div className="mt-3">
          <label
            htmlFor="sector-invest-picker"
            className={`block ${SECTION_HEADING_CLASS}`}
            style={SECTION_HEADING_STYLE}>
            Invest in a sector
          </label>

          <GlassSelect
            id="sector-invest-picker"
            className="max-w-[280px]"
            value={selectedSector}
            onChange={(value) => setSelectedSector(String(value))}
            options={sorted.map((s) => ({ value: s.sector, label: s.sector }))}/>

          <div className="mt-2">
            <SecondaryButton
              size="sm"
              onClick={runInvest}
              disabled={investSim.loading || !selectedSector}
              className={CARD_BUTTON_CLASS}
              icon={investSim.loading ? <LoadingSpinner size="sm" /> : undefined}>
              {investSim.loading ? 'Simulating…' : `Simulate investing in ${selectedSector ?? '…'}`}
            </SecondaryButton>
          </div>

          {investSim.error && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--signal-negative)' }}>
              {investSim.error}
            </p>)}
          {investSim.result?.available === false && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--signal-negative)' }}>
              Couldn&apos;t simulate that sector - try again after refreshing the page.
            </p>)}
          {investSim.result?.available && (
            <AnimatedReveal show>
              <div className="mt-3 space-y-2">
                <HealthDelta
                  before={investSim.result.health_score_before}
                  after={investSim.result.health_score_after}/>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  Illustrative {zar(investSim.result.illustrative_amount)} new position in{' '}
                  {investSim.result.sector} ({investSim.result.current_weight_pct.toFixed(1)}%
                  &rarr; {investSim.result.projected_weight_pct.toFixed(1)}% of book).{' '}
                  {investSim.result.explanation}
                </p>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--signal-warning)' }}>
                  {investSim.result.disclaimer}
                </p>
              </div>
            </AnimatedReveal>)}
        </div>
      </AnimatedReveal>

      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <SecondaryButton
          size="sm"
          onClick={() => setRebalanceExpanded((o) => !o)}
          expanded={rebalanceExpanded}
          className={CARD_BUTTON_CLASS}
          trailing={<ToggleChevron open={rebalanceExpanded} />}>
          Rebalance most concentrated sector
        </SecondaryButton>

        <AnimatedReveal show={rebalanceExpanded}>
          <div className="mt-3">
            <SecondaryButton
              size="sm"
              onClick={runRebalance}
              disabled={rebalanceSim.loading}
              className={CARD_BUTTON_CLASS}
              icon={rebalanceSim.loading ? <LoadingSpinner size="sm" /> : undefined}>
              {rebalanceSim.loading
                ? 'Simulating…'
                : `Simulate shifting ${sorted[sorted.length - 1].sector} to ${sorted[0].sector}`}
            </SecondaryButton>

            {rebalanceSim.error && (
              <p className="mt-2 text-[11px]" style={{ color: 'var(--signal-negative)' }}>
                {rebalanceSim.error}
              </p>)}
            {rebalanceSim.result?.available === false &&
              rebalanceSim.result.reason === 'no_sector_overconcentrated' && (
                <p className="mt-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  No sector is over the 45% concentration threshold right now - nothing to
                  rebalance.
                </p>)}
            {rebalanceSim.result?.available === false &&
              rebalanceSim.result.reason !== 'no_sector_overconcentrated' && (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--signal-negative)' }}>
                  Couldn&apos;t simulate that rebalance.
                </p>)}
            {rebalanceSim.result?.available && (
              <AnimatedReveal show>
                <div className="mt-3 space-y-2">
                  <HealthDelta
                    before={rebalanceSim.result.health_score_before}
                    after={rebalanceSim.result.health_score_after}/>
                  <p
                    className="text-[11px] leading-snug"
                    style={{ color: 'var(--text-secondary)' }}>
                    Illustrative {zar(rebalanceSim.result.value_shifted)} shifted from{' '}
                    {rebalanceSim.result.from_sector} (
                    {rebalanceSim.result.from_sector_before_pct.toFixed(1)}%) into{' '}
                    {rebalanceSim.result.to_sector} (
                    {rebalanceSim.result.to_sector_before_pct.toFixed(1)}%).{' '}
                    {rebalanceSim.result.explanation}
                  </p>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: 'var(--signal-warning)' }}>
                    {rebalanceSim.result.disclaimer}
                  </p>
                </div>
              </AnimatedReveal>
            )}
          </div>
        </AnimatedReveal>
      </div>
    </div>
  );};

const ConcentrationRisk = () => {
  const [sectors, setSectors] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getSectorAllocation();
      setSectors(result ?? []);
    } 
    catch (err) 
    {
      console.warn('sector allocation fetch failed:', err);
      setLoadError("Couldn't load sector allocation right now.");
    } 
    finally 
    {
      setLoading(false);
    }}, []);

  useEffect(() => {
    load();
  }, [load]);
  const sectorQuestions = useMemo(
    () =>
      buildSectorQuestions(
        [...sectors]
          .sort((a, b) => b.percentage - a.percentage)
          .map((s) => ({ name: s.sector, value: s.percentage })),),
    [sectors],);

  return (
    <div className="group relative">
      <CardMascotTrigger
        questions={!loading && !loadError ? sectorQuestions : []}
        label="Ask AI about sector concentration"
        className="-right-6 -top-6"/>
      <GlassPanel className="flex flex-col">
        <PanelHead
          label="Concentration & Rebalancing"
          help="Sector-level what-ifs: what adding to a sector would do to your Portfolio Health, and what shifting out of your most concentrated sector would do. Simulation only - EquityLens doesn't execute trades."/>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="sm" />
          </div>)}

        {!loading && loadError && (
          <div className="space-y-2.5 p-4">
            <p className="text-[11px]" style={{ color: 'var(--signal-negative)' }}>
              {loadError}
            </p>
            <SecondaryButton size="sm" onClick={load}>
              Retry
            </SecondaryButton>
          </div>)}

        {!loading && !loadError && sectors.length > 1 && <SectorMoves sectors={sectors} />}

        {!loading && !loadError && sectors.length <= 1 && (
          <div className="p-5 text-center">
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Sector what-ifs need at least two sectors to compare
            </p>
          </div>)}
      </GlassPanel>
    </div>
  );};

export default ConcentrationRisk;