import { useEffect, useState, useMemo } from 'react';
import { ExposureChart } from '../../components/charts/ExposureChart/ExposureChart';
import { API_BASE_URL } from '../../utils/constants';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';

const SECTION_LABEL_STYLE = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-mono)',
  marginBottom: '6px',
};

const GLASS_PANEL_STYLE = {
  borderRadius: '16px',
  padding: '20px',
};

/** @type {Record<string, string>} */
const UNAVAILABLE_MESSAGES = {
  no_holdings: 'Add holdings to your portfolio to see similar JSE shares.',
  no_jse_holdings:
    "Explore finds JSE shares similar to the ones you hold. Your portfolio doesn't contain any JSE-listed shares yet.",
};

function getCognitoAccessToken() {
  const authKey = Object.keys(localStorage).find(
    (key) => key.startsWith('CognitoIdentityServiceProvider.') && key.endsWith('.LastAuthUser'),
  );
  if (!authKey) return null;

  const prefix = authKey.replace('.LastAuthUser', '');
  const sub = localStorage.getItem(authKey);
  return localStorage.getItem(`${prefix}.${sub}.accessToken`);
}

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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const token = getCognitoAccessToken();

    fetch(`${API_BASE_URL}/explore/recommendations?k=9`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 503) throw new Error('market data is temporarily unavailable. Try again shortly.');
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
      <div className="mx-auto max-w-6xl px-4 lg:px-6 py-12">
        <p style={SECTION_LABEL_STYLE}>Explore</p>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: 'var(--text-page)',
            lineHeight: 1.3,
            marginBottom: '32px',
          }}
        >
          More of what you like
        </h1>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <LoadingSpinner size="md" />
          </div>
        )}

        {error && (
          <div
            role="alert"
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

                {data && !data.eligible && (
          <div className="glass-surface" style={{ ...GLASS_PANEL_STYLE, maxWidth: '560px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Explore isn&apos;t available for this portfolio
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
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
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 48px',
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

            <section aria-label="Visual map of recommendations">
              <p style={SECTION_LABEL_STYLE}>Visual map</p>
              <h2
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
          </>
        )}
      </div>
    </div>
  );
}