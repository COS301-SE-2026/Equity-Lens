import usePortfolio from '../../hooks/usePortfolio';
import StockTickerCard from '../../components/dashboard/StockTickerCard/StockTickerCard';
import PerformanceLineChart from '../../components/charts/PerformanceLineChart/PerformanceLineChart';
import DividendBarChart from '../../components/charts/DividendBarChart/DividendBarChart';
import WatchlistItem from '../../components/dashboard/WatchlistItem/WatchlistItem';
import HoldingsTable from '../../components/portfolio/HoldingsTable/HoldingsTable';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';

const WATCHLIST = [
  { ticker: 'NPN', name: 'Naspers',   price: 3150.00, changePercent: 12.5  },
  { ticker: 'MTN', name: 'MTN Group', price: 138.00,  changePercent: 15.0  },
  { ticker: 'SOL', name: 'Sasol',     price: 245.00,  changePercent: -12.5 },
  { ticker: 'FSR', name: 'Firstrand', price: 72.00,   changePercent: 10.77 },
];

const SectionCard = ({ title, subtitle, children, scrollable = false }) => (
  <div
    style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '6px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <div style={{
      padding: '10px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0,
    }}>
      <p style={{
        fontSize: '10px',
        fontWeight: 500,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {title}
      </p>
      {subtitle && (
        <p style={{
          fontSize: '10px',
          marginTop: '2px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-primary)',
        }}>
          {subtitle}
        </p>
      )}
    </div>
    <div style={{
      padding: '16px',
      flex: 1,
      overflowY: scrollable ? 'auto' : 'visible',
      maxHeight: scrollable ? '260px' : 'none',
    }}>
      {children}
    </div>
  </div>
);

const Dashboard = () => {
  const { portfolioData, loading, error } = usePortfolio();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '256px' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '256px' }}>
        <div
          role="alert"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '32px',
            maxWidth: '400px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 500, marginBottom: '8px', color: 'var(--signal-negative)', fontFamily: 'var(--font-primary)' }}>
            Failed to load portfolio
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  const topHoldings = portfolioData?.holdings?.slice(0, 4) || [];

  return (
    <div
      className="px-4 lg:px-6 py-6 space-y-6 max-w-[1600px] mx-auto w-full"
      aria-label="Portfolio dashboard"
    >
      <div className="grid grid-cols-12 gap-4">
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
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <SectionCard title="Portfolio performance" subtitle="vs JSE All Share benchmark">
            <PerformanceLineChart data={portfolioData?.performanceHistory} />
          </SectionCard>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <SectionCard title="Dividend income">
            <DividendBarChart />
          </SectionCard>
          <SectionCard title="Watchlist" scrollable={true}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {WATCHLIST.map((item) => (
                <WatchlistItem key={item.ticker} {...item} />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="col-span-12">
          <SectionCard title="Holdings" subtitle="All active positions in your portfolio">
            <HoldingsTable holdings={portfolioData?.holdings} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
