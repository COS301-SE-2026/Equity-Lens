import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = [
  '#FFB800',
  '#3B82F6',
  '#22C55E',
  '#EF4444',
  '#8B5CF6',
  '#F59E0B',
  '#06B6D4',
  '#EC4899',
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { sector, percentage, value } = payload[0].payload;
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg p-3 shadow-[var(--shadow-modal)]">
        <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{sector}</p>
        <p className="text-xs text-[var(--text-secondary)]">
          {percentage.toFixed(1)}% of portfolio
        </p>
        <p className="text-xs text-[var(--accent-primary)] font-mono">
          R {value.toLocaleString('en-ZA')}
        </p>
      </div>
    );
  }
  return null;
};

