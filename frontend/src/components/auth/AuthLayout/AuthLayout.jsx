const WORDMARK_TEXT_STYLE = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  letterSpacing: '0.06em',
  fontSize: '84px',
};

/**
 * @param {{ children: import('react').ReactNode }} props
 */
const AuthLayout = ({ children }) => (
  <div className="flex min-h-[calc(100vh-64px)] flex-col lg:flex-row">
    <div className="flex w-full flex-col items-center px-4 py-12 lg:w-1/2 lg:px-12">
      <div className="w-full max-w-md">{children}</div>
    </div>

    <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:gap-8 lg:px-12">
      <span style={{ whiteSpace: 'nowrap', fontSize: WORDMARK_TEXT_STYLE.fontSize }}>
        <span style={{ ...WORDMARK_TEXT_STYLE, color: 'var(--text-page)' }}>E</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '1.05em',
            height: '1.05em',
            verticalAlign: '-0.08em',
          }}>
          <svg
            viewBox="0 0 25 25"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: '100%' }}
          >
            <line
              x1="15.9"
              y1="15.9"
              x2="21.9"
              y2="21.9"
              stroke="var(--accent-primary)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="9.9" cy="9.9" r="7.6" fill="rgba(var(--accent-primary-rgb), 0.12)" />
            <circle cx="9.9" cy="9.9" r="7.6" stroke="var(--accent-primary)" strokeWidth="1.6" />
          </svg>
        </span>
        <span style={{ ...WORDMARK_TEXT_STYLE, color: 'var(--text-page)' }}>UITY</span>
        <span style={{ ...WORDMARK_TEXT_STYLE, color: 'var(--accent-primary)' }}>LENS</span>
      </span>
      <img
        src="/assets/logo.svg"
        alt="EquityLens"
        className="max-h-72 w-auto"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  </div>
);

export default AuthLayout;