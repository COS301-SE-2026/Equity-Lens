
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const MOCK_DIVIDEND_DATA = [
  { month: 'Jan', amount: 180 },
  { month: 'Feb', amount: 340 },
  { month: 'Mar', amount: 210 },
  { month: 'Apr', amount: 290 },
  { month: 'May', amount: 190 },
  { month: 'Jun', amount: 200 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg p-3">
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--accent-primary)] font-mono">
          R {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const DividendBarChart = ({ data = MOCK_DIVIDEND_DATA }) => (
  <div aria-label="Dividend bar chart">
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default DividendBarChart;
