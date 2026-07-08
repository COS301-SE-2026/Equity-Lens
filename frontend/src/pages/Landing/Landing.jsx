import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
  TrendingUp,
  Menu,
  X,
  Check,
  Shield,
  Lock,
  EyeOff,
  Command,
  FileInput,
  Percent,
  Radio,
  ShieldCheck,
  Layers,
  Github,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
} from 'recharts';
import { ROUTES } from '../../utils/constants';

const YELLOW = '#FACC15';
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
  if (concentration < 25) return { label: 'Low', color: '#22c55e' };
  if (concentration < 45) return { label: 'Moderate', color: '#f59e0b' };
  return { label: 'High', color: '#ef4444' };
}

const NVDA_OVERLAP = [
  { etf: 'VOO', pct: 6.2, hint: 'VOO gives NVDA 6.2% weighting inside the S&P 500 basket.' },
  { etf: 'QQQ', pct: 8.9, hint: 'QQQ leans tech-heavy and gives NVDA 8.9%.' },
  { etf: 'SMH', pct: 21.4, hint: 'SMH is a semis fund. NVDA sits at 21.4% of it.' },
];

const NVDA_FLATTENED = 12.4;

const HERO_PERF = Array.from({ length: 30 }, (_, i) => ({
  d: i,
  v: 100 + i * 0.42 + Math.sin(i / 3) * 2.1,
}));

const FEATURES = [
  {
    icon: Command,
    title: 'Natural language risk interrogation',
    body: 'Ask plain-English questions directly against your look-through ledger. Uncover macro vulnerabilities, isolate benchmark anomalies, and simulate allocation shifts instantly.',
    isSpotlight: true,
  },
  {
    icon: FileInput,
    title: 'Broker statement import',
    body: 'Upload your portfolio. Positions, quantities, and cost basis parsed in seconds.',
  },
  {
    icon: Layers,
    title: 'Look-through exposure',
    body: 'Every ETF is flattened into its underlying holdings so you see real concentration, not fund labels.',
  },
  {
    icon: Percent,
    title: 'Portfolio Health',
    body: 'Weighted Sharpe, Beta, CAPM, Altman Z, P/E, ROE, and dividend yield across your entire book.',
  },
  {
    icon: Radio,
    title: 'News correlation',
    body: 'When a holding moves more than expected, we pull the news story that caused it.',
  },
];

const TRUST_ITEMS = [
  { icon: ShieldCheck, text: 'Read-only portfolio analysis' },
  { icon: Lock, text: 'End-to-end encrypted uploads' },
  { icon: Shield, text: 'No trading permissions required' },
  { icon: EyeOff, text: 'Securely stored data' },
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
    src: '/screens/dashboard.png',
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
    body: 'Weighted Sharpe, Beta, CAPM, Altman Z, P/E, ROE, and dividend yield computed across your look-through holdings.',
    bullets: [
      'Portfolio-level indicators',
      'Risk-adjusted return metrics',
      'Per-holding drill-down',
    ],
    src: '/screens/portfolio.png',
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
    src: '/screens/ai.png',
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
      <title>Institutional-grade portfolio intelligence for South African retail investors.</title>
      <meta
        name="description"
        content="Flatten your ETFs into their true underlying holdings. Built for South African retail investors on EasyEquities and similar platforms."
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
      className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white"
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <MicroGrid />
      <Nav />
      <main id="main">
        <Hero />
        <MissionStrip />
        <Features />
        <Simulator />
        <Comparison />
        <Showcase />
        <FlatteningEngine />
        <TrustBar />
        <FinalCTA />
      </main>
      <Footer />
    </div>

    <style>{`
      a:focus-visible, button:focus-visible, [role="button"]:focus-visible {
        outline: 2px solid ${YELLOW};
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-yellow-400 focus:px-3 focus:py-1.5 focus:text-[13px] focus:font-semibold focus:text-black"
      >
        Skip to content
      </a>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-[14px] font-semibold text-black transition-colors hover:bg-yellow-300"
              style={{ boxShadow: `0 4px 16px ${YELLOW}40` }}
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
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
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
              className="mt-1 rounded-lg bg-yellow-400 px-3 py-2.5 text-center text-[15px] font-semibold text-black"
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
  <div
    aria-hidden="true"
    className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[14px] font-black text-black"
    style={{
      background: YELLOW,
      boxShadow: `0 4px 16px ${YELLOW}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
    }}
  >
    //logo goes here when we have one
  </div>
);

const Hero = () => (
  <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <div>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 font-mono text-[11px] uppercase tracking-widest text-zinc-300 sm:mb-6"
        >
          Institutional-grade portfolio intelligence for South African retail investors.
        </motion.p>

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
          Upload your portfolio and uncover hidden concentration, true ETF exposure, portfolio
          health and the market events driving your returns.
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

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <HeroMockup />
      </motion.div>
    </div>
  </section>
);

const HeroMockup = () => (
  <div
    role="img"
    aria-label="Dashboard preview showing net worth, portfolio metrics, and top holdings"
    className="relative"
  >
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
      style={{ boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6)' }}
    >
      <div className="p-4 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 font-mono text-[10px] tracking-widest text-zinc-300">
              NET WORTH
            </div>
            <div className="font-mono text-[22px] font-semibold tracking-tight text-white sm:text-[28px]">
              R 847,231<span className="text-zinc-400">.04</span>
            </div>
            <div
              className="mt-1 flex items-center gap-1 font-mono text-[12px]"
              style={{ color: '#22c55e' }}
            >
              <TrendingUp size={11} aria-hidden="true" />
              +R 12,405 (+1.49%) today
            </div>
          </div>
          <div className="h-12 w-28 shrink-0 sm:h-14 sm:w-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HERO_PERF}>
                <YAxis hide domain={['auto', 'auto']} />
                <Line type="monotone" dataKey="v" stroke={YELLOW} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          {[
            { l: 'SHARPE', v: '1.42' },
            { l: 'BETA', v: '0.87' },
            { l: 'ALPHA', v: '+2.1%' },
          ].map((m) => (
            <div key={m.l} className="rounded-lg border border-white/10 bg-black/40 p-2.5">
              <div className="mb-0.5 font-mono text-[9px] text-zinc-300">{m.l}</div>
              <div className="font-mono text-[14px] font-semibold text-white">{m.v}</div>
            </div>
          ))}
        </div>

        <div className="mb-2 font-mono text-[10px] tracking-widest text-zinc-300">
          LOOKED-THROUGH HOLDINGS
        </div>
        {[
          { sym: 'NVDA', name: 'NVIDIA', pct: 8.4, chg: 2.14 },
          { sym: 'MSFT', name: 'Microsoft', pct: 7.1, chg: 0.87 },
          { sym: 'TSMC', name: 'Taiwan Semi', pct: 5.9, chg: 3.02 },
          { sym: 'AAPL', name: 'Apple', pct: 5.2, chg: -0.41 },
        ].map((h) => (
          <div
            key={h.sym}
            className="grid grid-cols-[50px_1fr_50px_55px] items-center gap-2 rounded-md px-2 py-2 font-mono text-[11px] text-white sm:gap-3"
          >
            <span className="font-bold">{h.sym}</span>
            <span className="truncate text-zinc-300">{h.name}</span>
            <span className="text-right">{h.pct}%</span>
            <span className="text-right" style={{ color: h.chg >= 0 ? '#22c55e' : '#ef4444' }}>
              {h.chg >= 0 ? '+' : ''}
              {h.chg}%
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const lensCell = 'p-4 sm:p-5 border-l border-white/10 flex items-center gap-3';
const brokerCell = 'p-4 sm:p-5 flex items-center gap-3';
const lensBG = { background: 'rgba(255,192,0,0.65)' };
const text1 = 'text-[13px] sm:text-[16px] text-zinc-400';
const text2 = 'text-[13px] sm:text-[16px] text-white font-medium';
const tick = <Check size={15} className="shrink-0 text-yellow-400" aria-hidden="true" />;
const cross = <X size={15} className="shrink-0 text-zinc-500" aria-hidden="true" />;

const Comparison = () => {
  const reveal = useRevealVariant();
  return (
    <section
      aria-labelledby="compare-heading"
      className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24"
    >
      <motion.div {...reveal} className="mb-10 max-w-2xl sm:mb-12">
        <p className="mb-3 font-mono text-[11px] tracking-widest text-zinc-300">WHY EQUITY-LENS</p>
        <h2
          id="compare-heading"
          className="text-[clamp(28px,4vw,52px)] font-semibold leading-[1.05] tracking-[-0.03em] text-white"
        >
          From fund labels
          <br />
          <span className="text-yellow-400">to true exposure.</span>
        </h2>
      </motion.div>

      <motion.div
        {...reveal}
        transition={{ ...reveal.transition, delay: 0.1 }}
        className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
      >
        <div className="grid grid-cols-2 border-b border-white/10">
          <div className="p-4 sm:p-5">
            <p className="mb-1 font-mono text-[10px] tracking-widest text-zinc-400">
              TRADITIONAL BROKERAGE
            </p>
            <p className="text-[14px] font-semibold text-zinc-300 sm:text-[15px]">
              What you see today
            </p>
          </div>
          <div className="border-l border-white/10 p-4 sm:p-5" style={lensBG}>
            <p className="mb-1 font-mono text-[10px] tracking-widest text-yellow-400">
              EQUITY-LENS
            </p>
            <p className="text-[14px] font-semibold text-white sm:text-[15px]">
              What you get instead
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-white/5">
          <div className={brokerCell}>
            {cross}
            <span className={text1}>Shows funds</span>
          </div>
          <div className={lensCell} style={lensBG}>
            {tick}
            <span className={text2}>Shows underlying companies</span>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-white/5">
          <div className={brokerCell}>
            {cross}
            <span className={text1}>Portfolio value</span>
          </div>
          <div className={lensCell} style={lensBG}>
            {tick}
            <span className={text2}>Portfolio health</span>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-white/5">
          <div className={brokerCell}>
            {cross}
            <span className={text1}>Generic market news</span>
          </div>
          <div className={lensCell} style={lensBG}>
            {tick}
            <span className={text2}>News linked to your holdings</span>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-white/5">
          <div className={brokerCell}>
            {cross}
            <span className={text1}>Manual interpretation</span>
          </div>
          <div className={lensCell} style={lensBG}>
            {tick}
            <span className={text2}>Actionable portfolio insights</span>
          </div>
        </div>

        <div className="grid grid-cols-2">
          <div className={brokerCell}>
            {cross}
            <span className={text1}>Basic allocation</span>
          </div>
          <div className={lensCell} style={lensBG}>
            {tick}
            <span className={text2}>Look-through exposure</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

const MissionStrip = () => {
  const REVEAL = useRevealVariant();

  return (
    <section
      aria-labelledby="mission-heading"
      className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8 lg:px-10"
    >
      <motion.div
        {...REVEAL}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent px-8 py-14 backdrop-blur-2xl sm:px-14 sm:py-16"
      >
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-emerald-400/5 blur-3xl" />

        <div className="relative max-w-4xl">
          <div className="mb-6 flex items-center gap-4">
            <p
              id="mission-heading"
              className="font-mono text-[14px] uppercase tracking-[0.60em] text-yellow-400"
            >
              Our Mission
            </p>
          </div>

          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Every South African investor deserves{' '}
            <span className="text-yellow-400">institutional-grade portfolio intelligence.</span>
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

const Features = () => {
  const REVEAL = useRevealVariant();

  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="relative z-10 mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24"
    >
      <motion.div {...REVEAL} className="mb-12 max-w-2xl">
        <p className="mb-3 font-mono text-xs tracking-widest text-zinc-300">FEATURES</p>

        <h2
          id="features-heading"
          className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl"
        >
          Multiple features. 
          One clearer portfolio.
        </h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature, index) => {
          const spotlight = feature.isSpotlight;

          return (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.4,
                delay: index * 0.06,
              }}
              className={[
                'flex flex-col rounded-2xl border p-6 backdrop-blur-xl transition-colors',
                spotlight
                  ? 'border-yellow-400/30 bg-yellow-400/5 hover:border-yellow-400/50 sm:col-span-2'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
              ].join(' ')}
            >
              <div
                className={[
                  'mb-4 flex items-center justify-center rounded-xl border border-yellow-400/25 bg-yellow-400/10',
                  spotlight ? 'h-12 w-12' : 'h-10 w-10',
                ].join(' ')}
              >
                <feature.icon size={spotlight ? 22 : 18} className="text-yellow-400" />
              </div>

              <h3
                className={[
                  'mb-2 font-semibold tracking-tight text-white',
                  spotlight ? 'text-xl sm:text-2xl' : 'text-base',
                ].join(' ')}
              >
                {feature.title}
              </h3>

              <p
                className={[
                  'leading-relaxed text-zinc-200',
                  spotlight ? 'text-sm sm:text-base' : 'text-sm',
                ].join(' ')}
              >
                {feature.body}
              </p>
            </motion.article>
          );
        })}
      </div>
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
      className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24"
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

        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8">
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

/** @param {{ text?: string, presetKey?: string }} props */
const InsightCard = ({ text, presetKey }) => (
  <motion.div
    key={presetKey}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className="rounded-xl border border-yellow-400/25 bg-yellow-400/[0.04] px-4 py-3.5 flex items-start gap-3"
  >
    <p className="text-[13px] text-zinc-200 leading-relaxed">{text}</p>
  </motion.div>
);

/** @param {{ holdings?: any[] }} props */
const HoldingsBreakdown = ({ holdings }) => (
  <div>
    <p className="text-[10px] font-mono tracking-widest text-zinc-300 mb-3">
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

/** @param {{ holdings?: any[] }} props */
const ExposureChart = ({ holdings }) => (
  <div className="relative h-52 mx-auto w-full max-w-[220px]">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={holdings}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius="65%"
          outerRadius="85%"
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

/** @param {{ portfolio?: any, concentrationRisk?: { label: string, color: string } }} props */
const ConcentrationSummary = ({ portfolio, concentrationRisk }) => (
  <div className="mb-6">
    <div className="text-[10px] font-mono tracking-widest text-zinc-300 mb-1">
      PORTFOLIO CONCENTRATION
    </div>
    <div className="flex items-center gap-3 mb-2">
      <motion.span
        animate={{ color: concentrationRisk.color }}
        transition={{ duration: 0.3 }}
        className="font-mono text-3xl sm:text-4xl font-bold tracking-tight"
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
    <p className="text-[13px] text-zinc-300 leading-relaxed">{portfolio.riskNote}</p>
  </div>
);


/** @param {{ selectedPreset?: string, onSelect?: (key: string) => void }} props */
const PresetSelector = ({ selectedPreset, onSelect }) => (
  <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-7">
    <p className="text-[10px] font-mono tracking-widest text-zinc-300 mb-3">WHY IT MATTERS</p>
    <p className="text-[14px] text-zinc-200 leading-relaxed mb-6">
      Most investors think they're diversified because they own multiple ETFs. In reality, those funds often contain the same underlying companies. Traditional brokerages stop at the fund level, hiding your true exposure and making portfolio risk difficult to understand.
    </p>
    <p className="text-[12px] font-mono tracking-widest text-zinc-300 mb-3">Explore Example Portfolios</p>
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Portfolio allocation">
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
        <span className="ml-auto text-yellow-400">
          {data.value}%
        </span>
      </div>
    </div>
  );
};

/** @param {{ active?: boolean, onClick?: () => void, preset?: any }} props */
const PresetButton = ({ active, onClick, preset }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={`text-left p-4 rounded-xl transition-colors border ${
      active
        ? 'border-yellow-400/80 bg-yellow-400/[0.03]'
        : 'border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-white/20'
    }`}
  >
    <div className="flex items-center justify-between mb-1">
      <span className={`text-[14px] font-semibold ${active ? 'text-yellow-400' : 'text-white'}`}>
        {preset.label}
      </span>
      {active && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: YELLOW, boxShadow: `0 0 8px ${YELLOW}` }}
        />
      )}
    </div>
    <div className="font-mono text-[11px] text-zinc-400 mb-1.5">{preset.composition}</div>
    <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{preset.caption}</div>
  </button>
);