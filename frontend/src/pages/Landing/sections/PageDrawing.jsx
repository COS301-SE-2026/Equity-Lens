const FILL = {
  panel: { fill: 'var(--surface-base)', fillOpacity: 0.07 },
  bar: { fill: 'var(--surface-base)', fillOpacity: 0.24 },
  faint: { fill: 'var(--surface-base)', fillOpacity: 0.12 },
  accent: { fill: 'var(--accent-light)' },
  positive: { fill: 'var(--signal-positive)' },
  negative: { fill: 'var(--signal-negative)' },
};

const NewsDrawing = () => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <g key={i} transform={`translate(${30 + i * 188} 30)`}>
        <rect width="174" height="70" rx="10" style={FILL.panel} />
        <circle
          cx="34"
          cy="35"
          r="16"
          style={[FILL.faint, FILL.positive, FILL.negative, FILL.faint][i]}
          opacity={i === 0 || i === 3 ? 1 : 0.5}
        />
        <rect x="62" y="22" width="80" height="8" rx="4" style={FILL.bar} />
        <rect x="62" y="40" width="24" height="12" rx="4" style={FILL.bar} />
      </g>
    ))}

    <rect x="30" y="145" width="100" height="34" rx="8" style={FILL.accent} />
    <rect x="140" y="145" width="100" height="34" rx="8" style={FILL.panel} />

    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <rect
        key={i}
        x={30 + i * 74}
        y="205"
        width="64"
        height="28"
        rx="14"
        style={i === 0 ? FILL.accent : FILL.panel}
      />
    ))}

    {[0, 1, 2].map((i) => (
      <g key={i} transform={`translate(30 ${258 + i * 76})`}>
        <rect width="740" height="64" rx="10" style={FILL.panel} />
        <rect x="12" y="10" width="62" height="44" rx="6" style={FILL.faint} />
        <rect x="90" y="16" width={[380, 300, 340][i]} height="10" rx="5" style={FILL.bar} />
        <rect x="90" y="38" width={[240, 280, 200][i]} height="8" rx="4" style={FILL.faint} />
        <rect x="650" y="22" width="76" height="20" rx="10" style={FILL.faint} />
      </g>
    ))}
  </>
);

const DOTS = Array.from({ length: 46 }, (_, i) => ({
  x: 60 + ((i * 137) % 680),
  y: 205 + ((i * 89) % 240),
}));

const HOLDINGS = [
  {
    x: 190,
    y: 300,
    near: [
      { x: 250, y: 260 },
      { x: 140, y: 360 },
    ],
  },
  {
    x: 440,
    y: 380,
    near: [
      { x: 520, y: 350 },
      { x: 400, y: 430 },
    ],
  },
  {
    x: 620,
    y: 250,
    near: [
      { x: 690, y: 290 },
      { x: 570, y: 215 },
    ],
  },
];

const ExploreDrawing = () => (
  <>
    {[0, 1, 2].map((i) => (
      <g key={i} transform={`translate(${30 + i * 195} 30)`}>
        <rect width="180" height="120" rx="10" style={FILL.panel} />
        <rect x="16" y="18" width="44" height="10" rx="5" style={FILL.accent} />
        <rect x="68" y="18" width="80" height="10" rx="5" style={FILL.bar} />
        <rect x="16" y="46" width="148" height="8" rx="4" style={FILL.faint} />
        <rect x="16" y="64" width="120" height="8" rx="4" style={FILL.faint} />
        <rect x="16" y="82" width="134" height="8" rx="4" style={FILL.faint} />
      </g>
    ))}
    <g transform="translate(620 30)">
      <rect width="150" height="120" rx="10" style={FILL.panel} />
      <circle cx="30" cy="34" r="12" style={FILL.faint} />
      <rect x="52" y="29" width="80" height="10" rx="5" style={FILL.bar} />
      <rect x="18" y="62" width="114" height="8" rx="4" style={FILL.faint} />
      <rect x="18" y="80" width="90" height="8" rx="4" style={FILL.faint} />
    </g>

    <rect x="30" y="180" width="740" height="290" rx="12" style={FILL.panel} />
    {DOTS.map((dot, i) => (
      <circle key={i} cx={dot.x} cy={dot.y} r="4" style={FILL.bar} />
    ))}
    {HOLDINGS.map((h) => (
      <g key={h.x}>
        {h.near.map((n) => (
          <g key={n.x}>
            <line
              x1={h.x}
              y1={h.y}
              x2={n.x}
              y2={n.y}
              strokeWidth="2"
              style={{ stroke: 'var(--accent-light)' }}
              opacity="0.6"
            />
            <circle cx={n.x} cy={n.y} r="6" style={FILL.accent} opacity="0.55" />
          </g>
        ))}
        <circle cx={h.x} cy={h.y} r="9" style={FILL.accent} />
      </g>
    ))}
  </>
);

/** @param {{ id: string, className?: string }} props */
const PageDrawing = ({ id, className = '' }) => (
  <svg
    viewBox="0 0 800 500"
    className={`block h-full w-full bg-[var(--text-primary)] ${className}`}
    aria-hidden="true"
    focusable="false"
  >
    {id === 'news' ? <NewsDrawing /> : <ExploreDrawing />}
  </svg>
);

export default PageDrawing;