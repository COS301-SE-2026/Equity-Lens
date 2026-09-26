import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const SECTOR_COLORS = {
  'Financial Services': '#2a78d6',
  'Basic Materials': '#eb6834',
  'Communication Services': '#eda100',
  Industrials: '#e87ba4',
  'Consumer Cyclical': '#b07aa1',
  'Consumer Defensive': '#76b7b2',
  Healthcare: '#e15759',
  Energy: '#9c755f',
  'Real Estate': '#2f4b7c',
  Technology: '#4dc9f6',
  Utilities: '#c9b458',
};

const TOOLTIP_STYLE = {
  position: 'absolute',
  pointerEvents: 'none',
  opacity: 0,
  transition: 'opacity 120ms ease-out',
  background: 'var(--chart-tooltip-bg)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '12px',
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
  zIndex: 10,
};

function getLogTicks(min, max, maxCount = 6) {
  const ticks = [];
  const start = Math.floor(Math.log10(min));
  const end = Math.ceil(Math.log10(max));

  for (let p = start; p <= end; p++) {
    for (const mult of [1, 2, 5]) {
      const val = mult * 10 ** p;
      if (val >= min && val <= max) ticks.push(val);
    }
  }

  if (ticks.length <= maxCount) return ticks;
  const step = Math.ceil(ticks.length / maxCount);
  return ticks.filter((_, i) => i % step === 0);
}

export function ExposureChart({ portfolio = [], universe = [], recommended = [] }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !universe.length) return;

    const heldTickers = new Set(portfolio.map((p) => p.ticker));
    const universeTickers = new Set(universe.map((u) => u.ticker));
    const points = [...universe, ...portfolio.filter((p) => !universeTickers.has(p.ticker))].map((p) => ({
      ...p,
      highlighted: heldTickers.has(p.ticker),
    }));

    const width = 720;
    const height = 460;
    const margin = { top: 20, right: 30, bottom: 56, left: 64 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const xMin = (d3.min(points, (d) => d.market_cap) || 1) * 0.8;
    const xMax = (d3.max(points, (d) => d.market_cap) || 100) * 1.2;
    const yMax = (d3.max(points, (d) => d.local_float_pct) || 100) * 1.1;
    const yieldMax = d3.max(points, (d) => d.dividend_yield) || 10;

    const x = d3.scaleLog().domain([xMin, xMax]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, yMax]).range([height - margin.bottom, margin.top]);
    const r = d3.scaleSqrt().domain([0, yieldMax]).range([5, 24]);

    const yTicks = y.ticks(5);
    const xTicks = getLogTicks(xMin, xMax, 6);

    svg
      .append('g')
      .selectAll('line.grid-y')
      .data(yTicks)
      .join('line')
      .attr('class', 'grid-y')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'var(--chart-grid)')
      .attr('stroke-width', 0.5);

    svg
      .append('g')
      .selectAll('line.grid-x')
      .data(xTicks)
      .join('line')
      .attr('class', 'grid-x')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('x1', (d) => x(d))
      .attr('x2', (d) => x(d))
      .attr('stroke', 'var(--chart-grid)')
      .attr('stroke-width', 0.5);

    const xAxis = svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat((v) => `R${Math.round(v)}bn`));

    xAxis.selectAll('text').style('fill', 'var(--chart-axis-text)').style('font-size', '11px');
    xAxis.selectAll('path, line').style('stroke', 'var(--border-subtle)');

    const yAxis = svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => `${Math.round(v)}%`));

    yAxis.selectAll('text').style('fill', 'var(--chart-axis-text)').style('font-size', '11px');
    yAxis.selectAll('path, line').style('stroke', 'var(--border-subtle)');

    svg
      .append('text')
      .attr('x', (margin.left + width - margin.right) / 2)
      .attr('y', height - 12)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--chart-axis-text)')
      .style('font-size', '11px')
      .text('Market cap (log scale)');

    svg
      .append('text')
      .attr('transform', `translate(16,${(margin.top + height - margin.bottom) / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--chart-axis-text)')
      .style('font-size', '11px')
      .text('Free float %');

    const universeMap = new Map(points.map((u) => [u.ticker, u]));
    const recMap = new Map(recommended.map((rec) => [rec.ticker, rec]));
    const recTickers = new Set(recommended.map((rec) => rec.ticker));
    const portfolioMap = new Map(portfolio.map((p) => [p.ticker, p]));

    svg
      .selectAll('.halo')
      .data(recommended.filter((rec) => universeMap.has(rec.ticker)))
      .join('circle')
      .attr('class', 'halo')
      .attr('cx', (d) => x(universeMap.get(d.ticker).market_cap))
      .attr('cy', (d) => y(universeMap.get(d.ticker).local_float_pct))
      .attr('r', (d) => r(universeMap.get(d.ticker).dividend_yield) + 14)
      .attr('fill', 'var(--signal-positive)')
      .attr('fill-opacity', (d) => (d.closeness ?? 0.3) * 0.4);

    const tooltip = tooltipRef.current;
    const container = svgRef.current.parentElement;

    svg
      .selectAll('.stock')
      .data([...points].sort((a, b) => b.dividend_yield - a.dividend_yield))
      .join('circle')
      .attr('class', 'stock')
      .attr('cx', (d) => x(d.market_cap))
      .attr('cy', (d) => y(d.local_float_pct))
      .attr('r', (d) => r(d.dividend_yield))
      .attr('fill', (d) => SECTOR_COLORS[d.sector] || 'var(--chart-inactive)')
      .attr('fill-opacity', (d) => (d.highlighted || recTickers.has(d.ticker) ? 1 : 0.5))
      .attr('stroke', (d) => {
        if (d.highlighted) return 'var(--text-primary)';
        if (recTickers.has(d.ticker)) return 'var(--signal-positive)';
        return 'none';
      })
      .attr('stroke-width', (d) => (d.highlighted ? 2.5 : 2))
      .style('cursor', 'pointer')
      .call((sel) =>
        sel.append('title').text((d) => {
          const rec = recMap.get(d.ticker);
          const status = d.highlighted
            ? 'Your holding'
            : rec
              ? `${Math.round((rec.closeness ?? 0) * 100)}% match to ${rec.similar_to}`
              : '';
          return [
            `${d.ticker}: ${d.sector}`,
            `R${d.market_cap}bn, ${d.local_float_pct}% free float, ${d.dividend_yield}% yield`,
            status,
          ]
            .filter(Boolean)
            .join('\n');
        }),
      )
      .on('mousemove', (event, d) => {
        if (!tooltip || !container) return;
        const rect = container.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - rect.left + 12}px`;
        tooltip.style.top = `${event.clientY - rect.top - 8}px`;
        tooltip.style.opacity = '1';

        const rec = recMap.get(d.ticker);
        let statusHtml = '';
        if (d.highlighted) {
          statusHtml = `<div style="color:var(--accent-primary);font-weight:600;margin-top:4px">Your holding</div>`;
        } else if (rec) {
          statusHtml = `<div style="color:var(--signal-positive);font-weight:600;margin-top:4px">${Math.round((rec.closeness ?? 0) * 100)}% match to ${rec.similar_to}</div>`;
        }

        tooltip.innerHTML = `<strong>${d.ticker}</strong>: ${d.sector}<br/>R${d.market_cap}bn, ${d.local_float_pct}% free float, ${d.dividend_yield}% yield${statusHtml}`;
      })
      .on('mouseleave', () => {
        if (tooltip) tooltip.style.opacity = '0';
      });

    svg
      .append('defs')
      .append('marker')
      .attr('id', 'rec-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 10)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L10,5 L0,10 z')
      .attr('fill', 'var(--text-secondary)');

    recommended.forEach((rec) => {
      const target = universeMap.get(rec.ticker);
      const source = portfolioMap.get(rec.similar_to);
      if (!source || !target) return;

      const x1 = x(source.market_cap);
      const y1 = y(source.local_float_pct);
      const x2 = x(target.market_cap);
      const y2 = y(target.local_float_pct);
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const startGap = r(source.dividend_yield) + 2;
      const endGap = r(target.dividend_yield) + 2;

      if (dist <= startGap + endGap) return;

      const ux = (x2 - x1) / dist;
      const uy = (y2 - y1) / dist;

      svg
        .append('line')
        .attr('x1', x1 + ux * startGap)
        .attr('y1', y1 + uy * startGap)
        .attr('x2', x2 - ux * endGap)
        .attr('y2', y2 - uy * endGap)
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4,3')
        .attr('marker-end', 'url(#rec-arrow)');
    });
  }, [portfolio, universe, recommended]);

  const activeSectors = Array.from(new Set([...universe, ...portfolio].map((u) => u.sector)));

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox="0 0 720 460"
        role="img"
        aria-label="Similarity map of JSE stocks"
      />
      <div ref={tooltipRef} style={TOOLTIP_STYLE} />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          marginTop: '12px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
        }}
      >
        <span>Size: dividend yield</span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              border: '2px solid var(--text-primary)',
              display: 'inline-block',
            }}
          />
          Your holding
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              border: '2px solid var(--signal-positive)',
              display: 'inline-block',
            }}
          />
          Recommended
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="var(--text-secondary)"
              strokeWidth="1.2"
              strokeDasharray="4,3"
            />
            <path d="M16,1 L22,4 L16,7 z" fill="var(--text-secondary)" />
          </svg>
          Holding → recommendation
        </span>

        {activeSectors.map((sector) => (
          <span key={sector} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: SECTOR_COLORS[sector] || 'var(--chart-inactive)',
                display: 'inline-block',
              }}
            />
            {sector}
          </span>
        ))}
      </div>
    </div>
  );
}