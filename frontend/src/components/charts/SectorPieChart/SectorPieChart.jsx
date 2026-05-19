import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const CHART_COLORS = [
  '#D4A017',
  'rgba(96,165,250,0.85)',
  'rgba(52,211,153,0.85)',
  'rgba(251,113,133,0.85)',
  'rgba(167,139,250,0.85)',
  'rgba(251,191,36,0.85)',
  'rgba(34,211,238,0.85)',
  'rgba(244,114,182,0.85)',
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
  if (!active || !payload?.length) return null;
  const { sector, percentage, value } = payload[0].payload;
  return (
    <div style={{
      background: 'var(--chart-tooltip-bg)',
      border: '1px solid var(--border-mid)',
      borderRadius: '6px',
      padding: '10px 14px',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px', fontFamily: 'var(--font-primary)' }}>
        {sector}
      </p>
      <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '3px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        {percentage.toFixed(1)}% of portfolio
      </p>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        R {value.toLocaleString('en-ZA')}
      </p>
    </div>
  );
};

const SectorPieChart = ({ data = mockSectorData }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'var(--font-primary)' }}>
        No sector data available
      </div>
    );
  }

  return (
    <div aria-label="Sector allocation pie chart">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="percentage"
            nameKey="sector"
            cx="50%"
            cy="50%"
            outerRadius={88}
            innerRadius={50}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
        {data.map((entry, index) => (
          <li key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: CHART_COLORS[index % CHART_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)' }}>
                {entry.sector}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {entry.percentage.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SectorPieChart;
