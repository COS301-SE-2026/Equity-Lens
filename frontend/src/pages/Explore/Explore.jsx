import { useEffect, useState, useMemo, useRef } from 'react';

import { ExposureChart } from '../../components/charts/ExposureChart/ExposureChart';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';
import { getAccessToken } from '../../services/guestSession';
import { API_BASE_URL } from '../../utils/constants';

const SECTION_LABEL_STYLE = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-mono)',
  marginBottom: '6px',
};

const HIDDEN_TEXT_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const GLASS_PANEL_STYLE = {
  borderRadius: '16px',
  padding: '20px',
};

const focusRingStyle = {
  outline: '2px solid var(--accent-primary)',
  outlineOffset: '2px',
};

/** @type {Record<string, string>} */
const UNAVAILABLE_MESSAGES = {
  no_holdings: 'Add holdings to your portfolio to see similar JSE shares.',
  no_jse_holdings:
    "Explore finds JSE shares similar to the ones you hold. Your portfolio doesn't contain any JSE-listed shares yet.",
};

/**
 * @typedef {import('../../components/charts/ExposureChart/ExposureChart').Stock} Stock
 * @typedef {import('../../components/charts/ExposureChart/ExposureChart').Recommendation} Recommendation
 * @typedef {{ eligible: false, reason: string, excluded: string[] }
 *   | { eligible: true, excluded: string[], portfolio: Stock[], universe: Stock[],
 *       recommended: Recommendation[] }} ExploreResponse
 */

export default function Explore() {
  const [data, setData] = useState(/** @type {ExploreResponse | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [showRecommendedSummary, setShowRecommendedSummary] = useState(true);
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getAccessToken()
      .then((token) =>
        fetch(`${API_BASE_URL}/explore/recommendations?k=9`, {
          headers: { Authorization: `Bearer ${token}` },
        }),)
      .then((res) => {
        if (res.status === 503)
          throw new Error('market data is temporarily unavailable. Try again shortly.');
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (active) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, []);

  const universeMap = useMemo(() => {
    if (!data?.eligible) return new Map();
    return new Map(data.universe.map((item) => [item.ticker, item.name]));
  }, [data]);

  return (
    <div
      style={{
        background: 'var(--surface-base)',
        minHeight: '100vh',
        color: 'var(--text-page)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <a
        href="#visual-map"
        style={{
          position: 'absolute',
          left: '16px',
          top: '-48px',
          zIndex: 100,
          background: 'var(--surface-base)',
          color: 'var(--text-page)',
          padding: '10px 14px',
          borderRadius: '999px',
          border: '1px solid var(--border-subtle)',
          textDecoration: 'none',
          fontSize: '13px',
          fontWeight: 600,
        }}
        onFocus={(event) => {
          event.currentTarget.style.top = '16px';
        }}
        onBlur={(event) => {
          event.currentTarget.style.top = '-48px';
        }}
      >
        Skip to visual map
      </a>

      <main id="explore-page" aria-labelledby="explore-title" style={{ width: '100%' }}>
        <div className="mx-auto max-w-6xl px-4 lg:px-6 py-12">
          <p style={SECTION_LABEL_STYLE}>Explore</p>
          <h1
            id="explore-title"
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--text-page)',
              lineHeight: 1.3,
              marginBottom: '8px',
            }}
          >
            More of what you like
          </h1>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => dialogRef.current?.showModal()}
            style={{
              display: 'block',
              background: 'none',
              border: 'none',
              padding: 0,
              marginBottom: '32px',
              fontSize: '13px',
              color: 'var(--accent-primary)',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              cursor: 'pointer',
            }}
            onFocus={(event) => Object.assign(event.currentTarget.style, focusRingStyle)}
            onBlur={(event) => {
              event.currentTarget.style.outline = 'none';
              event.currentTarget.style.outlineOffset = '0';
            }}
          >
            How it works
          </button>
          {loading && (
            <div aria-live="polite" style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <LoadingSpinner size="md" />
            </div>
          )}

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                background: 'var(--signal-negative-bg)',
                border: '1px solid var(--signal-negative-border)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                maxWidth: '480px',
              }}
            >
              <p style={{ fontSize: '13px', color: 'var(--signal-negative)', margin: 0 }}>
                Couldn&apos;t load recommendations: {error}
              </p>
            </div>
          )}

          {data?.eligible && (
            <div
              aria-live="polite"
              className="glass-surface"
              style={{
                ...GLASS_PANEL_STYLE,
                marginBottom: '20px',
                paddingTop: '16px',
                paddingBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginBottom: showRecommendedSummary ? '12px' : '0',
                }}
              >
                <p style={{ ...SECTION_LABEL_STYLE, marginBottom: 0 }}>Recommended ideas</p>
                <button
                  type="button"
                  aria-controls="recommended-summary-list"
                  aria-expanded={showRecommendedSummary}
                  onClick={() => setShowRecommendedSummary((current) => !current)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '999px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {showRecommendedSummary ? 'Hide recommended ideas' : 'Show recommended ideas'}
                </button>
              </div>

              {showRecommendedSummary && (
                <ul
                  id="recommended-summary-list"
                  aria-label="Recommended ideas summary"
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  {data.recommended.map((rec) => (
                    <li
                      key={rec.ticker}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--surface-base)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '999px',
                        padding: '6px 10px',
                        fontSize: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                        }}
                      >
                        {rec.ticker}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {universeMap.get(rec.ticker) || rec.ticker}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {Math.round((rec.closeness ?? 0) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        {data && !data.eligible && (
          <div className="glass-surface" style={{ ...GLASS_PANEL_STYLE, maxWidth: '560px' }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 8px',
              }}
            >
              Explore isn&apos;t available for this portfolio
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {UNAVAILABLE_MESSAGES[data.reason]}
            </p>
            {data.excluded?.length > 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '12px 0 0' }}>
                Not supported: {data.excluded.join(', ')}
              </p>
            )}
          </div>
        )}

        {data?.eligible && (
          <>
            {data.excluded?.length > 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                Not included: {data.excluded.join(', ')}. Explore only covers JSE-listed shares.
              </p>
            )}

            <section id="visual-map" aria-labelledby="visual-map-title" aria-label="Visual map of recommendations">
              <p style={SECTION_LABEL_STYLE}>Visual map</p>
              <h2
                id="visual-map-title"
                style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  color: 'var(--text-page)',
                  marginBottom: '16px',
                }}
              >
                See it on the map
              </h2>
              <div className="glass-surface" style={GLASS_PANEL_STYLE}>
                <ExposureChart
                  portfolio={data.portfolio}
                  universe={data.universe}
                  recommended={data.recommended}
                />
              </div>
            </section>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '32px 0 48px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {data.recommended.map((rec) => (
                <li key={rec.ticker} className="glass-surface" style={GLASS_PANEL_STYLE}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {rec.ticker}
                    </span>
                    <span
                      style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}
                    >
                      {universeMap.get(rec.ticker) || rec.ticker}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {rec.description}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      </main>
      <dialog
        ref={dialogRef}
        aria-labelledby="explore-how-title"
        aria-describedby="explore-how-description"
        className="m-auto w-[min(90vw,520px)] rounded-2xl p-6 backdrop:bg-black/60"
        style={{
          background: 'var(--surface-base)',
          color: 'var(--text-page)',
          border: '1px solid var(--accent-subtle)',
        }}
      >
        <h2
          id="explore-how-title"
          style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 12px' }}
        >
          How recommendations work
        </h2>
        <ol
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 16px',
            paddingLeft: '20px',
            listStyle: 'decimal',
          }}
        >
          <li>
            We look at the JSE-listed shares in your portfolio. Shares from other exchanges are
            skipped, so the comparison stays fair and consistent.
          </li>
          <li>
            Every share on the JSE is described by four traits: market cap, free float %, sector and
            dividend yield. These are the drivers that determine where a share sits on the map.
          </li>
          <li>
            We match each recommendation to the holding it&apos;s most similar to, with a match
            percentage, and show you the nine best matches.
          </li>
          <li>
            The map plots your holdings and the recommendations against the rest of the JSE. Arrows
            point from each holding to the shares that resemble it, and the highlighted nodes show the
            closest matches.
          </li>
          <li>
            You can zoom in, pan around the map, and click a holding to isolate the related ideas.
            This helps you inspect the nearest suggestions without losing the full portfolio context.
          </li>
        </ol>
        <p
          id="explore-how-description"
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 8px',
          }}
        >
          For example, if you hold a large bank with a high dividend yield, you&apos;ll likely see
          other large, high-yield financial shares. Similar does not mean identical, and it does
          not mean the recommendation is better or worse.
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 20px',
          }}
        >
          Tip: use the legend and zoom controls to understand the chart quickly. The map is a research
          aid, not financial advice.
        </p>
        <button
          type="button"
          aria-label="Close how it works dialog"
          onClick={() => dialogRef.current?.close()}
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{
            background: 'var(--accent-subtle)',
            color: 'var(--accent-primary)',
            border: 'none',
            cursor: 'pointer',
          }}
          onFocus={(event) => Object.assign(event.currentTarget.style, focusRingStyle)}
          onBlur={(event) => {
            event.currentTarget.style.outline = 'none';
            event.currentTarget.style.outlineOffset = '0';
          }}
        >
          Got it
        </button>
      </dialog>
    </div>
  );
}
