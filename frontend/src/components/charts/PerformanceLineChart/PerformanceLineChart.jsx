import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const FILTERS = ['Monthly', 'Quarterly', 'Annually'];
const formatCurrency = (value) => `R ${(value / 1000).toFixed(0)}k`;

const MOCK_DATA = [
  { name: 'Jan', value: 98000,  benchmark: 72000  },
  { name: 'Feb', value: 101000, benchmark: 73500  },
  { name: 'Mar', value: 99500,  benchmark: 74000  },
  { name: 'Apr', value: 104000, benchmark: 76000  },
  { name: 'May', value: 108000, benchmark: 75500  },
  { name: 'Jun', value: 106500, benchmark: 77000  },
  { name: 'Jul', value: 112000, benchmark: 79000  },
  { name: 'Aug', value: 115000, benchmark: 80500  },
  { name: 'Sep', value: 113000, benchmark: 78000  },
  { name: 'Oct', value: 118000, benchmark: 81000  },
  { name: 'Nov', value: 122000, benchmark: 83000  },
  { name: 'Dec', value: 128000, benchmark: 85000  },
];

const PORTFOLIO_COLOR = '#D4A017';
const BENCHMARK_COLOR = '#8A94A8';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--chart-tooltip-bg)',
      border: '1px solid var(--border-mid)',
      borderRadius: '6px',
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <p style={{
        fontSize: '10px',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{
          fontSize: '13px',
          fontWeight: 600,
          color: entry.color,
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
        }}>
          R {entry.value.toLocaleString('en-ZA')}
          <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>
            {entry.dataKey === 'value' ? 'Portfolio' : 'JSE All Share'}
          </span>
        </p>
      ))}
    </div>
  );
};

const ChartLegend = () => (
  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <svg width="20" height="8">
        <line x1="0" y1="4" x2="20" y2="4" stroke={PORTFOLIO_COLOR} strokeWidth="2" />
      </svg>
      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)' }}>
        Portfolio
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <svg width="20" height="8">
        <line x1="0" y1="4" x2="20" y2="4" stroke={BENCHMARK_COLOR} strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)' }}>
        JSE All Share
      </span>
    </div>
  </div>
);

const PerformanceLineChart = ({ data = MOCK_DATA }) => {
  const [activeFilter, setActiveFilter] = useState('Monthly');

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px', color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'var(--font-primary)', }}>
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

      <ChartLegend />

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={filteredData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={PORTFOLIO_COLOR} stopOpacity={0.15} />
              <stop offset="70%"  stopColor={PORTFOLIO_COLOR} stopOpacity={0.03} />
              <stop offset="100%" stopColor={PORTFOLIO_COLOR} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="benchGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={BENCHMARK_COLOR} stopOpacity={0.08} />
              <stop offset="100%" stopColor={BENCHMARK_COLOR} stopOpacity={0}    />
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
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'var(--border-mid)', strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="benchmark"
            stroke={BENCHMARK_COLOR}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="url(#benchGradient)"
            dot={false}
            activeDot={{ r: 3, fill: BENCHMARK_COLOR, strokeWidth: 0 }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={PORTFOLIO_COLOR}
            strokeWidth={2}
            fill="url(#perfGradient)"
            dot={false}
            activeDot={{ r: 3, fill: PORTFOLIO_COLOR, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceLineChart;
