import usePortfolio from '../../hooks/usePortfolio';
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

const SectionCard = ({ title, subtitle, children }) => (
  <div className="terminal-card flex flex-col h-full">
    <div
      className="px-4 pt-3 pb-2.5"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>
          {subtitle}
        </p>
      )}
    </div>
    <div className="p-4 flex-1">{children}</div>
  </div>
);

const Dashboard = () => {
  const { portfolioData, loading, error } = usePortfolio();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-64">
        <div
          className="terminal-card text-center p-8 max-w-md"
          role="alert"
        >
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--signal-negative)' }}>
            Failed to load portfolio
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const topHoldings = portfolioData?.holdings?.slice(0, 4) || [];

  return (
    <div
      className="p-4 flex flex-col gap-3 max-w-[1600px] mx-auto w-full"
      style={{ minHeight: '100%' }}
      aria-label="Portfolio dashboard"
    >
      <div className="grid grid-cols-12 gap-3">

        {topHoldings.map((holding) => (
          <div key={holding.ticker} className="col-span-12 sm:col-span-6 xl:col-span-3">
            <StockTickerCard
              ticker={holding.ticker}
              name={holding.name}
              price={holding.current_price}
              changePercent={holding.gain_loss_pct}
            />
          </div>
        ))}

        <div className="col-span-12 lg:col-span-8">
          <SectionCard
            title="Portfolio performance"
            subtitle="vs JSE All Share benchmark"
          >
            <PerformanceLineChart data={portfolioData?.performanceHistory} />
          </SectionCard>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <SectionCard title="Dividend income">
            <DividendBarChart />
          </SectionCard>
          <SectionCard title="Watchlist">
            <div className="flex flex-col">
              {WATCHLIST.map((item) => (
                <WatchlistItem key={item.ticker} {...item} />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="col-span-12">
          <SectionCard
            title="Holdings"
            subtitle="All active positions in your portfolio"
          >
            <HoldingsTable holdings={portfolioData?.holdings} />
          </SectionCard>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;