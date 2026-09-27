import { Info } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  simulateSectorInvestment,
  simulateSectorRebalance,
} from '../../../services/portfolioService';
import { zar } from '../../../utils/currency';
import { buildSectorQuestions } from '../../../utils/dashboardInsights';
import CardMascotTrigger from '../../chat/CardMascotTrigger/CardMascotTrigger';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import AnimatedReveal from '../shared/AnimatedReveal';
import CollapseToggle from '../shared/CollapseToggle';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import GlassSelect from '../shared/GlassSelect';
import ScoreDelta, { SubscoreDeltas } from '../shared/ScoreDelta';
import SecondaryButton from '../shared/SecondaryButton';

import RebalancePreview from './RebalancePreview';

const CARD_BUTTON_CLASS = '!rounded-lg !px-4 !py-2 !text-[13px]';
const SECTION_HEADING_CLASS = 'text-[13px] font-semibold';
const SECTION_HEADING_STYLE = { color: 'var(--text-primary)' };
const SECTION_NOTE_CLASS = 'mb-3 mt-1 text-[12px] leading-snug';
const SECTION_NOTE_STYLE = { color: 'var(--text-secondary)' };
const RESULT_REGION_CLASS = 'mt-4';
const PRIMARY_BUTTON_CLASS =
  'pressable inline-flex items-center gap-1.5 rounded-md px-4 py-2 font-mono text-[12px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed';
const PRIMARY_BUTTON_STYLE = {
  background: 'var(--accent-primary)',
  color: 'var(--text-on-accent)',
};

const STALE_NOTE =
  'Your health yardstick changed. Run a simulation again to see it against the new score.';

/**
 * @typedef {
 *   | { available: true, health_score_before: number, health_score_after: number, illustrative_amount: number, sector: string, current_weight_pct: number, projected_weight_pct: number, explanation: string, disclaimer: string, subscore_deltas?: { key: string, label: string, before: number, after: number, weight: number }[] }
 *   | { available: false }
 * } InvestSimResult
 * @typedef {
 *   | { available: true, health_score_before: number, health_score_after: number, value_shifted: number, from_sector: string, from_sector_before_pct: number, to_sector: string, to_sector_before_pct: number, explanation: string, disclaimer: string, thresholds?: { concentration_high: number }, subscore_deltas?: { key: string, label: string, before: number, after: number, weight: number }[] }
 *   | { available: false, reason: string, thresholds?: { concentration_high: number } }
 * } RebalanceSimResult
 */

const EMPTY_SIM = { loading: false, error: null, result: null };

/** @param {{ onClick: () => void }} props */
const ClearResult = ({ onClick }) => (
  <SecondaryButton size="sm" onClick={onClick} className="!text-[11px]">
    Clear
  </SecondaryButton>
);

/** @param {{ children: any }} props */
const FailureLine = ({ children }) => (
  <p className="text-[12px]" style={{ color: 'var(--signal-negative)' }}>
    {children}
  </p>
);

/** @param {{ result: InvestSimResult | null, onClear: () => void }} props */
const InvestResult = ({ result, onClear }) => {
  if (!result?.available) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <ScoreDelta
          before={result.health_score_before}
          after={result.health_score_after}
          label="Portfolio Health"
          deltaDigits={2}
        />
        <ClearResult onClick={onClear} />
      </div>

      <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {result.explanation}
      </p>

      <SubscoreDeltas deltas={result.subscore_deltas ?? []} />

      <p className="text-[13px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
        Illustrative {zar(result.illustrative_amount)} added to your {result.sector} holdings (
        {result.current_weight_pct.toFixed(1)}% &rarr; {result.projected_weight_pct.toFixed(1)}% of
        book).
      </p>

      <p
        className="flex items-start gap-1.5 text-[12px] leading-snug"
        style={{ color: 'var(--text-ghost)' }}
      >
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        {result.disclaimer}
      </p>
    </div>
  );
};

/**
 * @param {{
 *   result: RebalanceSimResult | null,
 *   sectors: { sector: string, value?: number, percentage: number }[],
 *   onClear: () => void,
 * }} props
 */
const RebalanceResult = ({ result, sectors, onClear }) => {
  if (!result?.available) return null;

  return (
    <div>
      <RebalancePreview result={result} sectors={sectors} />
      <div className="mt-2 space-y-2">
        <SubscoreDeltas deltas={result.subscore_deltas ?? []} />
        <ClearResult onClick={onClear} />
      </div>
    </div>
  );
};

/**
 * @param {{
 *   sectors: { sector: string, value?: number, percentage: number }[],
 *   selectedSector: string | null,
 *   setSelectedSector: (sector: string) => void,
 *   investSim: any,
 *   setInvestSim: (sim: any) => void,
 *   rebalanceSim: any,
 *   setRebalanceSim: (sim: any) => void,
 *   staleNote?: string | null,
 *   onSimulate?: () => void,
 * }} props
 */
const SectorMoves = ({
  sectors,
  selectedSector: picked,
  setSelectedSector,
  investSim,
  setInvestSim,
  rebalanceSim,
  setRebalanceSim,
  staleNote = null,
  onSimulate,
}) => {
  const sorted = useMemo(() => [...sectors].sort((a, b) => a.percentage - b.percentage), [sectors]);
  const selectedSector = picked ?? sorted[0]?.sector ?? null;

  const runInvest = async () => {
    if (!selectedSector) return;
    onSimulate?.();
    setInvestSim({ loading: true, error: null, result: null });
    try {
      const result = await simulateSectorInvestment(selectedSector);
      setInvestSim({ loading: false, error: null, result });
    } catch (err) {
      console.warn('sector investment simulation failed:', err);
      setInvestSim({
        loading: false,
        error: "Couldn't run this simulation right now.",
        result: null,
      });
    }
  };

  const runRebalance = async () => {
    onSimulate?.();
    setRebalanceSim({ loading: true, error: null, result: null });
    try {
      const result = await simulateSectorRebalance();
      setRebalanceSim({ loading: false, error: null, result });
    } catch (err) {
      console.warn('sector rebalance simulation failed:', err);
      setRebalanceSim({
        loading: false,
        error: "Couldn't run this simulation right now.",
        result: null,
      });
    }
  };

  if (sectors.length < 2) return null;

  const largest = sorted[sorted.length - 1].sector;
  const smallest = sorted[0].sector;
  const noSectorOver =
    rebalanceSim.result?.available === false &&
    rebalanceSim.result.reason === 'no_sector_overconcentrated';

  return (
    <div className="p-5">
      <AnimatedReveal show={Boolean(staleNote)}>
        <p className="mb-4 text-[12px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          {staleNote}
        </p>
      </AnimatedReveal>

      <div>
        <label
          htmlFor="sector-invest-picker"
          className={`block ${SECTION_HEADING_CLASS}`}
          style={SECTION_HEADING_STYLE}
        >
          Add to a sector
        </label>
        <p className={SECTION_NOTE_CLASS} style={SECTION_NOTE_STYLE}>
          What a 5% new position in one sector would do to your Portfolio Health.
        </p>

        <GlassSelect
          id="sector-invest-picker"
          className="max-w-[280px]"
          value={selectedSector}
          onChange={(value) => setSelectedSector(String(value))}
          options={sorted.map((s) => ({ value: s.sector, label: s.sector }))}
        />

        <div className="mt-3">
          <SecondaryButton
            size="sm"
            onClick={runInvest}
            disabled={investSim.loading || !selectedSector}
            className={CARD_BUTTON_CLASS}
            icon={investSim.loading ? <LoadingSpinner size="sm" /> : undefined}
          >
            {investSim.loading ? 'Simulating…' : `Simulate investing in ${selectedSector ?? '…'}`}
          </SecondaryButton>
        </div>

        <div className={RESULT_REGION_CLASS}>
          <AnimatedReveal show={Boolean(investSim.error)}>
            <FailureLine>{investSim.error}</FailureLine>
          </AnimatedReveal>
          <AnimatedReveal show={investSim.result?.available === false}>
            <FailureLine>
              Couldn&apos;t simulate that sector - try again after refreshing the page.
            </FailureLine>
          </AnimatedReveal>
          <AnimatedReveal show={Boolean(investSim.result?.available)}>
            <InvestResult result={investSim.result} onClear={() => setInvestSim(EMPTY_SIM)} />
          </AnimatedReveal>
        </div>
      </div>

      <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h3 className={SECTION_HEADING_CLASS} style={SECTION_HEADING_STYLE}>
          Rebalance your most concentrated sector
        </h3>
        <p className={SECTION_NOTE_CLASS} style={SECTION_NOTE_STYLE}>
          What moving the excess out of {largest} and into {smallest} would do.
        </p>

        <button
          type="button"
          onClick={runRebalance}
          disabled={rebalanceSim.loading}
          className={PRIMARY_BUTTON_CLASS}
          style={PRIMARY_BUTTON_STYLE}
        >
          {rebalanceSim.loading && <LoadingSpinner size="sm" />}
          {rebalanceSim.loading ? 'Simulating…' : `Simulate shifting ${largest} into ${smallest}`}
        </button>

        <div className={RESULT_REGION_CLASS}>
          <AnimatedReveal show={Boolean(rebalanceSim.error)}>
            <FailureLine>{rebalanceSim.error}</FailureLine>
          </AnimatedReveal>
          <AnimatedReveal show={noSectorOver}>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              No sector is over the {rebalanceSim.result?.thresholds?.concentration_high ?? 0}%
              concentration threshold right now - nothing to rebalance.
            </p>
          </AnimatedReveal>
          <AnimatedReveal show={rebalanceSim.result?.available === false && !noSectorOver}>
            <FailureLine>Couldn&apos;t simulate that rebalance.</FailureLine>
          </AnimatedReveal>
          <AnimatedReveal show={Boolean(rebalanceSim.result?.available)}>
            <RebalanceResult
              result={rebalanceSim.result}
              sectors={sectors}
              onClear={() => setRebalanceSim(EMPTY_SIM)}
            />
          </AnimatedReveal>
        </div>
      </div>
    </div>
  );
};

/** @param {{ sectors: { sector: string, value?: number, percentage: number }[], configVersion?: number }} props */
const ConcentrationRisk = ({ sectors = [], configVersion = 0 }) => {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const [selectedSector, setSelectedSector] = useState(/** @type {string|null} */ (null));
  const [investSim, setInvestSim] = useState(
    /** @type {{ loading: boolean, error: string | null, result: InvestSimResult | null }} */
    (EMPTY_SIM),
  );
  const [rebalanceSim, setRebalanceSim] = useState(
    /** @type {{ loading: boolean, error: string | null, result: RebalanceSimResult | null }} */
    (EMPTY_SIM),
  );
  const [staleNote, setStaleNote] = useState(/** @type {string|null} */ (null));
  const seenConfigVersion = useRef(configVersion);
  useEffect(() => {
    if (configVersion === seenConfigVersion.current) return;
    seenConfigVersion.current = configVersion;
    setInvestSim(EMPTY_SIM);
    setRebalanceSim(EMPTY_SIM);
    setStaleNote(STALE_NOTE);
  }, [configVersion]);

  const sectorQuestions = useMemo(
    () =>
      buildSectorQuestions(
        [...sectors]
          .sort((a, b) => b.percentage - a.percentage)
          .map((s) => ({ name: s.sector, value: s.percentage })),
      ),
    [sectors],
  );

  return (
    <div className="group relative">
      {open && (
        <CardMascotTrigger
          questions={sectorQuestions}
          label="Ask AI about sector concentration"
          className="-right-6 -top-6"
        />
      )}
      <GlassPanel className="flex flex-col">
        <PanelHead
          label="Concentration & Rebalancing"
          help="Sector-level what-ifs: what adding to a sector would do to your Portfolio Health, and what shifting out of your most concentrated sector would do. Simulation only - EquityLens doesn't execute trades."
          action={
            <CollapseToggle
              open={open}
              onToggle={() => setOpen((wasOpen) => !wasOpen)}
              controls={bodyId}
              label="concentration and rebalancing"
            />
          }
        />

        <div id={bodyId}>
          <AnimatedReveal show={open}>
            {sectors.length > 1 ? (
              <SectorMoves
                sectors={sectors}
                selectedSector={selectedSector}
                setSelectedSector={setSelectedSector}
                investSim={investSim}
                setInvestSim={setInvestSim}
                rebalanceSim={rebalanceSim}
                setRebalanceSim={setRebalanceSim}
                staleNote={staleNote}
                onSimulate={() => setStaleNote(null)}
              />
            ) : (
              <div className="p-5 text-center">
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  Sector what-ifs need at least two sectors to compare
                </p>
              </div>
            )}
          </AnimatedReveal>
        </div>
      </GlassPanel>
    </div>
  );
};

export default ConcentrationRisk;
