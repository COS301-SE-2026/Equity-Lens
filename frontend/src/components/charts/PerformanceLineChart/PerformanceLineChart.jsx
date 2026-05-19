import { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

const FILTERS = ['Monthly', 'Quarterly', 'Annually'];
const formatCurrency = (value) => `R ${(value / 1000).toFixed(0)}k`;

const MOCK_DATA = [
  { name: 'Jan', value: 98000  },
  { name: 'Feb', value: 101000 },
  { name: 'Mar', value: 99500  },
  { name: 'Apr', value: 104000 },
  { name: 'May', value: 108000 },
  { name: 'Jun', value: 106500 },
  { name: 'Jul', value: 112000 },
  { name: 'Aug', value: 115000 },
  { name: 'Sep', value: 113000 },
  { name: 'Oct', value: 118000 },
  { name: 'Nov', value: 122000 },
  { name: 'Dec', value: 128000 },
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
        R {payload[0].value.toLocaleString('en-ZA')}
      </p>
    </div>
  );
};

const PerformanceLineChart = ({ data = MOCK_DATA }) => {
  const [activeFilter, setActiveFilter] = useState('Monthly');

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'var(--font-primary)' }}>
        No performance data available
      </div>
    );
  }

  const filteredData =
    activeFilter === 'Quarterly' ? data.filter((_, i) => i % 3 === 0) :
    activeFilter === 'Annually'  ? data.filter((_, i) => i % 12 === 0 || i === data.length - 1) :
    data;

  return (
    <div aria-label="Portfolio performance chart">
      {/* Filter toggles */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-primary)',
              fontWeight: 500,
              borderRadius: '4px',
              border: activeFilter === filter ? 'none' : '1px solid var(--border-subtle)',
              background: activeFilter === filter ? 'var(--accent-primary)' : 'transparent',
              color: activeFilter === filter ? '#000' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 120ms ease-out',
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={filteredData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--accent-primary)" stopOpacity={0.12} />
              <stop offset="70%"  stopColor="var(--accent-primary)" stopOpacity={0.02} />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--chart-axis-text)', fontSize: 10, fontFamily: 'var(--font-primary)' }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: 'var(--chart-axis-text)', fontSize: 10, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-mid)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--accent-primary)"
            strokeWidth={1.5}
            fill="url(#perfGradient)"
            dot={false}
            activeDot={{ r: 3, fill: 'var(--accent-primary)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceLineChart;
