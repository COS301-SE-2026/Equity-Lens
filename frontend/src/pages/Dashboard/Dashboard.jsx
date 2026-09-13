import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Star } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import usePortfolio from '../../hooks/usePortfolio';
import useDashboardAnalytics from '../../hooks/useDashboardAnalytics';
import usePortfolioEvents from '../../hooks/usePortfolioEvents';
import CardErrorBoundary from '../../components/common/ErrorBoundary/CardErrorBoundary';
import { GlassPanel } from '../../components/dashboard/shared/GlassPanel';
import CardSkeleton from '../../components/dashboard/shared/CardSkeleton';
import SecondaryButton from '../../components/dashboard/shared/SecondaryButton';
import FloatingToggle from '../../components/dashboard/shared/FloatingToggle';
import DashboardHero from '../../components/dashboard/DashboardHero/DashboardHero';
import PortfolioHealth from '../../components/dashboard/PortfolioHealth/PortfolioHealth';
import PerformanceVsBenchmark from '../../components/dashboard/PerformanceVsBenchmark/PerformanceVsBenchmark';
import DashboardHoldingsTable from '../../components/dashboard/DashboardHoldingsTable/DashboardHoldingsTable';
import ConcentrationRisk from '../../components/dashboard/ConcentrationRisk/ConcentrationRisk';
import TodayInsights from '../../components/dashboard/TodayInsights/TodayInsights';
import WatchlistPanel from '../../components/dashboard/WatchlistPanel/WatchlistPanel';
import { useChatContext } from '../../context/ChatContext';
import {
  buildSectors,
  buildAttrib,
  buildChartStats,
  buildInsights,
  buildSummary,
} from '../../utils/dashboardInsights';

const FLASH_TIME = 2500;

const Dashboard = () => {
  const { portfolioData, loading, error, fetchedAt, refetch, refreshQuietly } = usePortfolio();
  const { marketContext } = useDashboardAnalytics();
  const {
    events,
    loading: eventsLoading,
    failed: eventsFailed,
    details: eventDetails,
    pendingKey: eventPendingKey,
    lastDetail: eventStudy,
    loadDetail: onExpandEvent,
  } = usePortfolioEvents();
  const { user } = useAuth();
  const { openDock } = useChatContext();
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [flashedTarget, setFlashedTarget] = useState(/** @type {string|null} */ (null));
  const [healthConfigVersion, setHealthConfigVersion] = useState(0);
  /** @type {React.MutableRefObject<ReturnType<typeof setTimeout> | null>} */
  const flashTimeoutRef = useRef(null);

  const scrollToSection = useCallback((/** @type {string} */ id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashedTarget(id);
    flashTimeoutRef.current = setTimeout(() => setFlashedTarget(null), FLASH_TIME);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const holdings = portfolioData?.holdings ?? [];
  
  const perfSeries = (portfolioData?.performanceHistory ?? []).map(
    /** @param {{ date?: string, name?: string, value: number, benchmark?: number,
     *            twr_index?: number }} point
     *  @param {number} i */
    (point, i) => ({
      date: point.date,
      name: point.name ?? point.date?.slice(5, 7) ?? `M${i + 1}`,
      value: point.value,
      benchmark: point.benchmark,
      twr_index: point.twr_index,
    }),);

  const payloadThresholds = portfolioData?.thresholds;
  const thresholds = {
    low: payloadThresholds?.concentration_low ?? 25,
    high: payloadThresholds?.concentration_high ?? 45,
  };

  const contributionSeries = portfolioData?.contributionsSeries ?? [];
  const benchmarkLabel = portfolioData?.benchmarkLabel ?? 'JSE ALSI';
  const benchmarkComposition = portfolioData?.benchmarkComposition ?? [];
  const historyDays = portfolioData?.returns?.history_days ?? 0;
  const { sectors: sectorData } = buildSectors(holdings);
  const attribution = buildAttrib(holdings);
  const health = portfolioData?.health ?? { score: null, label: null, subscores: [] };
  const chartStats = useMemo(
    () => buildChartStats(perfSeries, { historyDays }),
    [perfSeries, historyDays],
  );
  const summary = useMemo(
    () => buildSummary({
      holdings,
      sectorData,
      attribution,
      chartStats,
      dailyChangePct: portfolioData?.summary?.daily_change_pct ?? 0,
      benchmarkLabel,
      thresholds,
    }),
    [holdings, sectorData, attribution, chartStats, portfolioData, benchmarkLabel, thresholds.low, thresholds.high],
  );

  const { insights: todayInsights, more: moreInsights } = useMemo(
    () => buildInsights({
      holdings,
      attribution,
      sectorData,
      sectorAllocation: portfolioData?.sectorAllocation ?? [],
      returns: portfolioData?.returns,
      health,
      thresholds,
      perfSeries,
      contributionSeries,
      cgt: portfolioData?.cgt,
      statementDate: portfolioData?.statementDate,
      accountType: portfolioData?.accountType,
      benchmarkLabel,
      events,
      eventStudy,
    }),
    [holdings, attribution, sectorData, portfolioData, health, thresholds.low, thresholds.high, perfSeries, contributionSeries, benchmarkLabel, events, eventStudy],
  );

  if (loading) {
    return (
      <div className="min-h-screen" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}>
        <main className="mx-auto max-w-[1800px] space-y-10 px-6 py-8 lg:px-12" aria-label="Portfolio dashboard">
          <CardSkeleton label="Overview" height={220} />
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <CardSkeleton label="Portfolio Insights" height={440} />
            <CardSkeleton label="Portfolio Health" height={440} />
          </div>
          <CardSkeleton label="Performance vs Benchmark" height={420} />
          <CardSkeleton label="All Positions" height={300} />
          <CardSkeleton label="Concentration & Rebalancing" height={420} />
        </main>
      </div>
    );}

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <GlassPanel className="max-w-md p-8 text-center">
          <p className="mb-2 font-mono text-[12px] tracking-widest" style={{ color: 'var(--signal-negative)' }}>
            Could Not Load Portfolio
          </p>
          <p className="mb-5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <div className="flex justify-center gap-3">
            <SecondaryButton onClick={() => refetch()}>Try again</SecondaryButton>
            <SecondaryButton to="/portfolio">Go to Portfolio</SecondaryButton>
          </div>
        </GlassPanel>
      </div>
    );}


  return (
    <div
      data-testid="dashboard-visualizations"
      className="min-h-screen"
      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }} >
      <main className="mx-auto max-w-[1800px] space-y-10 px-6 py-8 lg:px-12" aria-label="Portfolio dashboard">
        <CardErrorBoundary label="Overview">
          <DashboardHero
            name={firstName}
            portfolioData={portfolioData}
            health={health}
            fetchedAt={fetchedAt}
            benchmark={summary.benchmark}
            benchmarkComposition={benchmarkComposition}
            historyDays={historyDays}
            onScrollToHealth={() => scrollToSection('portfolio-health')}/>
        </CardErrorBoundary>
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <CardErrorBoundary label="Portfolio Insights">
            <TodayInsights insights={todayInsights} more={moreInsights} onScrollTo={scrollToSection} onAsk={openDock} />
          </CardErrorBoundary>

          <div
            id="portfolio-health"
            className={`dashboard-highlight rounded-2xl ${flashedTarget === 'portfolio-health' ? 'is-active' : ''}`} >
            <CardErrorBoundary label="Portfolio Health">
              <PortfolioHealth
                health={health}
                onScrollTo={scrollToSection}
                onYardstickChanged={() => {
                  refreshQuietly();
                  setHealthConfigVersion((version) => version + 1);
                }}/>
            </CardErrorBoundary>
          </div>
        </div>
        <div
          id="performance-vs-benchmark"
          className={`dashboard-highlight rounded-2xl ${flashedTarget === 'performance-vs-benchmark' ? 'is-active' : ''}`} >
          <CardErrorBoundary label="Performance vs Benchmark">
            <PerformanceVsBenchmark
              series={perfSeries}
              contributionSeries={contributionSeries}
              attribution={attribution}
              benchmarkLabel={benchmarkLabel}
              benchmarkComposition={benchmarkComposition}
              historyDays={historyDays}
              holdings={holdings}
              events={events}
              eventsLoading={eventsLoading}
              eventsFailed={eventsFailed}
              eventDetails={eventDetails}
              eventPendingKey={eventPendingKey}
              onExpandEvent={onExpandEvent}
              onAskAboutEvent={openDock}
              importedAt={portfolioData?.importedAt}
              historyQuality={portfolioData?.historyQuality}/>
          </CardErrorBoundary>
        </div>
        <CardErrorBoundary label="All Positions">
          <DashboardHoldingsTable
            holdings={holdings}
            sectorData={sectorData}
            marketContext={marketContext}
            thresholds={thresholds}
            flashHoldings={flashedTarget === 'holdings-table'}
            flashSector={flashedTarget === 'sector-allocation'}
          />
        </CardErrorBoundary>
        <div
          id="concentration-rebalancing"
          className={`dashboard-highlight rounded-2xl ${flashedTarget === 'concentration-rebalancing' ? 'is-active' : ''}`} >
          <CardErrorBoundary label="Concentration & Rebalancing">
            <ConcentrationRisk
              sectors={portfolioData?.sectorAllocation ?? []}
              configVersion={healthConfigVersion}/>
          </CardErrorBoundary>
        </div>
      </main>

      <div className="fixed right-5 top-[84px] z-40">
        <FloatingToggle
          label="Watchlist"
          icon={<Star size={18} />}
          open={watchlistOpen}
          onToggle={() => setWatchlistOpen((v) => !v)}
          direction="down"
          panelMaxHeight="min(60vh, 420px)">
          <WatchlistPanel />
        </FloatingToggle>
      </div>
    </div>
  );};

export default Dashboard;