import { describe, it, expect } from 'vitest';

import {
  annualisedVolatility,
  benchmarkGapTrend,
  bookTotal,
  currentDrawdown,
  dailyReturnsFromIndex,
  maxDrawdown,
  buildGroupSeries,
  movingAverage,
  rebaseBenchmarkToSlice,
  rebaseForRange,
  shareOfBook,
  seriesKey,
  versusMovingAverage,
} from './portfolioStats';

/** @param {number[]} values @param {number[]} [benchmark] */
const series = (values, benchmark) =>
  values.map((v, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    twr_index: v,
    value: v * 10,
    ...(benchmark ? { benchmark: benchmark[i] } : {}),
  }));

describe('seriesKey', () => {
  it('prefers the index so deposits do not read as a return', () => {
    expect(seriesKey(series([100, 110]))).toBe('twr_index');
  });

  it('falls back to raw value when no index has been built yet', () => {
    expect(seriesKey([{ value: 100 }, { value: 110 }])).toBe('value');
  });
});

describe('dailyReturnsFromIndex', () => {
  it('turns an index into period returns', () => {
    const returns = dailyReturnsFromIndex(series([100, 110, 99]));
    if (!returns) throw new Error('expected returns');
    expect(returns[0]).toBeCloseTo(0.1, 10);
    expect(returns[1]).toBeCloseTo(-0.1, 10);
  });

  it('steps over a gap rather than producing NaN on either side of it', () => {
    const withHole = [
      { twr_index: 100 },
      { twr_index: null },
      { twr_index: 121 },
      { twr_index: 133.1 },
    ];
    const returns = dailyReturnsFromIndex(withHole);
    if (!returns) throw new Error('expected returns');
    expect(returns).toHaveLength(1);
    expect(returns[0]).toBeCloseTo(0.1, 10);
  });

  it('is null when every pair touches a gap', () => {
    expect(dailyReturnsFromIndex([{ twr_index: 100 }, { twr_index: null }])).toBeNull();
  });

  it('is null for a single point, which has no return', () => {
    expect(dailyReturnsFromIndex(series([100]))).toBeNull();
    expect(dailyReturnsFromIndex([])).toBeNull();
  });
});

describe('annualisedVolatility', () => {
  it('scales the sample standard deviation by root 252', () => {
    const vol = annualisedVolatility([0.1, -0.1]);
    if (vol === null) throw new Error('expected a volatility');
    expect(vol).toBeCloseTo(0.1 * Math.sqrt(2) * Math.sqrt(252) * 100, 6);
  });

  it('is null with fewer than two returns', () => {
    expect(annualisedVolatility([0.1])).toBeNull();
    expect(annualisedVolatility(null)).toBeNull();
  });
});

describe('maxDrawdown', () => {
  it('finds the largest peak-to-trough fall and names both ends', () => {
    const result = maxDrawdown(series([100, 120, 100, 90, 110]));
    if (!result) throw new Error('expected a drawdown');
    expect(result.pct).toBeCloseTo(-25, 10);
    expect(result.peakDate).toBe('2026-01-02');
    expect(result.troughDate).toBe('2026-01-04');
    expect(result.recovered).toBe(false);
  });

  it('reports recovery once the series climbs back through the old peak', () => {
    const result = maxDrawdown(series([100, 120, 90, 125]));
    if (!result) throw new Error('expected a drawdown');
    expect(result.recovered).toBe(true);
  });

  it('is null for a series that only ever rose', () => {
    expect(maxDrawdown(series([100, 110, 120]))).toBeNull();
  });
});

describe('currentDrawdown', () => {
  it('measures the latest point against the running peak', () => {
    const result = currentDrawdown(series([100, 120, 90]));
    if (!result) throw new Error('expected a drawdown');
    expect(result.pct).toBeCloseTo(-25, 10);
    expect(result.peakDate).toBe('2026-01-02');
    expect(result.daysSincePeak).toBe(1);
  });

  it('is zero at a fresh high rather than pretending there is a fall', () => {
    const result = currentDrawdown(series([100, 90, 130]));
    if (!result) throw new Error('expected a result');
    expect(result.pct).toBe(0);
  });
});

describe('bookTotal and shareOfBook', () => {
  it('adds up only the values that are really numbers', () => {
    expect(bookTotal([{ value: 5000 }, { value: 3000 }, { value: 2000 }])).toBe(10000);
    expect(bookTotal([])).toBe(0);
    expect(bookTotal([{ value: null }, { value: undefined }, {}])).toBe(0);
  });

  it('divides a holding into the book', () => {
    const total = bookTotal([{ value: 5000 }, { value: 3000 }, { value: 2000 }]);
    expect(shareOfBook(5000, total)).toBeCloseTo(50, 10);
    expect(shareOfBook(3000, total)).toBeCloseTo(30, 10);
    expect(shareOfBook(2000, total)).toBeCloseTo(20, 10);
  });

  it('has no answer rather than a zero when there is no book to divide into', () => {
    expect(shareOfBook(5000, 0)).toBeNull();
    expect(shareOfBook(5000, bookTotal([]))).toBeNull();
    expect(shareOfBook(null, 10000)).toBeNull();
    expect(shareOfBook(5000, null)).toBeNull();
  });
});

describe('benchmarkGapTrend', () => {
  it('compares the gap now against the gap a window ago', () => {
    const result = benchmarkGapTrend(series([100, 104, 110], [100, 102, 103]), 1);
    if (!result) throw new Error('expected a trend');
    expect(result.nowPct).toBeCloseTo(7, 6);
    expect(result.thenPct).toBeCloseTo(2, 6);
    expect(result.widening).toBe(true);
  });

  it('is null without a benchmark on both ends', () => {
    expect(benchmarkGapTrend(series([100, 104, 110]), 1)).toBeNull();
  });
});

describe('movingAverage', () => {
  it('pads the points before the window fills rather than averaging a partial window', () => {
    const avg = movingAverage(series([10, 20, 30, 40]), undefined, 3);
    expect(avg).toEqual([null, null, 20, 30]);
  });

  it('is null when the series is shorter than the window', () => {
    expect(movingAverage(series([10, 20]), undefined, 3)).toBeNull();
  });
});

describe('versusMovingAverage', () => {
  it('says which side of the average the latest point sits, and by how far', () => {
    const result = versusMovingAverage(series([10, 20, 30, 40]), 3);
    if (!result) throw new Error('expected a comparison');
    expect(result.above).toBe(true);
    expect(result.average).toBe(30);
    expect(result.latest).toBe(40);
    expect(result.distancePct).toBeCloseTo(33.333, 3);
  });

  it('is null when there is not enough history to form the average', () => {
    expect(versusMovingAverage(series([10, 20]), 50)).toBeNull();
  });
});

describe('rebaseForRange', () => {
  const VISIBLE = [
    { date: '2026-01-01', name: 'Jan 01', value: 500000, benchmark: 200000 },
    { date: '2026-01-02', name: 'Jan 02', value: 750000, benchmark: 220000 },
    { date: '2026-01-03', name: 'Jan 03', value: 1000000, benchmark: 240000 },
  ];
  const HOLDING = {
    ticker: 'NPN.JO',
    points: [
      { date: '2026-01-01', close: 14000 },
      { date: '2026-01-02', close: 10500 },
      { date: '2026-01-03', close: 7000 },
    ],
  };

  it('starts every series at 100 regardless of its size in rands', () => {
    const { rows, baseDate, drawn } = rebaseForRange(VISIBLE, [HOLDING]);

    expect(baseDate).toBe('2026-01-01');
    expect(drawn).toEqual(['NPN.JO']);
    expect(rows[0].value).toBe(100);
    expect(rows[0].benchmark).toBe(100);
    expect(rows[0]['NPN.JO']).toBe(100);
    expect(rows[2].value).toBe(200);
    expect(rows[2]['NPN.JO']).toBe(50);
  });

  it('rebases to the start of whatever range it is given, not the start of the series', () => {
    const { rows, baseDate } = rebaseForRange(VISIBLE.slice(1), [HOLDING]);

    expect(baseDate).toBe('2026-01-02');
    expect(rows[0].value).toBe(100);
    expect(rows[1].value).toBeCloseTo(133.33, 1);
  });

  it('prefers twr_index so a deposit does not read as beating the holding', () => {
    const withDeposit = [
      { date: '2026-01-01', name: 'Jan 01', value: 500000, twr_index: 100 },
      { date: '2026-01-02', name: 'Jan 02', value: 1000000, twr_index: 101 },
    ];

    const { rows } = rebaseForRange(withDeposit, []);

    expect(rows[1].value).toBe(101);
  });

  it('carries the last known close across a gap rather than dropping the point', () => {
    const gappy = {
      ticker: 'SBK.JO',
      points: [
        { date: '2026-01-01', close: 200 },
        { date: '2026-01-03', close: 240 },
      ],
    };

    const { rows } = rebaseForRange(VISIBLE, [gappy]);

    expect(rows[0]['SBK.JO']).toBe(100);
    expect(rows[1]['SBK.JO']).toBe(100);
    expect(rows[2]['SBK.JO']).toBe(120);
  });

  it('reports a holding it could not draw instead of silently dropping it', () => {
    const empty = { ticker: 'XYZ.JO', points: [] };

    const { drawn, undrawn, rows } = rebaseForRange(VISIBLE, [HOLDING, empty]);

    expect(drawn).toEqual(['NPN.JO']);
    expect(undrawn).toEqual(['XYZ.JO']);
    expect(rows[0]['XYZ.JO']).toBeUndefined();
  });

  it('returns nothing rather than dividing by zero on an empty range', () => {
    expect(rebaseForRange([], [HOLDING])).toEqual({
      rows: [],
      baseDate: null,
      drawn: [],
      undrawn: ['NPN.JO'],
    });
  });
});

describe('rebaseBenchmarkToSlice', () => {
  const SLICE = [
    { date: '2026-06-01', value: 120, benchmark: 90 },
    { date: '2026-07-01', value: 132, benchmark: 99 },
    { date: '2026-08-01', value: 126, benchmark: 108 },
  ];

  it('levels the benchmark on the first visible day without touching its returns', () => {
    const levelled = rebaseBenchmarkToSlice(SLICE);

    expect(levelled[0].benchmark).toBeCloseTo(120, 10);
    expect(levelled[1].benchmark).toBeCloseTo(132, 10);
    expect(levelled[2].benchmark).toBeCloseTo(144, 10);

    expect(levelled[2].benchmark / levelled[0].benchmark)
      .toBeCloseTo(SLICE[2].benchmark / SLICE[0].benchmark, 10);
  });

  it('leaves the Vs benchmark figure exactly where it was', () => {
    const before = benchmarkGapTrend(SLICE, 1);
    const after = benchmarkGapTrend(rebaseBenchmarkToSlice(SLICE), 1);

    expect(after?.nowPct).toBeCloseTo(/** @type {number} */ (before?.nowPct), 10);
    expect(after?.thenPct).toBeCloseTo(/** @type {number} */ (before?.thenPct), 10);
  });

  it('does not mutate what it was given', () => {
    const input = SLICE.map((row) => ({ ...row }));
    rebaseBenchmarkToSlice(input);

    expect(input[0].benchmark).toBe(90);
  });

  it('hands the series back untouched when there is nothing to level against', () => {
    const noBenchmark = [{ date: '2026-06-01', value: 120 }];
    expect(rebaseBenchmarkToSlice(noBenchmark)).toBe(noBenchmark);

    const zero = [{ date: '2026-06-01', value: 120, benchmark: 0 }];
    expect(rebaseBenchmarkToSlice(zero)).toBe(zero);

    expect(rebaseBenchmarkToSlice([])).toEqual([]);
  });

  it('skips leading rows that have no benchmark yet rather than giving up', () => {
    const late = [
      { date: '2026-06-01', value: 100 },
      { date: '2026-07-01', value: 120, benchmark: 90 },
      { date: '2026-08-01', value: 126, benchmark: 108 },
    ];

    const levelled = rebaseBenchmarkToSlice(late);

    expect(levelled[0].benchmark).toBeUndefined();
    expect(levelled[1].benchmark).toBeCloseTo(120, 10);
  });
});

describe('buildGroupSeries', () => {
  const VISIBLE = [
    { date: '2026-01-01', name: 'Jan 01', value: 500000 },
    { date: '2026-01-02', name: 'Jan 02', value: 520000 },
    { date: '2026-01-03', name: 'Jan 03', value: 540000 },
  ];

  /** @param {string} ticker @param {number[]} closes */
  const series = (ticker, closes) => ({
    ticker,
    points: closes.map((close, i) => ({ date: VISIBLE[i].date, close })),
  });

  it('weights members from the start of the range, not from what they are worth today', () => {
    const { columns, drawn, weightBasis } = buildGroupSeries(
      VISIBLE,
      [series('A.JO', [100, 110, 120]), series('B.JO', [100, 90, 80])],
      [{ id: 'g1', name: 'Banks', members: [
        { ticker: 'A.JO', value: 60000, currentPrice: 120 },
        { ticker: 'B.JO', value: 40000, currentPrice: 80 },
      ] }],
    );

    expect(drawn).toEqual(['g1']);
    expect(weightBasis.g1).toBe('start');
    expect(columns.g1[0]).toBeCloseTo(100, 10);
    expect(columns.g1[2]).toBeCloseTo(100, 10);
    expect(columns.g1[2]).not.toBeCloseTo(104, 10);
  });

  it('falls back to today\'s value when a member has no price to divide by', () => {
    const { columns, drawn, weightBasis } = buildGroupSeries(
      VISIBLE,
      [series('A.JO', [100, 105, 110]), series('B.JO', [200, 195, 190])],
      [{ id: 'g1', name: 'Banks', members: [
        { ticker: 'A.JO', value: 60000, currentPrice: 110 },
        { ticker: 'B.JO', value: 40000, currentPrice: 0 },
      ] }],
    );

    expect(drawn).toEqual(['g1']);
    expect(weightBasis.g1).toBe('current');
    expect(columns.g1[0]).toBeCloseTo(100, 10);
    expect(columns.g1[2]).toBeCloseTo(104, 10);
  });

  it('drops a member with no closes and redistributes its weight', () => {
    const { columns, drawn, undrawn } = buildGroupSeries(
      VISIBLE,
      [series('A.JO', [100, 105, 110]), { ticker: 'B.JO', points: [] }],
      [{ id: 'g1', name: 'Banks', members: [
        { ticker: 'A.JO', value: 60000 },
        { ticker: 'B.JO', value: 40000 },
      ] }],
    );

    expect(drawn).toEqual(['g1']);
    expect(undrawn.g1).toEqual(['B.JO']);
    expect(columns.g1[2]).toBeCloseTo(110, 10);
  });

  it('emits null on a day a surviving member has no filled value yet', () => {
    const late = { ticker: 'B.JO', points: [{ date: '2026-01-02', close: 200 }] };

    const { columns } = buildGroupSeries(
      VISIBLE,
      [series('A.JO', [100, 105, 110]), late],
      [{ id: 'g1', name: 'Banks', members: [
        { ticker: 'A.JO', value: 50000 },
        { ticker: 'B.JO', value: 50000 },
      ] }],
    );

    expect(columns.g1[0]).toBeNull();
    expect(columns.g1[1]).toBeCloseTo(102.5, 10);
  });

  it('lets a holding sit in two groups without either affecting the other', () => {
    const { columns } = buildGroupSeries(
      VISIBLE,
      [series('A.JO', [100, 105, 110]), series('B.JO', [200, 195, 190])],
      [
        { id: 'g1', name: 'One', members: [{ ticker: 'A.JO', value: 60000 }] },
        { id: 'g2', name: 'Two', members: [
          { ticker: 'A.JO', value: 60000 },
          { ticker: 'B.JO', value: 40000 },
        ] },
      ],
    );

    expect(columns.g1[2]).toBeCloseTo(110, 10);
    expect(columns.g2[2]).toBeCloseTo(104, 10);
  });

  it('draws nothing rather than dividing by zero on an empty or valueless group', () => {
    const { columns, drawn, undrawn } = buildGroupSeries(
      VISIBLE,
      [series('A.JO', [100, 105, 110])],
      [
        { id: 'empty', name: 'Empty', members: [] },
        { id: 'free', name: 'Free', members: [{ ticker: 'A.JO', value: 0 }] },
      ],
    );

    expect(drawn).toEqual([]);
    expect(columns.empty).toBeUndefined();
    expect(undrawn.free).toEqual([]);
  });

  it('has nothing to draw on an empty range', () => {
    expect(buildGroupSeries([], [], [{ id: 'g1', name: 'X', members: [] }])).toEqual({
      columns: {}, drawn: [], undrawn: {}, weightBasis: {},
    });
  });
});
