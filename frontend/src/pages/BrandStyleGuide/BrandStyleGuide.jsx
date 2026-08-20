import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../../components/common/Button/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';
import FormInput from '../../components/forms/FormInput/FormInput';
import PasswordInput from '../../components/forms/PasswordInput/PasswordInput';
import { ROUTES } from '../../utils/constants';

/** @type {import('framer-motion').HTMLMotionProps<'section'>} */
const FADE_UP = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.4, ease: 'easeOut' },
};

const NAV_SECTIONS = [
  { id: 'colour', label: 'Colour' },
  { id: 'typography', label: 'Typography' },
  { id: 'logo', label: 'Logo & Icons' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'components', label: 'Components' },
  { id: 'layout', label: 'Layout' },
  { id: 'a11y', label: 'Accessibility' },
  { id: 'voice', label: 'Voice & Tone' },
  { id: 'changelog', label: 'Changelog' },
];

const COLOUR_GROUPS = [
  {
    title: 'Surfaces (dark theme, default)',
    swatches: [
      { name: '--surface-base', hex: '#0d0f12', rgb: 'rgb(13, 15, 18)', usage: 'Page background' },
      { name: '--surface-raised', hex: '#14171c', rgb: 'rgb(20, 23, 28)', usage: 'Navbar, sidebar' },
      { name: '--surface-card', hex: '#181b21', rgb: 'rgb(24, 27, 33)', usage: 'Cards, panels' },
      { name: '--surface-elevated', hex: '#1e222a', rgb: 'rgb(30, 34, 42)', usage: 'Tooltips, dropdowns - sits above a card' },
      { name: '--border-subtle', hex: '#262a33', rgb: 'rgb(38, 42, 51)', usage: 'Default dividers, card borders' },
      { name: '--border-mid', hex: '#343a47', rgb: 'rgb(52, 58, 71)', usage: 'Stronger borders, hover outlines' },
    ],
  },
  {
    title: 'Text (dark theme)',
    swatches: [
      { name: '--text-primary', hex: '#edeef2', rgb: 'rgb(237, 238, 242)', usage: 'Headings, primary body copy - warm white, never pure white' },
      { name: '--text-secondary', hex: '#9298a6', rgb: 'rgb(146, 152, 166)', usage: 'Secondary copy, labels' },
      { name: '--text-dim', hex: '#656b7a', rgb: 'rgb(101, 107, 122)', usage: 'Metadata' },
      { name: '--text-disabled', hex: '#454a56', rgb: 'rgb(69, 74, 86)', usage: 'Disabled control text' },
      { name: '--text-ghost', hex: '#4a5061', rgb: 'rgb(74, 80, 97)', usage: 'Placeholder-level, decorative labels only' },
    ],
  },
  {
    title: 'Accent - electric orange, identical in both themes',
    swatches: [
      { name: '--accent-primary', hex: '#ff6b00', rgb: 'rgb(255, 107, 0)', usage: 'Primary buttons, active nav, links, focus ring, key stats - used sparingly (~10% of the UI)' },
      { name: '--accent-hover', hex: '#e65f00', rgb: 'rgb(230, 95, 0)', usage: 'Accent hover/active state' },
      { name: '--text-on-accent', hex: '#000000', rgb: 'rgb(0, 0, 0)', usage: 'Text/icons on a filled accent surface' },
      { name: '--border-accent', hex: '#ff6b00', rgb: 'rgb(255, 107, 0)', usage: 'Accent-coloured borders' },
    ],
  },
  {
    title: 'Semantic / signal',
    swatches: [
      { name: '--signal-positive', hex: '#34d399', rgb: 'rgb(52, 211, 153)', usage: 'Gains, success states - never the brand accent' },
      { name: '--signal-negative', hex: '#e5484d', rgb: 'rgb(229, 72, 77)', usage: 'Losses, errors, destructive actions' },
      { name: '--signal-warning', hex: '#fbbf24', rgb: 'rgb(251, 191, 36)', usage: 'Warnings, moderate risk - distinct hue from the accent on purpose' },
      { name: '--signal-info', hex: '#60a5fa', rgb: 'rgb(96, 165, 250)', usage: 'Informational states only, optional' },
      { name: '--color-danger', hex: '#dc2626', rgb: 'rgb(220, 38, 38)', usage: 'Filled danger button background (paired with white text)' },
    ],
  },
  {
    title: 'Surfaces (light theme)',
    swatches: [
      { name: '--surface-base', hex: '#fafaf8', rgb: 'rgb(250, 250, 248)', usage: 'Page background - warm off-white, not stark white' },
      { name: '--surface-raised / --surface-card', hex: '#ffffff', rgb: 'rgb(255, 255, 255)', usage: 'Navbar, cards' },
      { name: '--text-primary', hex: '#2b2118', rgb: 'rgb(43, 33, 24)', usage: 'Warm charcoal, deliberately not black-on-white' },
      { name: '--text-secondary', hex: '#6b7280', rgb: 'rgb(107, 114, 128)', usage: 'Cool slate-grey for secondary/data copy' },
    ],
  },
];

const CONTRAST_ROWS = [
  { pair: 'text-primary on surface-base (dark)', ratio: '16.55 : 1', target: 'AAA', status: 'pass', note: 'body copy, dark theme' },
  { pair: 'text-secondary on surface-base (dark)', ratio: '6.64 : 1', target: 'AA', status: 'pass', note: 'AA pass, falls just short of AAA (7:1)' },
  { pair: 'text-dim on surface-base (dark)', ratio: '3.60 : 1', target: 'AA large only', status: 'warn', note: 'fails AA for normal text, only use at 18px+/bold/metadata' },
  { pair: 'accent-primary on surface-base (dark)', ratio: '6.72 : 1', target: 'AA', status: 'pass', note: 'safe as text or icon colour on dark' },
  { pair: 'signal-positive on surface-base (dark)', ratio: '9.98 : 1', target: 'AAA', status: 'pass', note: '' },
  { pair: 'signal-negative on surface-base (dark)', ratio: '4.90 : 1', target: 'AA', status: 'pass', note: '' },
  { pair: 'text-on-accent on accent-primary bg (button)', ratio: '7.36 : 1', target: 'AAA', status: 'pass', note: 'black text on the literal #FF6B00 - comfortably clears AA, was 4.86:1 under the old copper accent' },
  {
    pair: 'button danger text (white) on --color-danger bg',
    ratio: '4.83 : 1',
    target: 'AA',
    status: 'pass',
    note: 'fixed - was 2.69:1 (failing) under the old --color-danger value',
  },
  {
    pair: 'accent-primary directly on light-theme surface-base',
    ratio: '2.73 : 1',
    target: 'fails AA',
    status: 'fail',
    note: 'the literal #FF6B00 is brighter than the old copper and fails AA even at large text in light mode - fine for a focus ring or an icon on its own, but bare accent-coloured body text in light mode needs a tinted badge/background behind it (see --accent-subtle usage)',
  },
  {
    pair: 'signal-positive directly on light-theme surface-base',
    ratio: '1.84 : 1',
    target: 'fails AA',
    status: 'fail',
    note: 'green never appears bare on the page canvas - always inside signal-positive-bg, which restores contrast',
  },
  { pair: 'text-primary on surface-base (light)', ratio: '15.07 : 1', target: 'AAA', status: 'pass', note: '' },
  { pair: 'text-secondary on surface-base (light)', ratio: '4.63 : 1', target: 'AA', status: 'pass', note: '' },
];

const TYPE_SCALE = [
  { name: 'Display', size: '48px / 3rem', weight: 700, lh: 1.1, usage: 'Hero headings, landing page' },
  { name: 'H1', size: '36px / 2.25rem', weight: 700, lh: 1.2, usage: 'Page titles' },
  { name: 'H2', size: '28px / 1.75rem', weight: 600, lh: 1.3, usage: 'Section headings' },
  { name: 'H3', size: '22px / 1.375rem', weight: 600, lh: 1.4, usage: 'Card titles, sub-sections' },
  { name: 'H4', size: '18px / 1.125rem', weight: 500, lh: 1.4, usage: 'Widget titles, labels' },
  { name: 'Body Large', size: '16px / 1rem', weight: 400, lh: 1.6, usage: 'Primary body text' },
  { name: 'Body', size: '14px / 0.875rem', weight: 400, lh: 1.6, usage: 'Secondary body text, descriptions' },
  { name: 'Small', size: '12px / 0.75rem', weight: 400, lh: 1.5, usage: 'Captions, metadata, badges' },
  { name: 'Micro', size: '10px / 0.625rem', weight: 500, lh: 1.4, usage: 'Tags, dense dashboard labels' },
];

const SPACING_SCALE = [
  { token: 'space-1', value: '4px', usage: 'Micro spacing, icon gaps' },
  { token: 'space-2', value: '8px', usage: 'Tight spacing, small padding' },
  { token: 'space-3', value: '12px', usage: 'Compact padding' },
  { token: 'space-4', value: '16px', usage: 'Default padding, card inner' },
  { token: 'space-5', value: '20px', usage: 'Section spacing' },
  { token: 'space-6', value: '24px', usage: 'Card padding, form groups' },
  { token: 'space-8', value: '32px', usage: 'Section padding' },
  { token: 'space-10', value: '40px', usage: 'Large section spacing' },
  { token: 'space-12', value: '48px', usage: 'Page padding' },
  { token: 'space-16', value: '64px', usage: 'Major section breaks' },
];

const RADIUS_SCALE = [
  { name: 'sm (buttons, inputs)', value: '8px', tw: 'rounded-lg' },
  { name: 'md (cards, panels)', value: '16px', tw: 'rounded-2xl' },
  { name: 'lg (modals)', value: '16px', tw: 'rounded-2xl' },
  { name: 'pill (badges, tags)', value: '9999px', tw: 'rounded-full' },
];

const MOTION_SCALE = [
  { name: 'Micro-interaction', value: '150ms', easing: 'ease-out', usage: 'Hover, focus, button press' },
  { name: 'Page / section transition', value: '300ms', easing: 'ease-out', usage: 'Route changes, reveal-on-scroll' },
  { name: 'Complex animation (max)', value: '500ms', easing: 'ease-out', usage: 'Multi-step or chained motion' },
];

const BREAKPOINTS = [
  { name: 'Mobile', range: '320px – 639px', tw: '(default)', usage: 'Single column layouts' },
  { name: 'sm', range: '640px – 767px', tw: 'sm:', usage: 'Two-column forms' },
  { name: 'md', range: '768px – 1023px', tw: 'md:', usage: 'Tablet, collapsed sidebar' },
  { name: 'lg', range: '1024px – 1279px', tw: 'lg:', usage: 'Desktop, expanded sidebar' },
  { name: 'xl / 2xl', range: '1280px+', tw: 'xl: / 2xl:', usage: 'Wide desktop, bento grids' },
];

const ICON_RULES = [
  { size: '16px', usage: 'Inline with body/small text, dense dashboard rows' },
  { size: '20px', usage: 'Default standalone icon (buttons, nav)' },
  { size: '24px', usage: 'Section headers, empty states' },
];

const CHANGELOG = [
  {
    area: 'Colour palette (dashboard redesign pass)',
    change:
      'Accent moved again, from the restrained copper (#c1622c) to a literal, vibrant electric orange (#ff6b00, Tailwind\'s orange-500) per explicit direction - same value in both themes on purpose, same as the copper it replaced. --accent-hover and --border-accent moved with it (#e65f00); --text-on-accent switched from a warm near-black to pure #000000 for max contrast on the brighter orange. The brighter value trades some light-mode versatility for it: bare accent-coloured body text on the light surface now fails AA (2.73:1, was 3.98:1) so it needs a tinted badge behind it - fine as a focus ring, icon, or button fill, which is most of where it\'s actually used. The Action Centre\'s scroll-to-target highlight also moved off a custom CSS class onto the literal Tailwind utility string (ring-4 ring-orange-500 animate-pulse) for the same reason - specified directly rather than routed through a token.',
  },
  {
    area: 'Colour palette (previous pass)',
    change:
      'Retired the gold/yellow accent (#d4a017, itself a step down from Demo 1\'s #FFB800) in favour of a refined copper/orange (#c1622c), identical in both themes per the brand direction at the time. --signal-gold was merged into --accent-primary (same token, one name, one place to change it). Neutral scale rebuilt with a 4th surface tier (--surface-elevated, for tooltips/dropdowns) and a dedicated --text-disabled tier that did not exist before.',
  },
  {
    area: 'Bug fix - --glass-bg / --glass-border',
    change:
      'DashboardHero, GlassPanel, PortfolioInsight and the dashboard sticky ticker all rendered with style={{ background: \'var(--glass-bg)\' }} but neither --glass-bg nor --glass-border was ever defined in globals.css - they resolved to nothing. Both are now real tokens (translucent surface + hairline border, tuned per theme).',
  },
  {
    area: 'Bug fix - light-mode button contrast',
    change:
      'Six components set color: \'var(--bg-primary)\' as the text colour on top of a filled accent button. That only works in dark mode, where bg-primary is near-black - in light mode bg-primary is the light page background, making button text nearly invisible. Introduced --text-on-accent (a fixed warm near-black, 4.86:1 on the accent in both themes) and swapped all six.',
  },
  {
    area: 'Bug fix - contrast',
    change:
      'Danger button text was white on --color-danger (#fb7185, a rose, not a red) at 2.69:1 - failing AA. --color-danger is now #dc2626, 4.83:1 with white text. --signal-negative moved from the same rose to #e5484d for the same reason.',
  },
  {
    area: 'Bug fix - invalid Tailwind classes',
    change:
      'text-white-400 (News.jsx watchlist rows, ×2) and a bare text-red with no shade number (Portfolio.jsx) are not real Tailwind classes and silently render as unstyled text - same failure mode as the known text-white-500 bug elsewhere in this codebase. Both fixed to token-based colours.',
  },
  {
    area: 'Charts',
    change:
      'Recharts colour props moved off hardcoded hex to --chart-primary/--chart-benchmark/--chart-comparison. SectorPieChart\'s 8-colour rainbow palette and the Sector Allocation / Largest Holdings donut\'s 13-colour palette were both desaturated to a muted, institutional set (still one colour per sector, just not neon).',
  },
  {
    area: 'Component maturity',
    change:
      'Button, FormInput, PasswordInput and LoadingSpinner are real, reused components. Modal, Toast, Select and Dropdown still do not exist anywhere in the app - not restyled because there is nothing to restyle; when built they should pull --surface-elevated, --shadow-elevated and the existing 16px radius rather than inventing new values.',
  },
  {
    area: 'Landing page retokenised',
    change:
      'Landing.jsx has since merged in and was carrying its own separate palette - a yellow/gold accent (#d4a017, plus Tailwind yellow-400/300/50/600) and hardcoded near-black/near-white section backgrounds, unrelated to --accent-primary. Swapped the accent to var(--accent-primary)/var(--accent-hover)/var(--accent-subtle), the loss figures in the drawdown ledger to var(--signal-negative), the mission strip glow to var(--signal-positive), and the page background to var(--surface-base). Left the zinc grey/white neutral text as-is - it already sits close to the dark-theme text tokens and the page\'s light "WhyEquityLens" band is a deliberate fixed-light section, not theme-aware, so swapping it to the theme-conditional text tokens would risk breaking contrast rather than fixing anything.',
  },
  {
    area: 'Portfolio.jsx / News.jsx',
    change:
      'Both pages previously used plain Tailwind defaults (text-white, text-gray-400, bg-gray-800, border-gray-700, plus arbitrary text-yellow-500/text-purple-500/text-blue-500 icon colours with no semantic reason) instead of the token system, so neither responded to the light/dark toggle at all. Retokenised in place - no logic, routes or component structure changed, only className colour values.',
  },
  {
    area: 'Shadows',
    change:
      'Dark-theme cards move from --shadow-card: none to a soft, layered shadow (per the "soft layered elevation, not heavy drop shadows" direction) instead of relying on border-only definition. Added --shadow-elevated as a lighter tier between card and modal shadows.',
  },
  {
    area: 'Corner radius',
    change: 'Unchanged this pass - cards stay at 16px (rounded-2xl), matching the glassmorphism direction already established on the dashboard.',
  },
  {
    area: 'Accessibility',
    change:
      'FormInput\'s aria-invalid/aria-describedby wiring is unchanged. Its focus-ring rgba() was still the literal old #FFB800 gold (rgba(255,184,0,...)) hardcoded outside the token system - now rgba(193,98,44,...) to match the new accent.',
  },
];

/** @param {{ hex: string, rgb: string, name: string, usage: string }} props */
const Swatch = ({ hex, rgb, name, usage }) => (
  <div
    style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}
  >
    <div style={{ height: '64px', background: hex, borderBottom: '1px solid var(--border-subtle)' }} />
    <div style={{ padding: '12px 14px' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {name}
      </p>
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
        {hex} &middot; {rgb}
      </p>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>{usage}</p>
    </div>
  </div>
);

/** @param {{ id: string, eyebrow: string, title: string, blurb?: string }} props */
const SectionHeading = ({ id, eyebrow, title, blurb }) => (
  <div id={id} style={{ scrollMarginTop: '80px', marginBottom: '28px' }}>
    <p
      style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--accent-primary)',
        fontFamily: 'var(--font-mono)',
        marginBottom: '6px',
      }}
    >
      {eyebrow}
    </p>
    <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{title}</h2>
    {blurb && (
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '640px', lineHeight: 1.6 }}>
        {blurb}
      </p>
    )}
  </div>
);

/** @param {{ status: string }} props */
const StatusBadge = ({ status }) => {
  /** @type {Record<string, { label: string, bg: string, color: string, border: string }>} */
  const map = {
    pass: { label: 'Pass', bg: 'var(--signal-positive-bg)', color: 'var(--signal-positive)', border: 'var(--signal-positive-border)' },
    warn: { label: 'Caution', bg: 'var(--signal-warning-bg)', color: 'var(--signal-warning)', border: 'var(--signal-warning-border)' },
    fail: { label: 'Fails', bg: 'var(--signal-negative-bg)', color: 'var(--signal-negative)', border: 'var(--signal-negative-border)' },
  };
  const s = map[status];
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '9999px',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
};

const BrandStyleGuide = () => {
  const [formValue, setFormValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');

  return (
    <div style={{ background: 'var(--surface-base)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          className="mx-auto max-w-6xl px-4 lg:px-6"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', gap: '16px' }}
        >
          <Link
            to={ROUTES.HOME}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}
          >
            <span className="hidden sm:inline">Back to EquityLens</span>
          </Link>
          <nav
            className="scrollbar-hide"
            style={{ display: 'flex', gap: '4px', overflowX: 'auto', flex: 1, justifyContent: 'flex-end' }}
          >
            {NAV_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 lg:px-6 py-12 space-y-24">
        <motion.section {...FADE_UP}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--accent-primary)',
              fontFamily: 'var(--font-mono)',
              marginBottom: '12px',
            }}
          >
            Brand &amp; Design System
          </p>
          <h1 style={{ fontSize: '48px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            The EquityLens design language.
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '16px', maxWidth: '640px', lineHeight: 1.6 }}>
            This is both the brand style guide and the design system for EquityLens, deployed as a living page
            rather than a static document. Every value shown below is read from the same tokens and components
            the app actually ships with -; if this page and the running app ever disagree, this page is
            wrong, not the app.
          </p>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="colour"
            eyebrow="01 Colour"
            title="Colour palette"
            blurb="EquityLens defaults to a dark, data-dense theme with a restrained copper/orange accent, with a full light theme available via the theme toggle. Neutral tones carry ~90% of the interface on purpose - colour never carries meaning alone (positive/negative states always pair with an icon or label)."
          />
          <div className="space-y-10">
            {COLOUR_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {group.title}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {group.swatches.map((s) => (
                    <Swatch key={group.title + s.name} {...s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="typography"
            eyebrow="02 Typography"
            title="Typography"
            blurb="Inter for all UI and body text, JetBrains Mono for numerical data, ticker symbols and code. Both are loaded from Google Fonts (self-hosting is a reasonable follow-up for production, not done yet)."
          />
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              padding: '8px 24px',
            }}
          >
            {TYPE_SCALE.map((t, i) => (
              <div
                key={t.name}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '24px',
                  padding: '18px 0',
                  borderBottom: i < TYPE_SCALE.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: t.size.split(' / ')[0],
                    fontWeight: t.weight,
                    lineHeight: t.lh,
                    color: 'var(--text-primary)',
                  }}
                >
                  {t.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'right',
                  }}
                >
                  {t.size} &middot; {t.weight} &middot; lh {t.lh}
                  <br />
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)' }}>{t.usage}</span>
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="logo"
            eyebrow="03 Logo &amp; Iconography"
            title="Logo and iconography"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Logo usage</h3>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px',
                  background: 'var(--surface-base)',
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}
              >
                <img src="/logo.png" alt="EquityLens logo" style={{ height: '48px', width: '48px', objectFit: 'contain' }} />
              </div>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '18px' }}>
                <li>Minimum size: 32&times;32px</li>
                <li>Maintain aspect ratio -; never stretch or distort</li>
                <li>Clear space on all sides: at least the height of the mark itself</li>
                <li>Never recolour, add drop shadows, or place on low-contrast backgrounds</li>
              </ul>
            </div>

            <div
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Iconography -; Lucide React</h3>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                {[Sparkles, TrendingUp, TrendingDown, AlertTriangle, Lightbulb].map((Icon, i) => (
                  <div
                    key={i}
                    style={{
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--surface-base)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {ICON_RULES.map((r) => (
                  <div key={r.size} style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', width: '48px', flexShrink: 0 }}>
                      {r.size}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.usage}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
                Stroke width 1.5px default, 2px for emphasis. Interactive icons use --accent-primary; inline
                icons match surrounding text colour. In practice dense dashboard UI now also uses 9&ndash;14px
                sizes below the original three-tier scale -; documented here rather than pretending it doesn&apos;t happen.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="tokens"
            eyebrow="04 Design tokens"
            title="Spacing, radius, shadow, motion, breakpoints"
            blurb="Spacing uses Tailwind's default scale directly (no custom CSS variables) since it already matches the intended 4/8px rhythm. Colour, radius and motion are expressed as real CSS custom properties in globals.css."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Spacing scale</h3>
              <div className="space-y-2">
                {SPACING_SCALE.map((s) => (
                  <div key={s.token} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', width: '64px' }}>
                      {s.token}
                    </span>
                    <div style={{ height: '10px', width: s.value, background: 'var(--accent-primary)', borderRadius: '2px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {s.value} &middot; {s.usage}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Corner radius</h3>
                <div className="grid grid-cols-2 gap-3">
                  {RADIUS_SCALE.map((r) => (
                    <div
                      key={r.name}
                      style={{
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: r.value,
                        padding: '12px',
                      }}
                    >
                      <p style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>{r.value}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{r.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Motion</h3>
                <div className="space-y-2">
                  {MOTION_SCALE.map((m) => (
                    <div key={m.name} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.usage}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {m.value} {m.easing}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Breakpoints (Tailwind defaults, unmodified)</h3>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Name', 'Range', 'Tailwind prefix', 'Usage'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BREAKPOINTS.map((b) => (
                    <tr key={b.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{b.name}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{b.range}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{b.tw}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{b.usage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="components"
            eyebrow="05 Component library"
            title="Live components"
            blurb="These are the actual imported components, not screenshots or re-implementations, so they can never silently drift from what ships."
          />

          <div className="space-y-10">
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Buttons</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="primary" loading>Loading</Button>
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ maxWidth: '640px' }}>
              <FormInput
                label="Email address"
                name="brand-guide-email"
                type="email"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="your@email.com"
              />
              <FormInput
                label="With an error"
                name="brand-guide-error"
                type = "text"
                value=""
                onChange={() => {}}
                error="This field is required"
              />
              <PasswordInput
                label="Password"
                name="brand-guide-password"
                value={passwordValue}
                onChange={(/** @type {React.ChangeEvent<HTMLInputElement>} */ e) => setPasswordValue(e.target.value)}
              />
             <FormInput label="Disabled" name="brand-guide-disabled" type="text" value="Can't touch this" onChange={() => {}} disabled />
            </div>

            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Loading spinner</h3>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <LoadingSpinner size="sm" />
                <LoadingSpinner size="md" />
                <LoadingSpinner size="lg" />
              </div>
            </div>
            </div>

        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="layout"
            eyebrow="06 Layout"
            title="Layout & spacing"
            blurb="Desktop uses a 12-column bento grid (see gridTemplateColumns.bento in tailwind.config.js). Dashboards prioritise information density with compact spacing; forms and marketing sections use generous spacing."
          />
          <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '18px' }}>
            <li>Mobile (&lt;640px): single column, sidebar collapses behind a menu button</li>
            <li>Tablet (640&ndash;1023px): two-column forms, collapsed sidebar</li>
            <li>Desktop (1024px+): full 12-column bento grid, expanded sidebar</li>
            <li>No horizontal scrolling on mobile at any breakpoint</li>
          </ul>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="a11y"
            eyebrow="07 Accessibility"
            title="Accessibility standards"
            blurb="Target: WCAG 2.2 AA minimum, AAA encouraged for body text. Ratios below were computed programmatically from the real token hex values, not estimated."
          />
          <div className="overflow-x-auto" style={{ marginBottom: '20px' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Pairing', 'Ratio', 'Target', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-dim)', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONTRAST_ROWS.map((r) => (
                  <tr key={r.pair} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                      {r.pair}
                      {r.note && (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{r.note}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{r.ratio}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{r.target}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '18px' }}>
            <li>All interactive elements are reachable via Tab; focus uses a visible 2px accent-coloured outline (see *:focus-visible in globals.css)</li>
            <li>prefers-reduced-motion is respected globally -; animation/transition durations collapse to near-zero</li>
            <li>Colour is never the only signal: gain/loss always pairs with a +/&minus; sign or icon</li>
            <li>FormInput wires aria-invalid and aria-describedby automatically on error</li>
          </ul>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading
            id="voice"
            eyebrow="08 Voice and tone"
            title="Voice and tone"
            blurb="Direct, plain language. No corporate hedging, no false certainty about real securities."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ background: 'var(--signal-negative-bg)', border: '1px solid var(--signal-negative-border)', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--signal-negative)', marginBottom: '8px' }}>Avoid</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                &quot;An unexpected error occurred. Please try again later.&quot;
              </p>
            </div>
            <div style={{ background: 'var(--signal-positive-bg)', border: '1px solid var(--signal-positive-border)', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--signal-positive)', marginBottom: '8px' }}>Use instead</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>&quot;Registration failed&quot; / &quot;Invalid code&quot;</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '16px', lineHeight: 1.7 }}>
            When discussing real, publicly traded securities (illustrative figures in the Simulator, drawdown
            examples), never state fabricated numbers with absolute certainty , label them clearly as
            illustrative.
          </p>
        </motion.section>

        <motion.section {...FADE_UP}>
          <SectionHeading id="changelog" eyebrow="09 Changelog" title="Changes since Demo 1" />
          <div className="space-y-4">
            {CHANGELOG.map((c) => (
              <div
                key={c.area}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                }}
              >
                <ChevronRight size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{c.area}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.change}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <footer style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            EquityLens &middot; Team TB5 &middot; COS 301 Capstone 2026
          </p>
        </footer>
      </div>
    </div>
  );
};

export default BrandStyleGuide;
