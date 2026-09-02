import { useCallback, useState, useRef, useEffect } from 'react';
import { Star } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import usePortfolio from '../../hooks/usePortfolio';
import useDashboardAnalytics from '../../hooks/useDashboardAnalytics';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';
import { GlassPanel } from '../../components/dashboard/shared/GlassPanel';
import FloatingToggle from '../../components/dashboard/shared/FloatingToggle';
import DashboardHero from '../../components/dashboard/DashboardHero/DashboardHero';
import PortfolioHealth from '../../components/dashboard/PortfolioHealth/PortfolioHealth';
import PerformanceVsBenchmark from '../../components/dashboard/PerformanceVsBenchmark/PerformanceVsBenchmark';
import DashboardHoldingsTable from '../../components/dashboard/DashboardHoldingsTable/DashboardHoldingsTable';
import ConcentrationRisk from '../../components/dashboard/ConcentrationRisk/ConcentrationRisk';
import TodayInsights from '../../components/dashboard/TodayInsights/TodayInsights';
import WatchlistPanel from '../../components/dashboard/WatchlistPanel/WatchlistPanel';
import {
  buildSectors,
  buildAttrib,
  buildInsights,
} from '../../utils/dashboardInsights';

const FLASH_TIME = 2500;

const Dashboard = () => {
  const { portfolioData, loading, error, fetchedAt, refreshQuietly } = usePortfolio();
  const { marketContext } = useDashboardAnalytics();
  const { user } = useAuth();
  const [watchlistOpen, setWatchlistOpen] = useState(false);
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
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );}

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
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

  const contributionSeries = portfolioData?.contributionsSeries ?? [];
  const benchmarkLabel = portfolioData?.benchmarkLabel ?? 'JSE ALSI';
  const historyDays = portfolioData?.returns?.history_days ?? 0;
  const { sectors: sectorData } = buildSectors(holdings);
  const attribution = buildAttrib(holdings);
  const health = portfolioData?.health ?? { score: null, label: null, subscores: [] };
  const { insights: todayInsights } = buildInsights({ holdings, attribution, sectorData });

  return (
    <div
      data-testid="dashboard-visualizations"
      className="min-h-screen"
      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }} >
      <main className="mx-auto max-w-[1800px] space-y-10 px-6 py-8 lg:px-12" aria-label="Portfolio dashboard">
        <DashboardHero
          name={firstName}
          portfolioData={portfolioData}
          health={health}
          fetchedAt={fetchedAt}
          onScrollToHealth={() => scrollToSection('portfolio-health')}/>
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <TodayInsights insights={todayInsights} onScrollTo={scrollToSection} />

          <div
            id="portfolio-health"
            className={`dashboard-highlight rounded-2xl ${flashedTarget === 'portfolio-health' ? 'is-active' : ''}`} >
            <PortfolioHealth health={health} onScrollTo={scrollToSection} onYardstickChanged={refreshQuietly}/>
          </div>
        </div>
        <ConcentrationRisk />
        <div
          id="performance-vs-benchmark"
          className={`dashboard-highlight rounded-2xl ${flashedTarget === 'performance-vs-benchmark' ? 'is-active' : ''}`} >
          <PerformanceVsBenchmark
            series={perfSeries}
            contributionSeries={contributionSeries}
            attribution={attribution}
            benchmarkLabel={benchmarkLabel}
            historyDays={historyDays}/>
        </div>
        <DashboardHoldingsTable
          holdings={holdings}
          sectorData={sectorData}
          marketContext={marketContext}
          flashHoldings={flashedTarget === 'holdings-table'}
          flashSector={flashedTarget === 'sector-allocation'}
        />
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