import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

const MOCK_DATA = [
  { month: 'Jan', amount: 180 },
  { month: 'Feb', amount: 340 },
  { month: 'Mar', amount: 210 },
  { month: 'Apr', amount: 290 },
  { month: 'May', amount: 190 },
  { month: 'Jun', amount: 200 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--chart-tooltip-bg)',
      border: '1px solid var(--border-mid)',
      borderRadius: '6px',
      padding: '10px 14px',
    }}>
      <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontFamily: 'var(--font-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        R {payload[0].value}
      </p>
    </div>
  );
};

const DividendBarChart = ({ data = MOCK_DATA }) => (
  <div aria-label="Dividend bar chart">
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--chart-axis-text)', fontSize: 10, fontFamily: 'var(--font-primary)' }}
          axisLine={false}
          tickLine={false}
          dy={4}
        />
        <YAxis
          tick={{ fill: 'var(--chart-axis-text)', fontSize: 10, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={28}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill="var(--signal-info-bg)"
              stroke="var(--signal-info-border)"
              strokeWidth={1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default DividendBarChart;
