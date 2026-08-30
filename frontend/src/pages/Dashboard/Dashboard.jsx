import { useCallback, useState, useRef, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import usePortfolio from '../../hooks/usePortfolio';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';
import { GlassPanel } from '../../components/dashboard/shared/GlassPanel';
import DashboardHero from '../../components/dashboard/DashboardHero/DashboardHero';
import ActionBanner from '../../components/dashboard/ActionBanner/ActionBanner';
import PortfolioHealth from '../../components/dashboard/PortfolioHealth/PortfolioHealth';
import PerformanceVsBenchmark from '../../components/dashboard/PerformanceVsBenchmark/PerformanceVsBenchmark';
import PortfolioOverview from '../../components/dashboard/PortfolioOverview/PortfolioOverview';
import TodayInsights from '../../components/dashboard/TodayInsights/TodayInsights';
import WatchlistPanel from '../../components/dashboard/WatchlistPanel/WatchlistPanel';
import {
  buildSectors,
  buildChartStats,
  buildAttrib,
  buildHealth,
  buildActions,
  buildInsights,
  buildSummary,
} from '../../utils/dashboardInsights';

// anomaly headline data pulled for demo 2
const FLASH_CLASS = 'ring-4 ring-inset ring-orange-500 animate-pulse transition-all duration-500';
const FLASH_TIME = 2500;

const Dashboard = () => {
  const { portfolioData, loading, error, fetchedAt } = usePortfolio();
  const { user } = useAuth();
  const [flashedTarget, setFlashedTarget] = useState(/** @type {string|null} */ (null));
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );}

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
        <GlassPanel className="max-w-md p-8 text-center">
          <p className="mb-2 font-mono text-[11px] tracking-widest" style={{ color: 'var(--signal-negative)' }}>
            Could Not Load Portfolio
          </p>
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </GlassPanel>
      </div>
    );}

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const holdings = portfolioData?.holdings ?? [];
  
  const perfSeries = (portfolioData?.performanceHistory ?? []).map(
    /** @param {{ date?: string, name?: string, value: number, benchmark?: number }} point
     *  @param {number} i */
    (point, i) => ({
      date: point.date,
      name: point.name ?? point.date?.slice(5, 7) ?? `M${i + 1}`,
      value: point.value,
      benchmark: point.benchmark,
    }),);

  const benchmarkLabel = portfolioData?.benchmarkLabel ?? 'JSE ALSI';
  const { sectors: sectorData } = buildSectors(holdings);
  const fullChartStats = buildChartStats(perfSeries);
  const attribution = buildAttrib(holdings);
  const health = buildHealth({ holdings, sectorData, chartStats: fullChartStats, benchmarkLabel });
  const { items: actionItems } = buildActions({ holdings, sectorData, attribution, health });
  const { insights: todayInsights } = buildInsights({
    holdings,
    sectorData,
    attribution,
    chartStats: fullChartStats,
    totalGainLoss: {
      pct: portfolioData?.summary?.total_gain_loss_pct,
      value: portfolioData?.summary?.total_gain_loss,
    },});

  const summary = buildSummary({
    holdings,
    sectorData,
    attribution,
    chartStats: fullChartStats,
    dailyChangePct: portfolioData?.summary?.daily_change ?? 0,
    benchmarkLabel,
  });

  return (
    <div
      data-testid="dashboard-visualizations"
      className="min-h-screen"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }} >
      <main className="mx-auto max-w-[1800px] space-y-10 px-6 py-8 lg:px-12" aria-label="Portfolio dashboard">
        <DashboardHero
          name={firstName}
          portfolioData={portfolioData}
          attribution={attribution}
          health={health}
          summary={summary}
          fetchedAt={fetchedAt}
          onScrollToHealth={() => scrollToSection('portfolio-health')}
          onScrollTo={scrollToSection}/>

        <ActionBanner items={actionItems} hasHoldings={holdings.length > 0} onScrollTo={scrollToSection} />

        <div
          id="portfolio-health"
          className={`rounded-2xl ${flashedTarget === 'portfolio-health' ? FLASH_CLASS : ''}`} >
          <PortfolioHealth health={health} onScrollTo={scrollToSection} />
        </div>
        <div className="grid grid-cols-12 gap-8">
          <div
            id="performance-vs-benchmark"
            className={`col-span-12 space-y-6 rounded-2xl lg:col-span-8 ${flashedTarget === 'performance-vs-benchmark' ? FLASH_CLASS : ''}`} >
            <PerformanceVsBenchmark
              series={perfSeries}
              attribution={attribution}
              holdings={holdings}
              onScrollTo={scrollToSection}
              benchmarkLabel={benchmarkLabel}/>
          </div>

          <div className="col-span-12 space-y-8 lg:col-span-4">
            {/* CorrelatedNews pulled for demo 2 as not feasible in time but code kept*/}
            <TodayInsights insights={todayInsights} onScrollTo={scrollToSection} />
            <WatchlistPanel />
          </div>
        </div>
        <PortfolioOverview
          sectorData={sectorData}
          holdings={holdings}
          flashSector={flashedTarget === 'sector-allocation'}
          flashHoldings={flashedTarget === 'holdings-table'}
        />
      </main>
    </div>
  );};

export default Dashboard;