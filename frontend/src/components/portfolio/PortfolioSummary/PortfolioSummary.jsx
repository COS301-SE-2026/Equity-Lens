import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value);

const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value?.toFixed(2)}%`;

const StatCard = ({ label, value, sub, icon: Icon, positive }) => (
  <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 shadow-[var(--shadow-card)]">
    <div className="flex items-start justify-between mb-3">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      {Icon && (
        <div className="p-2 rounded-lg bg-[var(--accent-subtle)]">
          <Icon size={16} className="text-[var(--accent-primary)]" />
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-[var(--text-primary)] font-mono mb-1">{value}</p>
    {sub && (
      <p
        className={`text-sm font-medium ${
          positive === undefined
            ? 'text-[var(--text-secondary)]'
            : positive
            ? 'text-[var(--color-success)]'
            : 'text-[var(--color-danger)]'
        }`}
      >
        {positive !== undefined && (positive ? '▲' : '▼')} {sub}
      </p>
    )}
  </div>
);


const PortfolioSummary = ({ summary }) => {
  if (!summary) return null;
  const gainPositive = summary.total_gain_loss >= 0;
  const dailyPositive = summary.daily_change >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Value"
        value={`R${summary.total_value?.toLocaleString()}`}
      />
      <StatCard
        label="Total Gain / Loss"
        value={`${gainPositive ? '+' : ''}R${summary.total_gain_loss?.toLocaleString()}`}
        sub={`${gainPositive ? '+' : ''}${summary.total_gain_loss_pct?.toFixed(1)}% all time`}
        positive={gainPositive}
      />
      <StatCard
        label="Today's Change"
        value={`${dailyPositive ? '+' : ''}${summary.daily_change?.toFixed(2)}%`}
        positive={dailyPositive}
      />
      <StatCard
        label="Holdings"
        value={summary.num_holdings}
        sub="active positions"
      />
    </div>
  );
};

export default PortfolioSummary;