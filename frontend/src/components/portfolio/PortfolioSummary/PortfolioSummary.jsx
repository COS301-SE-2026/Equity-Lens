const StatCard = ({ label, value, sub, positive }) => (
  <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
    <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
    <p className="text-xl font-mono font-semibold text-[var(--text-primary)]">{value}</p>
    {sub && (
      <p className={`text-xs font-mono mt-1 ${positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
        {sub}
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