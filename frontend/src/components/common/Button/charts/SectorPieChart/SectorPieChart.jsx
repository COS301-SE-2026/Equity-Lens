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

const mockSectorData = [
  { sector: 'Financial Services', percentage: 35.5, value: 450000 },
  { sector: 'Technology', percentage: 22.0, value: 280000 },
  { sector: 'Mining & Resources', percentage: 18.5, value: 235000 },
  { sector: 'Healthcare', percentage: 12.0, value: 152000 },
  { sector: 'Consumer Goods', percentage: 7.5, value: 95000 },
  { sector: 'Real Estate', percentage: 4.5, value: 57000 },
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
const CustomLegend = ({ payload }) => (
  <ul className="flex flex-wrap justify-center gap-3 mt-4">
    {payload.map((entry, index) => (
      <li key={index} className="flex items-center gap-1.5">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: entry.color }}
        />
        <span className="text-xs text-[var(--text-secondary)]">{entry.value}</span>
      </li>
    ))}
  </ul>
);

const SectorPieChart = ({ data = mockSectorData }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)] text-sm">
        No sector data available
      </div>
    );
  }

  return (
    <div aria-label="Sector allocation pie chart">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="percentage"
            nameKey="sector"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={55}
            paddingAngle={2}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
export default SectorPieChart;


