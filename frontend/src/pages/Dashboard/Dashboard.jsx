import { useState } from 'react';
import usePortfolio from '../../hooks/usePortfolio';
import useAuth from '../../hooks/useAuth';
import StockTickerCard from '../../components/dashboard/StockTickerCard/StockTickerCard';
import PerformanceLineChart from '../../components/charts/PerformanceLineChart/PerformanceLineChart';
import DividendBarChart from '../../components/charts/DividendBarChart/DividendBarChart';
import WatchlistItem from '../../components/dashboard/WatchlistItem/WatchlistItem';
import HoldingsTable from '../../components/portfolio/HoldingsTable/HoldingsTable';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';

const WATCHLIST = [
  { ticker: 'NPN', name: 'Naspers', price: 3150.00, changePercent: 12.5 },
  { ticker: 'MTN', name: 'MTN Group', price: 138.00, changePercent: 15.0 },
  { ticker: 'SOL', name: 'Sasol', price: 245.00, changePercent: -12.5 },
  { ticker: 'FSR', name: 'Firstrand', price: 72.00, changePercent: 10.77 },
];

const SectionCard = ({ title, subtitle, children, action }) => (
  <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-[var(--shadow-card)]">
    <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[var(--border-default)]">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { portfolioData, loading, error } = usePortfolio();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div
          className="text-center p-8 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl max-w-md"
          role="alert"
        >
          <p className="text-[var(--color-danger)] font-semibold mb-2">
            Failed to load portfolio
          </p>
          <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  const topHoldings = portfolioData?.holdings?.slice(0, 4) || [];

  return (
    <div
      className="px-4 lg:px-6 py-6 space-y-6 max-w-[1400px] mx-auto"
      aria-label="Portfolio dashboard"
    >
      {/* Stock Ticker Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {topHoldings.map((holding) => (
          <StockTickerCard
            key={holding.ticker}
            ticker={holding.ticker}
            name={holding.name}
            price={holding.currentPrice}
            changePercent={holding.gainPercent}
          />
        ))}
      </div>

      {/* Main content row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Portfolio Performance — takes 2/3 width */}
        <div className="xl:col-span-2">
          <SectionCard
            title="Portfolio Performance"
            subtitle="Your performance stats over time"
          >
            <PerformanceLineChart data={portfolioData?.performanceHistory} />
          </SectionCard>
        </div>

        {/* Right column — Dividend + Watchlist */}
        <div className="flex flex-col gap-6">
          <SectionCard title="Dividend Income">
            <DividendBarChart />
          </SectionCard>

          <SectionCard title="My Watchlist">
            <div>
              {WATCHLIST.map((item) => (
                <WatchlistItem key={item.ticker} {...item} />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Holdings Table */}
      <SectionCard
        title="Your Holdings"
        subtitle="All active positions in your portfolio"
      >
        <HoldingsTable holdings={portfolioData?.holdings} />
      </SectionCard>
    </div>
  );
};

export default Dashboard;
