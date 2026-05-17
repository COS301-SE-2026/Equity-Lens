import { useState } from 'react';
import {
  AreaChart,
  Area,

  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const FILTERS = ['Monthly', 'Quarterly', 'Annually'];

const formatCurrency = (value) => `R ${(value / 1000).toFixed(0)}k`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg p-3 shadow-[var(--shadow-modal)]">
        <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
        <p className="text-sm font-semibold text-[var(--accent-primary)] font-mono">
          R {payload[0].value.toLocaleString('en-ZA')}
  </p>
      </div>
    );
  }
  return null;
};

const MOCK_PERFORMANCE_DATA = [
  { name: 'Jan', value: 2400 },
  { name: 'Feb', value: 1398 },
  { name: 'Mar', value: 9800 },
  { name: 'Apr', value: 3908 },
  { name: 'May', value: 4800 },
  { name: 'Jun', value: 3800 },
];

const PerformanceLineChart = ({ data = MOCK_PERFORMANCE_DATA }) => {
  const [activeFilter, setActiveFilter] = useState('Monthly');

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)] text-sm">
        No performance data available
      </div>
    );
  }

  const filteredData =
    activeFilter === 'Quarterly'
      ? data.filter((_, i) => i % 3 === 0)
      : activeFilter === 'Annually'
      ? data.filter((_, i) => i % 12 === 0 || i === data.length - 1)
      : data;

  return (
    <div aria-label="Portfolio performance chart">

      <div className="flex gap-1 mb-4">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeFilter === filter
                ? 'bg-[var(--accent-primary)] text-black'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={filteredData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
 <defs>
            <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFB800" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#FFB800" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#FFB800"
            strokeWidth={2}
            fill="url(#performanceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#FFB800', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceLineChart;
