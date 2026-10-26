import * as d3 from 'd3';
import { useCallback, useEffect, useRef, useState } from 'react';

import InfoTooltip from '../../common/InfoToolTip/InfoTooltip';

/**
 * @typedef {{ ticker: string, name?: string, sector: string, market_cap: number,
 *   local_float_pct: number, dividend_yield: number, highlighted?: boolean }} Stock
 * @typedef {{ ticker: string, similar_to: string, distance?: number, closeness?: number,
 *   description?: string }} Recommendation
 * @typedef {{ source: string, target: string, x1: number, y1: number, x2: number, y2: number }} Link
 */

/** @type {Record<string, string>} */
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

/** @type {import('react').CSSProperties} */
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

const KEY_OPACITY = 1;
const BACKGROUND_OPACITY = 0.35;
const DIMMED_OPACITY = 0.08;
const FOCUS_MS = 150;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4.5;

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const METRIC_HELP = {
  marketCap:
    "The total value of a company's shares: share price x number of shares. A R50 share with 1 billion shares in issue has a market cap of R50bn. The map uses a log scale, so each step to the right multiplies the value (R10bn, R20bn, R50bn) rather than adding a fixed amount.",
  freeFloat:
    'The percentage of shares available for ordinary investors to trade, excluding stakes held by founders, governments or strategic owners. A low free float means fewer shares change hands, so the price can move more sharply.',
  dividendYield:
    'Yearly dividends as a percentage of the share price. A R100 share paying R5 a year has a 5% yield. Bigger bubbles pay higher yields.',
};

/**
 * @param {number} min
 * @param {number} max
 * @param {number} [maxCount]
 */
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

/**
 * @param {{ portfolio?: Stock[], universe?: Stock[], recommended?: Recommendation[] }} props
 */
export function ExposureChart({ portfolio = [], universe = [], recommended = [] }) {
  const svgRef = useRef(/** @type {SVGSVGElement | null} */ (null));
  const tooltipRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const focusRef = useRef(/** @type {((ticker: string | null) => void) | null} */ (null));
  const [selected, setSelected] = useState(/** @type {string | null} */ (null));
  const [zoomState, setZoomState] = useState({ scale: MIN_ZOOM, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef(/** @type {{ x: number, y: number } | null} */ (null));

  const getSelectedNodePoint = useCallback(() => {
    if (!selected || !svgRef.current) return null;
    const selectedNode = svgRef.current.querySelector(
      `circle.stock[aria-label^="${CSS.escape(selected)}"]`,
    );
    if (!selectedNode) return null;
    const svgRect = svgRef.current.getBoundingClientRect();
    const nodeRect = selectedNode.getBoundingClientRect();
    return {
      x: nodeRect.left - svgRect.left + nodeRect.width / 2,
      y: nodeRect.top - svgRect.top + nodeRect.height / 2,
    };
  }, [selected]);

  const handleZoomAction = useCallback(
    /** @param {number} direction */
    (direction, point = getSelectedNodePoint()) => {
      setZoomState((current) => {
        const nextScale = clamp(current.scale * direction, MIN_ZOOM, MAX_ZOOM);
        const svg = svgRef.current;

        if (!svg) {
          return { scale: nextScale, x: 0, y: 0 };
        }

        const rect = svg.getBoundingClientRect();
        const centerX = point?.x ?? rect.width / 2;
        const centerY = point?.y ?? rect.height / 2;
        const xShift = (centerX - rect.width / 2) * (1 - nextScale / current.scale);
        const yShift = (centerY - rect.height / 2) * (1 - nextScale / current.scale);

        return {
          scale: nextScale,
          x: current.x + xShift,
          y: current.y + yShift,
        };
      });
    },
    [getSelectedNodePoint],
  );

  const handleWheel = useCallback(
    /** @param {any} event */
    (event) => {
      event.preventDefault();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      handleZoomAction(event.deltaY < 0 ? 1.12 : 0.9, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [handleZoomAction],
  );

  const handleChartKeyDown = useCallback(
    /** @param {any} event */
    (event) => {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        handleZoomAction(1.2, getSelectedNodePoint() ?? undefined);
      } else if (event.key === '-') {
        event.preventDefault();
        handleZoomAction(0.85, getSelectedNodePoint() ?? undefined);
      } else if (event.key === '0') {
        event.preventDefault();
        setZoomState({ scale: MIN_ZOOM, x: 0, y: 0 });
      }
    },
    [getSelectedNodePoint, handleZoomAction],
  );

  const handlePointerDown = useCallback(/** @param {any} event */(event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (!svgRef.current) return;
    dragState.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    event.preventDefault();
    svgRef.current.setPointerCapture?.(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(/** @param {any} event */(event) => {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.x;
    const dy = event.clientY - dragState.current.y;
    dragState.current = { x: event.clientX, y: event.clientY };
    setZoomState((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }, []);

  const handlePointerUp = useCallback(/** @param {any} event */(event) => {
    if (!dragState.current && !isDragging) return;
    if (svgRef.current && typeof event.pointerId === 'number') {
      svgRef.current.releasePointerCapture?.(event.pointerId);
    }
    dragState.current = null;
    setIsDragging(false);
  }, [isDragging]);

  useEffect(() => {
    if (!svgRef.current || !universe.length) return;

    const heldTickers = new Set(portfolio.map((p) => p.ticker));
    const universeTickers = new Set(universe.map((u) => u.ticker));
    const points = [...universe, ...portfolio.filter((p) => !universeTickers.has(p.ticker))].map(
      (p) => ({
        ...p,
        highlighted: heldTickers.has(p.ticker),
      }),
    );

    const width = 720;
    const height = 460;
    const margin = { top: 20, right: 30, bottom: 56, left: 64 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (selected && !points.some((point) => point.ticker === selected)) {
      setSelected(null);
    }

    const root = svg
      .append('g')
      .attr('class', 'chart-root')
      .attr('transform', `translate(${zoomState.x} ${zoomState.y}) scale(${zoomState.scale})`);

    const xMin = (d3.min(points, (d) => d.market_cap) || 1) * 0.8;
    const xMax = (d3.max(points, (d) => d.market_cap) || 100) * 1.2;
    const yMax = (d3.max(points, (d) => d.local_float_pct) || 100) * 1.1;
    const yieldMax = Math.min(d3.max(points, (d) => d.dividend_yield) || 10, 15);

    const x = d3
      .scaleLog()
      .domain([xMin, xMax])
      .range([margin.left, width - margin.right]);
    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .range([height - margin.bottom, margin.top]);
    const r = d3.scaleSqrt().domain([0, yieldMax]).range([5, 24]).clamp(true);

    const yTicks = y.ticks(5);
    const xTicks = getLogTicks(xMin, xMax, 6);

    root
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

    root
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

    const xAxis = root
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(xTicks)
          .tickFormat((v) => `R${Math.round(Number(v))}bn`),
      );

    xAxis.selectAll('text').style('fill', 'var(--chart-axis-text)').style('font-size', '11px');
    xAxis.selectAll('path, line').style('stroke', 'var(--border-subtle)');

    const yAxis = root
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((v) => `${Math.round(Number(v))}%`),
      );

    yAxis.selectAll('text').style('fill', 'var(--chart-axis-text)').style('font-size', '11px');
    yAxis.selectAll('path, line').style('stroke', 'var(--border-subtle)');

    root
      .append('text')
      .attr('x', (margin.left + width - margin.right) / 2)
      .attr('y', height - 12)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--chart-axis-text)')
      .style('font-size', '11px')
      .text('Market cap (log scale)');

    root
      .append('text')
      .attr('transform', `translate(16,${(margin.top + height - margin.bottom) / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--chart-axis-text)')
      .style('font-size', '11px')
      .text('Free float %');

    const universeMap = new Map(points.map((u) => [u.ticker, u]));
    const recMap = new Map(recommended.map((rec) => [rec.ticker, rec]));
    const recTickers = new Set(recommended.map((rec) => rec.ticker));
    /** @param {Stock} d */
    const isKey = (d) => d.highlighted || recTickers.has(d.ticker);
    /** @param {Stock} d */
    const radius = (d) => (isKey(d) ? r(d.dividend_yield) : r(d.dividend_yield) * 0.6);
    /** @param {Stock} d */
    const baseOpacity = (d) => (isKey(d) ? KEY_OPACITY : BACKGROUND_OPACITY);
    /** @param {{ closeness?: number }} d */
    const haloOpacity = (d) => (d.closeness ?? 0.3) * 0.4;

    const haloPoints = recommended.flatMap((rec) => {
      const point = universeMap.get(rec.ticker);
      return point ? [{ ...point, closeness: rec.closeness }] : [];
    });

    const halos = root
      .append('g')
      .selectAll('.halo')
      .data(haloPoints)
      .join('circle')
      .attr('class', 'halo')
      .attr('cx', (d) => x(d.market_cap))
      .attr('cy', (d) => y(d.local_float_pct))
      .attr('r', (d) => r(d.dividend_yield) + 14)
      .attr('fill', 'var(--signal-positive)')
      .attr('fill-opacity', haloOpacity)
      .style('pointer-events', 'none');

    const tooltip = tooltipRef.current;
    const container = svgRef.current.parentElement;
    const drawOrder = [...points].sort(
      (a, b) => Number(isKey(a)) - Number(isKey(b)) || b.dividend_yield - a.dividend_yield,
    );

    const stocks = root
      .append('g')
      .selectAll('.stock')
      .data(drawOrder)
      .join('circle')
      .attr('class', 'stock')
      .attr('cx', (d) => x(d.market_cap))
      .attr('cy', (d) => y(d.local_float_pct))
      .attr('r', radius)
      .attr('fill', (d) => SECTOR_COLORS[d.sector] || 'var(--chart-inactive)')
      .attr('fill-opacity', baseOpacity)
      .attr('stroke', (d) => {
        if (d.highlighted) return 'var(--text-primary)';
        if (recTickers.has(d.ticker)) return 'var(--signal-positive)';
        return 'none';
      })
      .attr('stroke-width', (d) => (d.highlighted ? 2.5 : 2))
      .style('cursor', (d) => (isKey(d) ? 'pointer' : 'default'))
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

    const defs = root.append('defs');
    [
      ['rec-arrow', 'var(--text-secondary)'],
      ['rec-arrow-active', 'var(--text-primary)'],
    ].forEach(([id, fill]) => {
      defs
        .append('marker')
        .attr('id', id)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 10)
        .attr('refY', 5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,0 L10,5 L0,10 z')
        .attr('fill', fill);
    });

    const links = recommended
      .map((rec) => {
        const source = universeMap.get(rec.similar_to);
        const target = universeMap.get(rec.ticker);
        if (!source || !target) return null;

        const x1 = x(source.market_cap);
        const y1 = y(source.local_float_pct);
        const x2 = x(target.market_cap);
        const y2 = y(target.local_float_pct);
        const dist = Math.hypot(x2 - x1, y2 - y1);
        if (dist < 6) return null;

        const startGap = radius(source) + 2;
        const endGap = radius(target) + 2;
        if (dist <= startGap + endGap) {
          return { source: source.ticker, target: target.ticker, x1, y1, x2, y2 };
        }

        const ux = (x2 - x1) / dist;
        const uy = (y2 - y1) / dist;
        return {
          source: source.ticker,
          target: target.ticker,
          x1: x1 + ux * startGap,
          y1: y1 + uy * startGap,
          x2: x2 - ux * endGap,
          y2: y2 - uy * endGap,
        };
      })
      .filter((l) => l !== null);

    const linkLayer = root.append('g').style('pointer-events', 'none');
    const linkGroups = linkLayer.selectAll('g').data(links).join('g').attr('opacity', 0.8);

    linkGroups
      .append('line')
      .attr('x1', (l) => l.x1)
      .attr('y1', (l) => l.y1)
      .attr('x2', (l) => l.x2)
      .attr('y2', (l) => l.y2)
      .attr('stroke', 'var(--chart-tooltip-bg)')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');

    const linkLines = linkGroups
      .append('line')
      .attr('x1', (l) => l.x1)
      .attr('y1', (l) => l.y1)
      .attr('x2', (l) => l.x2)
      .attr('y2', (l) => l.y2)
      .attr('stroke', 'var(--text-secondary)')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,3')
      .attr('marker-end', 'url(#rec-arrow)');

    const focusText = root.append('g').style('pointer-events', 'none');

    /** @type {string | null} */
    let focused = null;

    /** @param {string} ticker */
    function relatedTo(ticker) {
      const related = new Set([ticker]);
      recommended.forEach((rec) => {
        if (rec.similar_to === ticker) related.add(rec.ticker);
        if (rec.ticker === ticker) related.add(rec.similar_to);
      });
      return related;
    }

    /** @param {string | null} ticker */
    function applyFocus(ticker) {
      focused = ticker;
      setSelected(ticker);
      const related = ticker ? relatedTo(ticker) : null;
      /** @param {Link} l */
      const active = (l) => Boolean(related) && (l.source === ticker || l.target === ticker);

      stocks
        .transition()
        .duration(FOCUS_MS)
        .attr('fill-opacity', (d) =>
          !related ? baseOpacity(d) : related.has(d.ticker) ? KEY_OPACITY : DIMMED_OPACITY,
        )
        .attr('stroke-opacity', (d) => (!related || related.has(d.ticker) ? 1 : 0.15))
        .attr('stroke-width', (d) => {
          const base = d.highlighted ? 2.5 : 2;
          return related && related.has(d.ticker) ? base + 1 : base;
        });

      halos
        .transition()
        .duration(FOCUS_MS)
        .attr('fill-opacity', (d) => (!related || related.has(d.ticker) ? haloOpacity(d) : 0.03));

      linkGroups
        .transition()
        .duration(FOCUS_MS)
        .attr('opacity', (l) => (!related ? 0.8 : active(l) ? 1 : 0.05));

      linkLines
        .attr('marker-end', (l) => (active(l) ? 'url(#rec-arrow-active)' : 'url(#rec-arrow)'))
        .transition()
        .duration(FOCUS_MS)
        .attr('stroke', (l) => (active(l) ? 'var(--text-primary)' : 'var(--text-secondary)'))
        .attr('stroke-width', (l) => (active(l) ? 1.8 : 1.2));

      if (related) stocks.filter((d) => related.has(d.ticker)).raise();
      linkLayer.raise();

      const pairs = ticker
        ? recommended.filter((rec) => rec.similar_to === ticker || rec.ticker === ticker)
        : [];
      const isHolding = ticker !== null && universeMap.get(ticker)?.highlighted;
      const lines = pairs.length
        ? pairs.map(
            (rec) =>
              `${rec.similar_to} → ${rec.ticker} (${Math.round((rec.closeness ?? 0) * 100)}%)`,
          )
        : isHolding
          ? [`${ticker}: no close matches in the JSE universe`]
          : [];

      focusText
        .selectAll('text')
        .data(lines)
        .join('text')
        .attr('x', width - margin.right - 8)
        .attr('y', (_, i) => height - margin.bottom - 12 - (lines.length - 1 - i) * 16)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('font-weight', 600)
        .style('fill', 'var(--text-primary)')
        .style('stroke', 'var(--chart-tooltip-bg)')
        .style('stroke-width', 3)
        .style('paint-order', 'stroke')
        .text((line) => line);

      focusText.raise();
    }

    /** @param {Stock} d */
    const toggle = (d) => applyFocus(focused === d.ticker ? null : d.ticker);

    stocks
      .on('click', (event, d) => {
        event.stopPropagation();
        if (isKey(d)) toggle(d);
        else applyFocus(null);
      })
      .filter(isKey)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => {
        const rec = recMap.get(d.ticker);
        return d.highlighted
          ? `${d.ticker}, your holding. Show its recommendations.`
          : `${d.ticker}, recommended as similar to ${rec?.similar_to}. Show the holding it matches.`;
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle(d);
        } else if (event.key === 'Escape') {
          applyFocus(null);
        }
      });

    svg.on('click', () => applyFocus(null));
    focusRef.current = applyFocus;

    if (selected) {
      applyFocus(selected);
    }
  }, [portfolio, universe, recommended, zoomState]);

  const activeSectors = Array.from(new Set([...universe, ...portfolio].map((u) => u.sector)));

  return (
    <div style={{ position: 'relative' }}>
      <div
        role="group"
        aria-label="Your holdings"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}
      >
        {portfolio.map((p) => {
          const isOn = selected === p.ticker;
          return (
            <button
              key={p.ticker}
              type="button"
              aria-pressed={isOn}
              onClick={() => focusRef.current?.(isOn ? null : p.ticker)}
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                border: `1px solid ${isOn ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
                background: isOn ? 'var(--text-primary)' : 'transparent',
                color: isOn ? 'var(--chart-tooltip-bg)' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {p.ticker}
            </button>
          );
        })}
      </div>
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        Select a holding or recommendation to see how they connect. Select it again, or anywhere
        else on the map, to reset.
      </p>
      <div
        role="toolbar"
        aria-label="Map zoom controls"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => handleZoomAction(1.2, getSelectedNodePoint() ?? undefined)}
          onFocus={(event) => Object.assign(event.currentTarget.style, { outline: '2px solid var(--accent-primary)', outlineOffset: '2px' })}
          onBlur={(event) => {
            event.currentTarget.style.outline = 'none';
            event.currentTarget.style.outlineOffset = '0';
          }}
          style={{
            padding: '6px 10px',
            borderRadius: '999px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => handleZoomAction(0.85, getSelectedNodePoint() ?? undefined)}
          onFocus={(event) => Object.assign(event.currentTarget.style, { outline: '2px solid var(--accent-primary)', outlineOffset: '2px' })}
          onBlur={(event) => {
            event.currentTarget.style.outline = 'none';
            event.currentTarget.style.outlineOffset = '0';
          }}
          style={{
            padding: '6px 10px',
            borderRadius: '999px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset view"
          onClick={() => setZoomState({ scale: MIN_ZOOM, x: 0, y: 0 })}
          onFocus={(event) => Object.assign(event.currentTarget.style, { outline: '2px solid var(--accent-primary)', outlineOffset: '2px' })}
          onBlur={(event) => {
            event.currentTarget.style.outline = 'none';
            event.currentTarget.style.outlineOffset = '0';
          }}
          style={{
            padding: '6px 10px',
            borderRadius: '999px',
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Reset view
        </button>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
          Drag to pan, scroll to zoom, or press + / − / 0 to adjust the view
        </span>
      </div>
      <div
        role="group"
        aria-label="Chart legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '12px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Across: <InfoTooltip label="Market cap" text={METRIC_HELP.marketCap} />
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Height: <InfoTooltip label="Free float %" text={METRIC_HELP.freeFloat} />
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Size: <InfoTooltip label="Dividend yield" text={METRIC_HELP.dividendYield} />
        </span>
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
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <p id="explore-chart-instructions" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap' }}>
          Drag across the map to pan around it. Use the mouse wheel or the zoom controls to magnify the map. Press plus or minus to zoom in or out, and zero to reset.
        </p>
        <svg
          ref={svgRef}
          width="100%"
          viewBox="0 0 720 460"
          role="group"
          aria-label="Similarity map of JSE stocks"
          aria-describedby="explore-chart-instructions"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onKeyDown={handleChartKeyDown}
          onWheel={handleWheel}
          style={{ display: 'block', background: 'var(--surface-base)', touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        />
      </div>
      <div ref={tooltipRef} style={TOOLTIP_STYLE} />
    </div>
  );
}
