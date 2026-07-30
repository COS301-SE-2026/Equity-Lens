import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Menu,
  X,
  Lock,
  EyeOff,
  Command,
  Percent,
  Radio,
  Layers,
  KeyRound,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ROUTES } from '../../utils/constants';

const CONTACT_EMAIL = 'thebigfivetb5@gmail.com';

const ACCENT = '#FF6B00';
/** @type {[number, number, number, number]} */
const EASE_SMOOTH = [0.16, 1, 0.3, 1];

const PRESETS = {
  diversified: {
    label: 'Well-Diversified Global Portfolio',
    composition: '50% Satrix MSCI World · 30% CoreShares Total World · 20% Satrix Emerging Markets',
    caption: 'Designed to spread investments across multiple countries and markets. Because the underlying holdings are more diverse, no single company has a significant influence on the overall portfolio.',
    exposure: [
      { name: 'AAPL', value: 4.4 },
      { name: 'MSFT', value: 4.1 },
      { name: 'NVDA', value: 3.8 },
      { name: 'TSMC', value: 2.4 },
      { name: 'Tencent', value: 2.1 },
      { name: 'Samsung', value: 1.7 },
      { name: 'Other', value: 81.5 },
    ],
    concentration: 18.5,
    riskNote: 'No single company makes up more than 5% of this portfolio.',
    insight: 'True diversification reduces your dependence on a small group of companies. This is what look-through analysis should show, not funds hiding behind other funds.',
  },
  jseBlueChip: {
    label: 'JSE Blue-Chip Portfolio',
    composition: 'Naspers · Standard Bank · Capitec · Anglo American · BHP Group',
    caption: "Five of the JSE's largest companies, held directly rather than through an ETF.",
    exposure: [
      { name: 'NPN', value: 11 },
      { name: 'SBK', value: 8 },
      { name: 'CPI', value: 7 },
      { name: 'AGL', value: 7 },
      { name: 'BHG', value: 6 },
      { name: 'Other', value: 61 },
    ],
    concentration: 39,
    riskNote: 'These five blue-chips make up under 40% of this portfolio, the rest is spread across other JSE holdings.',
    insight: "Direct JSE holdings get the same look-through analysis as ETFs. This portfolio leans toward Financials and Resources, but isn't dangerously concentrated in any single position.",
  },
  ai: {
    label: 'High Conviction AI',
    composition: '50% SMH · 30% QQQ · 20% ARKK',
    caption: 'Focused on companies expected to benefit from advances in artificial intelligence. This portfolio can deliver strong returns when the sector performs well, but many holdings move together, increasing risk during market downturns.',
    exposure: [
      { name: 'NVDA', value: 22.1 },
      { name: 'TSMC', value: 11.8 },
      { name: 'AVGO', value: 9.4 },
      { name: 'AMD', value: 6.2 },
      { name: 'MSFT', value: 5.1 },
      { name: 'TSLA', value: 4.9 },
      { name: 'Other', value: 40.5 },
    ],
    concentration: 59.5,
    riskNote: 'Top 6 holdings account for roughly 60% of this portfolio.',
    insight: 'Your portfolio is heavily exposed to the AI sector. Strong performance is possible, but returns may become highly correlated during market downturns.',
  },
};

const PIE_COLORS = ['#FACC15', '#F59E0B', '#FDBA74', '#FCD34D', '#EAB308', '#CA8A04', '#52525b'];

/**
 * @param {{ name: string, value: number }} holding
 * @param {number} i
 */
function getSliceColor(holding, i) {
  return holding.name === 'Other' ? PIE_COLORS[PIE_COLORS.length - 1] : PIE_COLORS[i];
}

/** @param {number} concentration */
function getConcentrationRisk(concentration) {
  if (concentration < 25) return { label: 'Low', color: '#34d399' };
  if (concentration < 45) return { label: 'Moderate', color: '#fbbf24' };
  return { label: 'High', color: '#fb7185' };
}

const AI_DRAWDOWN = [
  { ticker: 'NVDA', weight: 22.1, move: -25.0 },
  { ticker: 'TSMC', weight: 11.8, move: -18.0 },
  { ticker: 'AVGO', weight: 9.4, move: -16.0 },
  { ticker: 'AMD', weight: 6.2, move: -21.0 },
  { ticker: 'MSFT', weight: 5.1, move: -6.0 },
  { ticker: 'TSLA', weight: 4.9, move: -9.0 },
  { ticker: 'Other', weight: 40.5, move: -4.0 },
];

/** @param {{ ticker: string, weight: number, move: number }} holding */
function costOf(holding) {
  return (holding.weight * Math.abs(holding.move)) / 100;
}

const TOTAL_DRAWDOWN = AI_DRAWDOWN.reduce((sum, h) => sum + costOf(h), 0);

const WHY_ROWS = [
  {
    icon: Layers,
    before: 'Shows funds',
    afterTitle: 'Shows the underlying companies',
    afterBody:
      'Every ETF is flattened into its real holdings, so a portfolio of three funds can turn out to be one concentrated bet on two or three companies.',
  },
  {
    icon: Percent,
    before: 'Portfolio value only',
    afterTitle: 'A portfolio health score',
    afterBody:
      'Built from the same risk and return methodology professional analysts use, like Sharpe ratio and beta, calculated across everything you hold instead of just the number that moved today.',
  },
  {
    icon: Radio,
    before: 'Generic market news',
    afterTitle: 'News tied to your holdings',
    afterBody:
      'When something you own moves more than expected, we surface the story that likely caused it, instead of a generic market headline.',
  },
  {
    icon: Command,
    before: 'Static reports',
    afterTitle: 'Ask it directly',
    afterBody:
      "Ask a plain-English question about your risk or a specific holding and get an answer grounded in your actual portfolio, not a canned explainer.",
  },
];

const SHOWCASE = [
  {
    id: 'import',
    label: 'IMPORT PORTFOLIO',
    heading: 'Start with a single upload.',
    body: 'Submit a broker statement. We parse positions, quantities, and cost basis in seconds, no broker credentials required.',
    bullets: [
      'Automatic statement parsing',
      'Positions, quantities, cost basis',
      'Multiple brokers supported',
    ],
    src: '/screens/portfolio.png',
    alt: 'Portfolio import flow with broker statement upload',
  },
  {
    id: 'lookthrough',
    label: 'LOOK-THROUGH ANALYSIS',
    heading: 'Every ETF, flattened to the tickers underneath.',
    body: "Reveal the companies inside every ETF and understand your portfolio's true exposure.",
    bullets: [
      'ETFs decomposed into constituents',
      'True underlying weightings',
      'Sector-level concentration risk',
    ],
    src: '/screens/dashboard2.png',
    alt: 'Look-through exposure showing flattened ETF holdings',
  },
  {
    id: 'dashboard',
    label: 'PORTFOLIO DASHBOARD',
    heading: 'Track performance. Monitor health. See why it moved.',
    body: "See everything that matters in one place, from performance and portfolio health to the drivers behind today's returns.",
    bullets: ['Live market overview', 'Portfolio health score', 'Interactive portfolio insights'],
    src: '/screens/dashboard.png',
    alt: 'Portfolio dashboard with net worth, health score, and holdings table',
  },
  {
    id: 'analytics',
    label: 'PORTFOLIO ANALYTICS',
    heading: 'Institutional-grade indicators, on your book.',
    body: 'The same risk, return and financial-health metrics professional analysts use, like Sharpe ratio, beta and P/E, computed across your entire look-through portfolio.',
    bullets: [
      'Portfolio-level indicators',
      'Risk-adjusted return metrics',
      'Per-holding drill-down',
    ],
    src: '/screens/analytics.png',
    alt: 'Analytics page with financial indicators',
  },
  {
    id: 'news',
    label: 'NEWS CORRELATION',
    heading: 'When something moves, know exactly why.',
    body: 'Anomaly detection flags unusual moves in your holdings and links them to the news story that caused it, giving you direct and instant context',
    bullets: [
      'Anomaly detection on your holdings',
      'Direct news-to-price correlation',
      'Cross-referenced on the timeline',
    ],
    src: '/screens/news.png',
    alt: 'News feed correlated with portfolio anomalies',
  },
  {
    id: 'ai',
    label: 'AI PORTFOLIO ASSISTANT',
    heading: 'Ask questions. Get answers.',
    body: 'Ask about drawdown, sector concentration, or a specific holding. The assistant reads your look-through ledger and responds with real numbers.',
    bullets: [
      'powered by your own portfolio',
      'Explains financial concepts',
      'Your own intelligent assistant',
    ],
    src: '/screens/ai.png',
    alt: 'AI assistant answering a portfolio question',
  },
];

const useRevealVariant = () => {
  const reduce = useReducedMotion();
  /** @type {import('framer-motion').Transition} */
  const transition = { duration: 0.55, ease: EASE_SMOOTH };
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 32 },
    whileInView: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition,
  };
};

const Landing = () => (
  <>
    <Helmet>
      <title>Equity-Lens</title>
      <meta
        name="description"
        content="Flatten your ETFs into their true underlying holdings. Built for South African retail investors using investing and trading platforms."
      />
      <meta
        property="og:title"
        content="Institutional-grade portfolio intelligence for South African retail investors."
      />
      <meta
        property="og:description"
        content="Flatten your ETFs into their true underlying holdings."
      />
      <meta property="og:type" content="website" />
      <meta name="theme-color" content="#050505" />
    </Helmet>

    <div
      className="relative min-h-screen overflow-x-hidden bg-[var(--surface-base)] text-white"
      style={{ fontFamily: 'var(--font-primary)' }}>
      <Nav />
      <main id="main">
        <Hero />
        <MissionStrip />
        <Simulator />
        <FlatteningEngine />
        <SectionFade direction="toLight" />
        <LightBand>
          <WhyEquityLens />
        </LightBand>
        <SectionFade direction="toDark" />
        <Showcase />
        <SectionDivider />
        <TrustBar />
        <SectionDivider />
        <FinalCTA />
      </main>
      <Footer />
    </div>

    <style>{`
      a:focus-visible, button:focus-visible, [role="button"]:focus-visible {
        outline: 2px solid ${ACCENT};
        outline-offset: 2px;
        border-radius: 6px;
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
        }
      }
    `}</style>
  </>
);

const MicroGrid = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 z-0"
    style={{
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
      `,
      backgroundSize: '48px 48px',
      maskImage: 'radial-gradient(ellipse at center top, black 30%, transparent 80%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center top, black 30%, transparent 80%)',
    }}
  />
);

/** @param {{ direction?: 'toLight' | 'toDark' }} props */
const SectionFade = ({ direction = 'toLight' }) => (
  <div
    aria-hidden="true"
    className="relative z-10 h-40 sm:h-56"
    style={{
      background:
        direction === 'toLight'
          ? 'linear-gradient(to bottom, #050505, #fafafa)'
          : 'linear-gradient(to bottom, #fafafa, #050505)',
    }}
  />
);

/** @param {{ children: any }} props */
const LightBand = ({ children }) => (
  <div className="relative z-10 bg-[#fafafa]">{children}</div>
);

const SectionDivider = () => (
  <div aria-hidden="true" className="relative z-10 border-t border-white/10" />
);

const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      aria-label="Primary"
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/10 bg-black/80 backdrop-blur-xl'
          : 'bg-black/40 backdrop-blur-md'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--accent-primary)] focus:px-3 focus:py-1.5 focus:text-[13px] focus:font-semibold focus:text-[var(--text-on-accent)]"
      >
        Skip to content
      </a>

      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to={ROUTES.HOME} className="flex items-center gap-3" aria-label="Equity-Lens home">
          <Logo />
          <span className="text-[16px] font-semibold tracking-tight text-white">Equity-Lens</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <NavLink label="Features" href="#features" />
          <NavLink label="How it works" href="#simulator" />
          <NavLink label="Why it matters" href="#flatten" />
          <NavLink label="Help Centre" to={ROUTES.HELP} />
          <Link
            to={ROUTES.LOGIN}
            className="ml-2 rounded-lg px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-white/5"
          >
            Log in
          </Link>
          <Link to={ROUTES.REGISTER} className="ml-1">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
              style={{ boxShadow: `0 4px 16px ${ACCENT}40` }}
            >
              Sign up
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-white md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="mobile-nav"
          className="border-t border-white/10 bg-black/95 backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            <NavLink label="How it works" href="#simulator" onClick={() => setMobileOpen(false)} />
            <NavLink label="Features" href="#features" onClick={() => setMobileOpen(false)} />
            <NavLink label="Why it matters" href="#flatten" onClick={() => setMobileOpen(false)} />
            <NavLink label="Help Centre" to={ROUTES.HELP} onClick={() => setMobileOpen(false)} />
            <Link
              to={ROUTES.LOGIN}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-white/5"
            >
              Sign in
            </Link>
            <Link
              to={ROUTES.REGISTER}
              onClick={() => setMobileOpen(false)}
              className="mt-1 rounded-lg bg-[var(--accent-primary)] px-3 py-2.5 text-center text-[15px] font-semibold text-[var(--text-on-accent)]"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

/** @param {{ label: string, href?: string, to?: string, onClick?: () => void }} props */
const NavLink = ({ label, href, to, onClick }) => {
  const cls =
    'px-3 py-2 text-[14px] font-medium text-zinc-200 hover:text-white hover:bg-white/5 rounded-lg transition-colors';
  if (to)
    return (
      <Link to={to} className={cls} onClick={onClick}>
        {label}
      </Link>
    );
  return (
    <a href={href} className={cls} onClick={onClick}>
      {label}
    </a>
  );
};

const Logo = () => (
  <img
    src="/logo.png"
    alt=""
    aria-hidden="true"
    className="h-10 w-10 rounded-lg object-contain"
  />
);

const Hero = () => (
    <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
    <div className="max-w-3xl">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mb-5 text-[clamp(36px,5.5vw,72px)] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:mb-6"
        >
          See past the surface
          <br />
          of your portfolio.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-8 max-w-lg text-[15px] leading-relaxed text-zinc-200 sm:mb-9 sm:text-[17px]"
        >
          Upload your portfolio and gain complete visibility into your exposure, risk, and performance.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="flex flex-wrap gap-3"
        >
          <Link to={ROUTES.REGISTER}>
            <YellowButton>Analyse my portfolio</YellowButton>
          </Link>
          <a
            href="#simulator"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-white/5"
          >
            See how it works
          </a>
        </motion.div>
      </div>
    </div>
  </section>
);

const brokerCell = 'p-4 sm:p-5 flex items-center gap-3';
const lensCellRich = 'p-4 sm:p-5 border-l border-zinc-200 bg-[var(--accent-subtle)] flex items-start gap-3';
const text1 = 'text-[13px] sm:text-[16px] text-zinc-500';
const text2 = 'text-[13px] sm:text-[16px] text-zinc-900 font-medium';
const cross = <X size={15} className="shrink-0 text-zinc-400" aria-hidden="true" />;

const WhyEquityLens = () => {
  const reveal = useRevealVariant();
  return (
    <section
      id="features"
      aria-labelledby="why-heading"
      className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24"
    >
      <motion.div {...reveal} className="mb-10 max-w-2xl sm:mb-12">
        <p className="mb-3 font-mono text-[11px] tracking-widest text-zinc-500">WHY EQUITY-LENS</p>
        <h2
          id="why-heading"
          className="text-[clamp(28px,4vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-900"
        >
          From fund labels
          <br />
          <span className="text-[var(--accent-hover)]">to true exposure.</span>
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-600">
          Traditional brokerages stop at the fund level. Here&apos;s what changes once Equity-Lens
          flattens that view down to what you actually own.
        </p>
      </motion.div>

      <motion.div
        {...reveal}
        transition={{ ...reveal.transition, delay: 0.1 }}
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
      >
        <div className="grid grid-cols-2 border-b border-zinc-200">
          <div className="p-4 sm:p-5">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-zinc-500">
              TRADITIONAL BROKERAGE
            </p>
            <p className="text-[14px] font-semibold text-zinc-700 sm:text-[15px]">
              What you see today
            </p>
          </div>
          <div className="border-l border-zinc-200 bg-[var(--accent-subtle)] p-4 sm:p-5">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-[var(--accent-hover)]">
              EQUITY-LENS
            </p>
            <p className="text-[14px] font-semibold text-zinc-900 sm:text-[15px]">
              What you get instead
            </p>
          </div>
        </div>

        {WHY_ROWS.map((row, i) => (
          <div
            key={row.before}
            className={`grid grid-cols-2 ${i < WHY_ROWS.length - 1 ? 'border-b border-zinc-100' : ''}`}
          >
            <div className={brokerCell}>
              {cross}
              <span className={text1}>{row.before}</span>
            </div>
            <div className={lensCellRich}>
              <row.icon size={18} className="mt-0.5 shrink-0 text-[var(--accent-hover)]" aria-hidden="true" />
              <div>
                <p className={text2}>{row.afterTitle}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600 sm:text-[13px]">
                  {row.afterBody}
                </p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  );
};

const MissionStrip = () => {
  const REVEAL = useRevealVariant();

  return (
    <section
      aria-labelledby="mission-heading"
      className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10"
    >
      <motion.div
        {...REVEAL}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent px-8 py-14 backdrop-blur-2xl sm:px-14 sm:py-16"
      >
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-[var(--accent-primary)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-[var(--signal-positive)]/5 blur-3xl" />

        <div className="relative max-w-4xl">
          <div className="mb-6 flex items-center gap-4">
            <p
              id="mission-heading"
              className="font-mono text-[14px] uppercase tracking-[0.60em] text-[var(--accent-primary)]"
            >
              Our Mission
            </p>
          </div>

          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Every South African investor deserves{' '}
            <span className="text-[var(--accent-primary)]">institutional-grade portfolio intelligence.</span>
          </h2>

          <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-300 sm:text-lg">
            Traditional brokerages stop at the fund level. Equity Lens reveals the companies,
            concentration risk and portfolio insights hidden beneath your investments, giving you
            the same clarity traditionally reserved for institutional investment desks.
          </p>
        </div>
      </motion.div>
    </section>
  );
};

const Simulator = () => {
  const REVEAL = useRevealVariant();
  const [selectedPreset, setSelectedPreset] = useState('diversified');
 const portfolio = PRESETS[/** @type {keyof typeof PRESETS} */ (selectedPreset)];
  const concentrationRisk = getConcentrationRisk(portfolio.concentration);

  return (
    <section
      id="simulator"
      className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24"
      aria-labelledby="simulator-heading"
    >
      <motion.div {...REVEAL} className="max-w-2xl mb-10 sm:mb-12">
        <p className="text-[11px] font-mono tracking-widest text-zinc-300 mb-3">
          HOW IT WORKS
        </p>
        <h2
          id="simulator-heading"
          className="text-[clamp(28px,4vw,52px)] font-semibold tracking-[-0.03em] leading-[1.05] text-white"
        >
          Pick a portfolio.<br />
          See what you actually own.
        </h2>
      </motion.div>

      <motion.div
        {...REVEAL}
        transition={{ ...REVEAL.transition, delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        <PresetSelector selectedPreset={selectedPreset} onSelect={setSelectedPreset} />

        <div className="lg:col-span-7 min-h-[620px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8">
          <p className="text-[10px] font-mono tracking-widest text-zinc-300 mb-1">
            LOOKED-THROUGH EXPOSURE
          </p>
          <p className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-white mb-6">
            Your true holdings
          </p>

          <ConcentrationSummary portfolio={portfolio} concentrationRisk={concentrationRisk} />

          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start mb-6">
            <ExposureChart holdings={portfolio.exposure} />
            <HoldingsBreakdown holdings={portfolio.exposure} />
          </div>

          <InsightCard text={portfolio.insight} presetKey={selectedPreset} />
        </div>
      </motion.div>
    </section>
  );
};

/** @param {{ text: string, presetKey: string }} props */
const InsightCard = ({ text, presetKey }) => (
  <motion.div
    key={presetKey}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="min-h-[96px] rounded-xl border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/[0.04] px-4 py-3.5 flex items-start gap-3"
  >
    <p className="text-[15px] text-zinc-200 leading-relaxed">{text}</p>
  </motion.div>
);

/** @param {{ holdings: any[] }} props */
const HoldingsBreakdown = ({ holdings }) => (
  <div>
    <p className="text-[14px] font-mono tracking-widest text-zinc-300 mb-3">
      LARGEST UNDERLYING HOLDINGS
    </p>
    <div className="flex flex-col gap-2.5">
      {holdings.map((holding, i) => (
        <div key={holding.name} className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-zinc-500 w-3 shrink-0">{i + 1}</span>
          <span className="font-mono text-sm font-bold text-white w-20 shrink-0 truncate">{holding.name}</span>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden flex-1">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${holding.value}%`, background: getSliceColor(holding, i) }}
            />
          </div>
          <span className="font-mono text-sm text-zinc-300 w-10 text-right shrink-0">{holding.value}%</span>
        </div>
      ))}
    </div>
  </div>
);

/** @param {{ holdings: any[] }} props */
const ExposureChart = ({ holdings }) => (
  <div className="relative mx-auto h-52 w-52">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={holdings}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={68}
          outerRadius={90}
          paddingAngle={2}
          animationDuration={500}
          animationEasing="ease-out"
          isAnimationActive
        >
          {holdings.map((holding, i) => (
            <Cell
              key={i}
              fill={getSliceColor(holding, i)}
              stroke="rgba(0,0,0,0.65)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<PieHoverTip />} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

/** @param {{ portfolio: any, concentrationRisk: { label: string, color: string } }} props */
const ConcentrationSummary = ({ portfolio, concentrationRisk }) => (
  <div className="mb-8">
    <div className="text-[12px] font-mono tracking-widest text-zinc-300 mb-2">
      PORTFOLIO CONCENTRATION
    </div>
    <div className="flex items-baseline gap-3">
      <motion.span
        animate={{ color: concentrationRisk.color }}
        transition={{ duration: 0.3 }}
        className="font-mono text-4xl sm:text-5xl font-bold tracking-tight"
      >
        {portfolio.concentration}%
      </motion.span>
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition-colors duration-300"
        style={{
          color: concentrationRisk.color,
          background: `${concentrationRisk.color}1a`,
          border: `1px solid ${concentrationRisk.color}40`,
        }}
      >
        {concentrationRisk.label}
      </span>
    </div>
    <p className="min-h-[42px] text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-md">
      {portfolio.riskNote}
    </p>
  </div>
);


/** @param {{ selectedPreset: string, onSelect: (key: string) => void }} props */
const PresetSelector = ({ selectedPreset, onSelect }) => {
  const [expanded, setExpanded] = useState(false);

  return (
  <div className="lg:col-span-5 min-h-[560px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-7">
      <p className="text-[10px] font-mono tracking-widest text-zinc-300 mb-2">WHY IT MATTERS</p>
      <p className={`text-[16px] text-zinc-200 leading-relaxed`}>
        Most investors think they&apos;re diversified because they own multiple ETFs. In reality, those funds often contain the same underlying companies. Traditional brokerages stop at the fund level, hiding your true exposure and making portfolio risk difficult to understand.
      </p>
      <p className="text-[12px] font-mono tracking-widest text-zinc-300 mt-8 mb-3">
        EXPLORE EXAMPLE PORTFOLIOS
      </p>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Portfolio allocation">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <PresetButton
            key={key}
            active={selectedPreset === key}
            onClick={() => onSelect(key)}
            preset={preset}
          />
        ))}
      </div>
    </div>
  );
};

/** @param {{ active?: boolean, payload?: any[] }} props */
const PieHoverTip = ({ active, payload }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const data = payload[0];
  const colour = data.payload.fill ?? data.color;

  return (
    <div className="rounded-lg border border-white/15 bg-black/90 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-2 font-mono text-[12px] text-white">
        <span
          className="h-2 w-2 rounded-sm"
          style={{ backgroundColor: colour }}
          aria-hidden="true"
        />
        <span className="font-semibold">{data.payload.name}</span>
        <span className="ml-auto text-[var(--accent-primary)]">
          {data.value}%
        </span>
      </div>
    </div>
  );
};

/** @param {{ active: boolean, onClick: () => void, preset?: any }} props */
const PresetButton = ({ active, onClick, preset }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={`text-left p-4 rounded-xl transition-colors border ${
      active
        ? 'border-[var(--accent-primary)]/80 bg-[var(--accent-primary)]/[0.03]'
        : 'border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-white/20'
    }`}
  >
    <div className="flex items-center justify-between mb-1">
      <span className={`text-[14px] font-semibold ${active ? 'text-[var(--accent-primary)]' : 'text-white'}`}>
        {preset.label}
      </span>
      {active && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
        />
      )}
    </div>
    <div className="font-mono text-[11px] text-zinc-400">{preset.composition}</div>
    {active && (
       <div className="min-h-[110px] text-xs sm:text-sm text-zinc-300 leading-relaxed mt-1.5">
        {preset.caption}
      </div>
    )}
  </button>
);

const Showcase = () => {
  const REVEAL = useRevealVariant();
  return (
  <section className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <motion.div {...REVEAL} className="mb-16 max-w-2xl sm:mb-24">
        <p className="mb-3 font-mono text-[11px] tracking-widest text-zinc-300">
          PRODUCT WALKTHROUGH
        </p>
        <h2
          id="showcase-heading"
          className="text-[clamp(28px,4vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-white"
        >
          From portfolio
          <br />
          to institutional insight.
        </h2>
      </motion.div>

      <div className="flex flex-col gap-24 sm:gap-36">
        {SHOWCASE.map((row, i) => (
          <ShowcaseRow key={row.id} row={row} flipped={i % 2 !== 0}/>
        ))}
      </div>
    </section>
  );
}

/** @param {{ row: { label: string, heading: string, body: string, bullets: string[], src: string, alt: string }, flipped: boolean }} props */
const ShowcaseRow = ({ row, flipped }) => {
  const fadeInProps = useRevealVariant();
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <motion.div
        {...fadeInProps}
        className={`flex flex-col justify-center ${flipped ? 'lg:order-last' : ''}`}
      >
        <span className="font-mono text-xs font-semibold tracking-widest text-[var(--accent-primary)] uppercase">{row.label}</span>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">{row.heading}</h3>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-400 sm:text-base">{row.body}</p>
        
        <ul className="mt-6 space-y-3">
          {row.bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-3">
              <span 
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(255,107,0,0.6)]"
                aria-hidden="true"
              />
              <span className="text-sm text-zinc-300">{bullet}</span>
            </li>
          ))}
        </ul>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <ShowcaseFrame src={row.src} alt={row.alt} />
      </motion.div>
    </div>
  );
};

/** @param {{ src: string, alt: string }} props */
const ShowcaseFrame = ({ src, alt }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <div className="group relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 rounded-3xl bg-[radial-gradient(circle_at_50%_50%,rgba(250,204,21,0.12),transparent_65%)] opacity-60 blur-3xl transition-opacity duration-300 group-hover:opacity-80"
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-zinc-900/60">
          
          {hasError ? (
            <div className="flex flex-col items-center gap-2">
            </div>
          ) : (
            <>
              <img
                src={src}
                alt={alt}
                loading="lazy"
                className="h-full w-full object-cover object-top"
                onError={() => {
                  console.warn('showcase image missing:', src);
                  setHasError(true);
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.4)_100%)]"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TrustBar = () => {
  const REVEAL = useRevealVariant();

  return (
    <section
      aria-labelledby="security-heading"
      className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
    >
      <motion.div {...REVEAL} className="max-w-2xl">
        <h2
          id="security-heading"
          className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Your data stays yours.
        </h2>

        <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">
          Equity-Lens reads your holdings to analyse them and never touches your broker account. Statement uploads and portfolio data are encrypted and handled in line with the POPI Act.
        </p>
      </motion.div>

      <motion.div
        {...REVEAL}
        transition={{ ...REVEAL.transition, delay: 0.1 }}
        className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[var(--accent-primary)]/20 bg-gradient-to-br from-[var(--accent-primary)]/[0.03] to-transparent p-6 backdrop-blur-xl lg:col-span-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/[0.08] text-[var(--accent-primary)]">
            <KeyRound size={18} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-white">
            Read-only. No broker credentials.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            We never ask for your personal brokerage platform login information. Portfolio data comes in through user entry, so no trading permissions are requested and no orders can be placed on your behalf.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300">
            <Lock size={18} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-white">
            Encrypted in transit and at rest
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 sm:text-sm">
            Uploads travel over TLS and are stored with AES-256 encryption. Statements are deleted once the holdings have been parsed out of them.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:col-span-1 lg:col-span-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300">
            <EyeOff size={18} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-white">Private to your account</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 sm:text-sm">
            Your holdings are scoped to your account and visible to no other user. We don&apos;t sell your data or share it with advertisers.
          </p>
        </div>
      </motion.div>
    </section>
  );
};

const FlatteningEngine = () => {
  const REVEAL = useRevealVariant();
  return (
    <section
      id="flatten"
      aria-labelledby="flatten-heading"
      className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-32">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
        <motion.div {...REVEAL} className="lg:col-span-5">
          <h2
            id="flatten-heading"
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One market event can hit your whole portfolio.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-zinc-400">
            The AI portfolio above holds three different ETFs, which sounds diversified. But SMH,
            QQQ and ARKK own many of the same companies, so if AI stocks fall, many of your
            largest holdings fall at the same time with a loss much larger than the headline
            weighting suggests.
          </p>
          <div className="mt-8 rounded-xl border border-[var(--signal-negative)]/10 bg-[var(--signal-negative)]/[0.15] p-6">
            <span className="block font-mono text-xs font-medium uppercase tracking-wider text-zinc-500">
              Estimated portfolio loss
            </span>
            <div className="mt-1 font-mono text-4xl font-bold tracking-tight text-[var(--signal-negative)] sm:text-5xl">
              -{TOTAL_DRAWDOWN.toFixed(1)}%
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-400">
              <li>NVIDIA alone causes {' '}
                <span className="font-semibold text-white">43%</span>.</li>
              <li>
                Other AI companies in the same ETFs cause another{' '}
                <span className="font-semibold text-white">44%</span>.
              </li>
              <li className="text-zinc">You would not see this by looking at the three funds on their own.</li>
            </ul>
          </div>
        </motion.div>
        <motion.div
          {...REVEAL}
          transition={{ ...REVEAL.transition, delay: 0.1 }}
          className="lg:col-span-7">
          <DrawdownLedger />
        </motion.div>
      </div>
    </section>
  );
};

const DrawdownLedger = () => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
    <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4">
      <span className="font-mono text-xs font-semibold tracking-wider text-zinc-300 uppercase">
        IF NVIDIA FALLS 25%, AI STOCKS FALL WITH IT
      </span>
    </div>

    <div className="divide-y divide-white/5 px-6 font-mono text-xs">
      <div className="grid grid-cols-4 py-3 font-medium uppercase tracking-wider text-zinc-500">
        <div>Company</div>
        <div className="text-right">Price change</div>
        <div className="text-right">Effect on you</div>
        <div className="text-right">Share of loss</div>
      </div>

      {AI_DRAWDOWN.map((holding) => (
        <LedgerRow key={holding.ticker} holding={holding} />
      ))}
    </div>
  </div>
);

/** @param {{ holding: { ticker: string, weight: number, move: number } }} props */
const LedgerRow = ({ holding }) => {
  const cost = costOf(holding);
  const shareOfLoss = Math.round((cost / TOTAL_DRAWDOWN) * 100);
  const isAnchor = holding.ticker === 'NVDA';

  return (
    <div
      className={`grid grid-cols-4 items-center py-3.5 transition-colors hover:bg-white/[0.02] ${
        isAnchor ? 'bg-[var(--signal-negative)]/[0.02] font-semibold' : ''}`}>
      <div className={isAnchor ? 'text-[var(--signal-negative)]' : 'text-white'}>{holding.ticker}</div>
      <div className="text-right text-zinc-400">{holding.move}%</div>
      <div className={`text-right font-bold ${isAnchor ? 'text-[var(--signal-negative)]' : 'text-zinc-200'}`}>-{cost.toFixed(1)}%
      </div>
      <div className="text-right text-zinc-500">{shareOfLoss}%</div>
    </div>
  );
};

const FinalCTA = () => {
  const reveal = useRevealVariant();

  return (
    <section className="relative z-10 mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-32">
      <motion.h2
        {...reveal}
        className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-6xl"
      >
        Ready to understand
        <br />
        your portfolio?
      </motion.h2>
      
      <motion.p
        {...reveal}
        transition={{ ...reveal.transition, delay: 0.1 }}
        className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg"
      >
        Upload your broker statement to understand the ecosystem that makes your portfolio.
      </motion.p>
      
      <motion.div 
        {...reveal} 
        transition={{ ...reveal.transition, delay: 0.2 }}
      >
        <Link to={ROUTES.REGISTER} className="group inline-block">
          <YellowButton large>Analyse my portfolio</YellowButton>
        </Link>
      </motion.div>
    </section>
  );
};

const Footer = () => {
  const [copied, setCopied] = useState(false);
  /** @param {import('react').MouseEvent} e */
  const handleContactClick = async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${CONTACT_EMAIL}`;
    }
  };

  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-[1.5fr_1fr_1fr]">

          <div>
            <div className="mb-3 flex items-center gap-3">
              <Logo />
              <span className="text-base font-semibold text-white">Equity-Lens</span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-zinc-400">
              A COS 301 capstone project. Built by The Big Five (TB5) at the University of Pretoria in
              partnership with AWS.
            </p>
          </div>

          <div>
            <p className="mb-3 font-mono text-xs font-medium tracking-widest text-zinc-500 uppercase">
              Product
            </p>
            <div className="flex flex-col gap-2">
              <a href="#features" className="text-sm text-zinc-400 transition-colors hover:text-white">
                Features
              </a>
              <a href="#simulator" className="text-sm text-zinc-400 transition-colors hover:text-white">
                Try the simulator
              </a>
              <a href="#flatten" className="text-sm text-zinc-400 transition-colors hover:text-white">
                Why it matters
              </a>
            </div>
          </div>

          <div>
            <p className="mb-3 font-mono text-xs font-medium tracking-widest text-zinc-500 uppercase">
              Resources
            </p>
            <div className="flex flex-col gap-2">
              <Link to={ROUTES.HELP} className="text-sm text-zinc-400 transition-colors hover:text-white">
                Help Centre
              </Link>
              <a
                href="https://github.com/COS301-SE-2026/Equity-Lens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
              >
                GitHub
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                onClick={handleContactClick}
                className="text-sm text-zinc-400 transition-colors hover:text-white" >
                {copied ? 'Email copied' : 'Contact'}
              </a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

/** @param {{ children: any, large?: boolean }} props */
const YellowButton = ({ children, large }) => {
  const sizeClasses = large ? 'px-7 py-3.5 text-base' : 'px-6 py-3 text-sm';
  
  return (
    <motion.span
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={`inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] font-semibold text-[var(--text-on-accent)] shadow-[0_8px_24px_rgba(255,107,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] ${sizeClasses}`}
    >
      {children}
    </motion.span>
  );
};

export default Landing;