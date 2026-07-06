import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, TrendingUp, Github, Layers, Sparkles, Menu, X, Check, Shield, Lock, EyeOff, Trash2, Command, FileInput, Percent, Radio, ShieldCheck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, YAxis, Tooltip, BarChart, Bar, XAxis, } from 'recharts';
import { ROUTES } from '../../utils/constants';

const YELLOW = '#FACC15';
/** @type {[number, number, number, number]} */
const EASE_SMOOTH = [0.16, 1, 0.3, 1];

const PRESETS = {
  vooqqq: {
    label: '60% VOO + 40% QQQ',
    caption: "The classic 'set and forget' combo every SA investor gets pitched. Feels diversified. Isn't.",
    exposure: [
      { name: 'AAPL', value: 12.4 },
      { name: 'MSFT', value: 11.9 },
      { name: 'NVDA', value: 10.2 },
      { name: 'GOOGL', value: 6.1 },
      { name: 'AMZN', value: 5.8 },
      { name: 'META', value: 4.7 },
      { name: 'Other', value: 48.9 },
    ],
    concentration: 51.1,
    top: 'top 6 holdings',
  },
  balanced: {
    label: '70% VOO + 30% VXUS',
    caption: 'Adds international exposure through VXUS. Meaningfully lower single-name risk.',
    exposure: [
      { name: 'AAPL', value: 4.9 },
      { name: 'MSFT', value: 4.6 },
      { name: 'NVDA', value: 4.0 },
      { name: 'TSMC', value: 2.3 },
      { name: 'GOOGL', value: 2.1 },
      { name: 'NESN', value: 1.4 },
      { name: 'Other', value: 80.7 },
    ],
    concentration: 19.3,
    top: 'top 6 holdings',
  },
  ai: {
    label: '50% SMH + 30% QQQ + 20% ARKK',
    caption: 'A concentrated bet on the AI theme. High upside, high correlation risk if the theme turns.',
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
    top: 'top 6 holdings',
  },
};

const PIE_COLORS = ['#FACC15', '#F59E0B', '#FDBA74', '#FCD34D', '#EAB308', '#CA8A04', '#52525b'];

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
  { icon: ShieldCheck,    text: 'Read-only portfolio analysis' },
  { icon: Lock,      text: 'End-to-end encrypted uploads' },
  { icon: Shield,    text: 'No trading permissions required' },
  { icon: EyeOff,    text: 'Securely stored data' },
];

const SHOWCASE = [
  {
    id: 'import',
    label: 'IMPORT PORTFOLIO',
    heading: 'Start with a single upload.',
    body: 'Submit a broker statement. We parse positions, quantities, and cost basis in seconds, no broker credentials required.',
    bullets: ['Automatic statement parsing', 'Positions, quantities, cost basis', 'Multiple brokers supported'],
    src: '/screens/portfolio.png',
    alt: 'Portfolio import flow with broker statement upload',
  },
  {
    id: 'lookthrough',
    label: 'LOOK-THROUGH ANALYSIS',
    heading: 'Every ETF, flattened to the tickers underneath.',
    body: 'Reveal the companies inside every ETF and understand your portfolio\'s true exposure.',
    bullets: ['ETFs decomposed into constituents', 'True underlying weightings', 'Sector-level concentration risk'],
    src: '/screens/dashboard.png',
    alt: 'Look-through exposure showing flattened ETF holdings',
  },
  {
    id: 'dashboard',
    label: 'PORTFOLIO DASHBOARD',
    heading: 'Track performance. Monitor health. See why it moved.',
    body: 'See everything that matters in one place, from performance and portfolio health to the drivers behind today\'s returns.',
    bullets: ['Live market overview', 'Portfolio health score', 'Interactive portfolio insights'],
    src: '/screens/dashboard.png',
    alt: 'Portfolio dashboard with net worth, health score, and holdings table',
  },
  {
    id: 'analytics',
    label: 'PORTFOLIO ANALYTICS',
    heading: 'Institutional-grade indicators, on your book.',
    body: 'Weighted Sharpe, Beta, CAPM, Altman Z, P/E, ROE, and dividend yield computed across your look-through holdings.',
    bullets: ['Portfolio-level indicators', 'Risk-adjusted return metrics', 'Per-holding drill-down'],
    src: '/screens/portfolio.png',
    alt: 'Analytics page with financial indicators',
  },
  {
    id: 'news',
    label: 'NEWS CORRELATION',
    heading: 'When something moves, know exactly why.',
    body: 'Anomaly detection flags unusual moves in your holdings and links them to the news story that caused it, giving you direct and instant context',
    bullets: ['Anomaly detection on your holdings', 'Direct news-to-price correlation', 'Cross-referenced on the timeline'],
    src: '/screens/ai.png',
    alt: 'News feed correlated with portfolio anomalies',
  },
  {
    id: 'ai',
    label: 'AI PORTFOLIO ASSISTANT',
    heading: 'Ask questions. Get answers.',
    body: 'Ask about drawdown, sector concentration, or a specific holding. The assistant reads your look-through ledger and responds with real numbers.',
    bullets: ['powered by your own portfolio', 'Explains financial concepts', 'Your own intelligent assistant'],
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
      <meta property="og:title" content="Institutional-grade portfolio intelligence for South African retail investors." />
      <meta
        property="og:description"
        content="Flatten your ETFs into their true underlying holdings."
      />
      <meta property="og:type" content="website" />
      <meta name="theme-color" content="#050505" />
    </Helmet>

    <div
    className="min-h-screen bg-[#050505] text-white overflow-x-hidden relative"
    style={{ fontFamily: 'var(--font-primary)' }}>
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
    className="fixed inset-0 pointer-events-none z-0"
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
        scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/10' : 'bg-black/40 backdrop-blur-md'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-yellow-400 focus:text-black focus:px-3 focus:py-1.5 focus:rounded-md focus:text-[13px] focus:font-semibold"
      >
        Skip to content
      </a>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
        <Link to={ROUTES.HOME} className="flex items-center gap-3" aria-label="Equity-Lens home">
          <Logo />
          <span className="text-[16px] font-semibold tracking-tight text-white">Equity-Lens</span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <NavLink label="Features" href="#features" />
          <NavLink label="How it works" href="#simulator" />
          <NavLink label="Why it matters" href="#flatten" />
          <NavLink label="Help Centre" to={ROUTES.HELP} />
          <Link
            to={ROUTES.LOGIN}
            className="px-4 py-2 text-[14px] font-medium text-white hover:bg-white/5 rounded-lg transition-colors ml-2"
          >
            Log in
          </Link>
          <Link to={ROUTES.REGISTER} className="ml-1">
            <span
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[14px] font-semibold bg-yellow-400 text-black rounded-lg hover:bg-yellow-300 transition-colors"
              style={{ boxShadow: `0 4px 16px ${YELLOW}40` }}
            >
              Sign up
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-white/10 text-white"
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
          className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur-xl"
        >
          <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col gap-1">
            <NavLink label="How it works" href="#simulator" onClick={() => setMobileOpen(false)} />
            <NavLink label="Features" href="#features" onClick={() => setMobileOpen(false)} />
            <NavLink label="Why it matters" href="#flatten" onClick={() => setMobileOpen(false)} />
            <NavLink label="Help Centre" to={ROUTES.HELP} onClick={() => setMobileOpen(false)} />
            <Link
              to={ROUTES.LOGIN}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 text-[15px] font-medium text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Sign in
            </Link>
            <Link
              to={ROUTES.REGISTER}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 text-[15px] font-semibold bg-yellow-400 text-black rounded-lg mt-1 text-center"
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
  if (to) return <Link to={to} className={cls} onClick={onClick}>{label}</Link>;
  return <a href={href} className={cls} onClick={onClick}>{label}</a>;
};

const Logo = () => (
  <div
    aria-hidden="true"
    className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] font-black text-black font-mono"
    style={{
      background: YELLOW,
      boxShadow: `0 4px 16px ${YELLOW}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
    }}
  >
    //logo goes here when we have one
  </div>
);

const Hero = () => (
  <section className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-16 sm:pb-20">
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">
      <div>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[11px] font-mono tracking-widest text-zinc-300 mb-5 sm:mb-6 uppercase"
        >
          Institutional-grade portfolio intelligence for South African retail investors.
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-[clamp(36px,5.5vw,72px)] font-semibold leading-[1.02] tracking-[-0.035em] mb-5 sm:mb-6 text-white"
        >
          See past the surface<br />
          of your portfolio.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-[15px] sm:text-[17px] text-zinc-200 leading-relaxed max-w-lg mb-8 sm:mb-9"
        >
          Upload your portfolio and uncover hidden concentration, true ETF exposure, portfolio health and the market events driving your returns.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="flex flex-wrap gap-3"
        >
          <Link to={ROUTES.REGISTER}>
            <YellowButton>
              Analyse my portfolio
            </YellowButton>
          </Link>
          <a
            href="#simulator"
            className="inline-flex items-center gap-2 px-6 py-3 text-[14px] font-medium text-white border border-white/15 rounded-lg hover:bg-white/5 transition-colors"
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
      className="relative rounded-2xl border border-white/10 overflow-hidden bg-white/5 backdrop-blur-xl"
      style={{ boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6)' }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex justify-between items-start mb-5 gap-3">
          <div>
            <div className="text-[10px] font-mono text-zinc-300 mb-1.5 tracking-widest">NET WORTH</div>
            <div className="text-[22px] sm:text-[28px] font-semibold tracking-tight font-mono text-white">
              R 847,231<span className="text-zinc-400">.04</span>
            </div>
            <div
              className="text-[12px] mt-1 font-mono flex items-center gap-1"
              style={{ color: '#22c55e' }}
            >
              <TrendingUp size={11} aria-hidden="true" />
              +R 12,405 (+1.49%) today
            </div>
          </div>
          <div className="w-28 sm:w-36 h-12 sm:h-14 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HERO_PERF}>
                <YAxis hide domain={['auto', 'auto']} />
                <Line type="monotone" dataKey="v" stroke={YELLOW} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { l: 'SHARPE', v: '1.42' },
            { l: 'BETA', v: '0.87' },
            { l: 'ALPHA', v: '+2.1%' },
          ].map((m) => (
            <div key={m.l} className="p-2.5 rounded-lg border border-white/10 bg-black/40">
              <div className="text-[9px] font-mono text-zinc-300 mb-0.5">{m.l}</div>
              <div className="text-[14px] font-mono font-semibold text-white">{m.v}</div>
            </div>
          ))}
        </div>

        <div className="text-[10px] font-mono text-zinc-300 mb-2 tracking-widest">
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
            className="grid grid-cols-[50px_1fr_50px_55px] gap-2 sm:gap-3 items-center py-2 px-2 rounded-md text-[11px] font-mono text-white"
          >
            <span className="font-bold">{h.sym}</span>
            <span className="text-zinc-300 truncate">{h.name}</span>
            <span className="text-right">{h.pct}%</span>
            <span className="text-right" style={{ color: h.chg >= 0 ? '#22c55e' : '#ef4444' }}>
              {h.chg >= 0 ? '+' : ''}{h.chg}%
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const lensCell = 'p-4 sm:p-5 border-l border-white/10 flex items-center gap-3';
const brokerCell = "p-4 sm:p-5 flex items-center gap-3";
const lensBG = { background: 'rgba(250,200,200,0.3)' };
const text1 = "text-[13px] sm:text-[16px] text-zinc-400"
const text2 = "text-[13px] sm:text-[16px] text-white font-medium"
const tick = (
  <Check
    size={15}
    className="text-yellow-400 shrink-0"
    aria-hidden="true"
  />);
  const cross = (
  <X
    size={15}
    className="text-zinc-500 shrink-0"
    aria-hidden="true"
  />);

const Comparison = () => {
  const reveal = useRevealVariant();
  return (
    <section
      aria-labelledby="compare-heading"
      className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24"
    >
      <motion.div {...reveal} className="max-w-2xl mb-10 sm:mb-12">
        <p className="text-[11px] font-mono tracking-widest text-zinc-300 mb-3">
          WHY EQUITY-LENS
        </p>
        <h2
          id="compare-heading"
          className="text-[clamp(28px,4vw,52px)] font-semibold tracking-[-0.03em] leading-[1.05] text-white"
        >
          From fund labels<br />
          <span className="text-yellow-400">to true exposure.</span>
        </h2>
      </motion.div>

      <motion.div
        {...reveal}
        transition={{ ...reveal.transition, delay: 0.1 }}
        className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
      >
        <div className="grid grid-cols-2 border-b border-white/10">
          <div className="p-4 sm:p-5">
            <p className="text-[10px] font-mono tracking-widest text-zinc-400 mb-1">
              TRADITIONAL BROKERAGE
            </p>
            <p className="text-[14px] sm:text-[15px] font-semibold text-zinc-300">
              What you see today
            </p>
          </div>
          <div className="p-4 sm:p-5 border-l border-white/10" style={lensBG}>
            <p className="text-[10px] font-mono tracking-widest text-yellow-400 mb-1">
              EQUITY-LENS
            </p>
            <p className="text-[14px] sm:text-[15px] font-semibold text-white">
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
      className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 lg:px-10"
    >
      <motion.div
        {...REVEAL}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent backdrop-blur-2xl px-8 py-14 sm:px-14 sm:py-16"
      >
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-emerald-400/5 blur-3xl" />

        <div className="relative max-w-4xl">
          <div className="mb-6 flex items-center gap-4">
            <p
              id="mission-heading"
              className="text-[14px] font-mono uppercase tracking-[0.60em] text-yellow-400"
            >
              Our Mission
            </p>
          </div>

          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Every South African investor deserves{" "}
            <span className="text-yellow-400">
              institutional-grade portfolio intelligence.
            </span>
          </h2>

          <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-300 sm:text-lg">
            Traditional brokerages stop at the fund level. Equity Lens reveals
            the companies, concentration risk and portfolio insights hidden
            beneath your investments, giving you the same clarity
            traditionally reserved for institutional investment desks.
          </p>
        </div>
      </motion.div>
    </section>
  );
};