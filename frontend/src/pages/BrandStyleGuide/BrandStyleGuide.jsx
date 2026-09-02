import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import Button from '../../components/common/Button/Button';
import FormInput from '../../components/forms/FormInput/FormInput';
import PasswordInput from '../../components/forms/PasswordInput/PasswordInput';
import LoadingSpinner from '../../components/common/LoadingSpinner/LoadingSpinner';
import { useThemeContext } from '../../context/ThemeContext';
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
    title: 'Page background - the only token that flips between themes',
    swatches: [
      { token: '--surface-base', usage: 'Page background. Black in dark, white in light - the printed value follows whichever theme you are viewing this page in. Everything below is theme-invariant.' },
    ],
  },
  {
    title: 'Canvas text - the one deliberately theme-aware text pair',
    swatches: [
      { token: '--text-page', usage: 'Headings and body text sitting directly on the page canvas, outside any card. Dark-on-white in light mode, white-on-black in dark. Reach for this, not --text-primary, whenever there is no card behind the text - News rendered white-on-white in light mode because this pair was not discoverable here.' },
      { token: '--text-page-secondary', usage: 'The secondary tier of the same pair - subtitles and supporting copy on the bare canvas.' },
    ],
  },
  {
    title: 'Surfaces - theme-invariant, always black-family',
    swatches: [
      { token: '--surface-raised', usage: 'Navbar, sidebar backing' },
      { token: '--surface-card', usage: 'Flat opaque cards - terminal-card (dense tabular/ticker content, deliberately not glass)' },
      { token: '--surface-elevated', usage: 'Tooltips, dropdowns, hover/selected panels - sits above a card' },
      { token: '--surface-inset', usage: 'Recessed wells inside a card - inline code, input troughs' },
      { token: '--surface-hover', usage: 'Row and list-item hover wash. White at low opacity, so it lifts whatever it sits on rather than replacing it' },
      { token: '--border-subtle', usage: 'Default dividers, card borders' },
      { token: '--border-mid', usage: 'Stronger borders, hover outlines' },
      { token: '--border-strong', usage: 'The heaviest hairline - focus containers, selected outlines' },
      { token: '--border-divider', usage: 'Faintest rule, for dividing rows inside an already-bordered card' },
    ],
  },
  {
    title: 'Text - white at opacity, identical in both themes (in-card only)',
    swatches: [
      { token: '--text-primary', usage: 'Headings, primary body copy, key numbers' },
      { token: '--text-secondary', usage: 'Secondary copy, labels' },
      { token: '--text-dim', usage: 'Metadata' },
      { token: '--text-ghost', usage: 'Placeholder-level, decorative labels only' },
      { token: '--text-disabled', usage: 'Disabled control text - deliberately below AA, matches a disabled control\'s de-emphasised role' },
    ],
  },
  {
    title: 'Accent - the orange, identical in both themes',
    swatches: [
      { token: '--accent-primary', usage: 'Primary buttons, active nav, links, focus ring, key stats - used sparingly (~10% of the UI)' },
      { token: '--accent-hover', usage: 'Accent hover/active state (darker, for press feedback)' },
      { token: '--accent-light', usage: 'Lighter accent tier for highlights/gradients - not a button or active-state colour' },
      { token: '--accent-subtle', usage: 'Accent wash for tinted backgrounds - selected rows, active chips' },
      { token: '--text-on-accent', usage: 'Text/icons on a filled accent (or filled-danger) surface' },
      { token: '--border-accent', usage: 'Accent-coloured borders' },
    ],
  },
  {
    title: 'Semantic / signal - the one deliberate exception to black/white/orange',
    swatches: [
      { token: '--signal-positive', usage: 'Gains, success states - never the brand accent' },
      { token: '--signal-negative', usage: 'Losses, errors, destructive actions' },
      { token: '--signal-warning', usage: 'Warnings, moderate risk - distinct hue from the accent on purpose' },
      { token: '--signal-info', usage: 'Informational states only, optional' },
      { token: '--color-danger', usage: 'A true alias of --signal-negative - one red for gains/losses and form validation. Filled danger buttons pair it with --text-on-accent (black), not white - see changelog' },
    ],
  },
  {
    title: 'Signal composition - the -bg / -border / -rgb forms',
    note: 'Each signal colour ships in four forms because you cannot apply alpha to a token that already holds a finished colour. --signal-positive is opaque, so var(--signal-positive) at 8% is not expressible; the -bg and -border variants are those alphas pre-mixed, and the -rgb variant holds bare channels ("0, 217, 126") so a component can compose its own, as in rgba(var(--signal-negative-rgb), 0.35) for FormInput\'s focus glow. Same reason --accent-primary-rgb exists alongside --accent-primary.',
    swatches: [
      { token: '--signal-positive-bg', usage: 'Tinted background behind a success badge or row' },
      { token: '--signal-positive-border', usage: 'Hairline for that same badge' },
      { token: '--signal-positive-rgb', usage: 'Bare channels for composing a custom alpha' },
      { token: '--signal-negative-bg', usage: 'Tinted background behind an error badge or row' },
      { token: '--signal-negative-border', usage: 'Hairline for that same badge' },
      { token: '--signal-negative-rgb', usage: 'Bare channels - what FormInput composes its focus glow from' },
      { token: '--signal-warning-bg', usage: 'Tinted background behind a warning badge' },
      { token: '--signal-warning-border', usage: 'Hairline for that same badge' },
      { token: '--signal-info-bg', usage: 'Tinted background behind an info badge' },
      { token: '--signal-info-border', usage: 'Hairline for that same badge' },
      { token: '--accent-primary-rgb', usage: 'Bare accent channels, for the same alpha-composition reason' },
    ],
  },
  {
    title: 'Charts',
    note: 'Recharts takes colours as props rather than CSS, so these exist to keep chart furniture on the token system instead of hardcoded hex. --chart-primary and --chart-neutral are deprecated - see below.',
    swatches: [
      { token: '--chart-grid', usage: 'Cartesian grid lines behind a plot' },
      { token: '--chart-axis-text', usage: 'Axis tick labels' },
      { token: '--chart-tooltip-bg', usage: 'Backing for a chart tooltip - the elevated surface, so it reads above the card' },
      { token: '--chart-inactive', usage: 'Dimmed/unselected series' },
      { token: '--chart-primary', deprecated: true, usage: 'Deprecated - zero var() usages left in the codebase. Portfolio series read --accent-primary directly now. Kept only so an old file referencing it still resolves; do not use it in new code.' },
      { token: '--chart-neutral', deprecated: true, usage: 'Deprecated - its only remaining usage is the --chart-primary definition above. Secondary/benchmark series read --text-secondary directly now.' },
    ],
  },
];

// Legacy names still resolvable so old files keep working. Deliberately not given
// swatches - they are not separate colours, and showing them twice would imply they are.
const TOKEN_ALIASES = [
  { alias: '--bg-primary', target: '--surface-base' },
  { alias: '--bg-secondary', target: '--surface-raised' },
  { alias: '--bg-tertiary', target: '--surface-card' },
  { alias: '--bg-card', target: '--surface-card' },
  { alias: '--bg-hover', target: '--surface-hover' },
  { alias: '--border-default', target: '--border-subtle' },
  { alias: '--text-muted', target: '--text-dim' },
  { alias: '--color-success', target: '--signal-positive' },
  { alias: '--color-warning', target: '--signal-warning' },
  { alias: '--color-info', target: '--signal-info' },
];

// Recomputed 2026-09-02 from the values then in globals.css. Composite: --glass-bg
// (rgba(0,0,0,0.85)) over --surface-base, which is the base card tier and the hardest
// real backdrop - white page in light mode, so the glass composites to rgb(38, 38, 38);
// black page in dark, so it stays black. Text tokens are white-at-opacity composited
// over that. Re-run this whenever --glass-bg, --surface-base or a text alpha changes:
// four of these rows were last computed at 0.78 glass and were stale by 1.2-1.7 points.
const CONTRAST_VERIFIED = '2 September 2026';
const CONTRAST_COMPOSITE =
  '--glass-bg (black @ 0.85) composited over --surface-base - rgb(38, 38, 38) in light, black in dark';

const CONTRAST_ROWS = [
  {
    pair: 'text-primary on the base glass tier',
    ratio: '13.73 : 1',
    target: 'AAA',
    status: 'pass',
    note: 'dark theme: 18.80:1 - black glass on a black page stays literally black',
  },
  { pair: 'text-secondary on the base glass tier', ratio: '8.50 : 1', target: 'AAA', status: 'pass', note: 'dark theme: 10.54:1. Was published as 6.95:1 / AA - computed against the older 0.78 glass and never redone when it went to 0.85' },
  { pair: 'text-dim on the base glass tier', ratio: '6.05 : 1', target: 'AA', status: 'pass', note: 'dark theme: 6.91:1. Was published as 5.13:1, same stale composite' },
  { pair: 'text-ghost on the base glass tier', ratio: '5.45 : 1', target: 'AA', status: 'pass', note: 'dark theme: 6.06:1. Was published as 4.67:1. Still decorative/placeholder-level by convention, happens to clear AA anyway' },
  { pair: 'text-disabled on the base glass tier', ratio: '2.68 : 1', target: 'n/a', status: 'warn', note: 'dark theme: 2.46:1. Deliberately low - disabled controls are not held to text contrast minimums' },
  { pair: 'text-page on the page canvas (light) / (dark)', ratio: '16.56 : 1', target: 'AAA', status: 'pass', note: 'dark theme: 18.80:1. Measured against --surface-base directly, NOT the glass composite - this pair exists precisely for text with no card behind it' },
  { pair: 'text-page-secondary on the page canvas', ratio: '5.74 : 1', target: 'AA', status: 'pass', note: 'dark theme: 9.40:1. Light is the tighter of the two here, since 60% black on white is lighter than 68% white on black is dark' },
  { pair: 'accent-primary on the base glass tier', ratio: '5.25 : 1', target: 'AA', status: 'pass', note: 'dark theme: 7.31:1' },
  { pair: 'signal-positive on the base glass tier', ratio: '8.06 : 1', target: 'AAA', status: 'pass', note: 'dark theme: 11.23:1' },
  {
    pair: 'signal-negative on the base glass tier',
    ratio: '4.98 : 1',
    target: 'AA',
    status: 'pass',
    note: 'dark theme: 6.94:1. This pairing is what drove the final glass opacity (0.85/0.90, up from the brief\'s suggested 0.65-0.80) - a bolder, more saturated red only clears AA against a sufficiently dark composited glass',
  },
  { pair: 'text-on-accent (black) on accent-primary bg (button)', ratio: '7.31 : 1', target: 'AAA', status: 'pass', note: 'no glass involved - solid on solid' },
  {
    pair: 'white text on --color-danger / signal-negative bg (old danger button)',
    ratio: '3.03 : 1',
    target: 'fails AA',
    status: 'fail',
    note: 'caught, not shipped - the bolder red is light enough that white text on it fails. Button.jsx\'s danger variant pairs it with --text-on-accent (black, 6.94:1) instead, same reasoning as the primary/orange variant',
  },
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

const GLASS_TOKENS = [
  { tokens: ['--glass-bg', '--glass-border'], usage: 'Base tier - the everyday card. Black smoked glass, 0.85 opacity, theme-invariant - only the page background switches white/black' },
  { tokens: ['--glass-bg-elevated', '--glass-border-elevated'], usage: 'Elevated tier - anything floating over a base card: modals, dropdowns, tooltips. More opaque again (0.90) so it reads as clearly "above" the base tier' },
  { tokens: ['--glass-hover'], usage: 'Hover fill for a glass control - .glass-control:hover. Opaque enough to register as a state change without the blur shifting underneath' },
  { tokens: ['--glass-blur'], usage: 'Shared backdrop-filter blur radius, same for both tiers' },
  { tokens: ['--glass-highlight'], usage: 'Inset top-edge highlight line - the "light catching the glass" that separates real glass from a flat translucent rectangle' },
  { tokens: ['--duration-theme'], usage: 'Slow cross-fade for the light/dark background swap - deliberately separate from the fast interactive-feedback durations, so the black<->white flip reads as gradual, not abrupt' },
  { tokens: ['--scrim'], usage: 'Modal/sidebar-overlay backdrop dimming colour - pure black, theme-invariant (dims a white page and a black page equally well)' },
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
    area: 'Style guide re-synced with globals.css',
    change:
      'This page had drifted from the stylesheet it documents. Every swatch carried a hand-typed hex and rgb string beside the token name, so the printed value could disagree with :root and nobody would notice - the swatches now read the live value with getComputedStyle(document.documentElement).getPropertyValue() and re-read when the theme flips, and print "not defined in globals.css" rather than a blank cell if a token has been removed. Only the usage prose stays hand-written, since that is editorial. Documented 35 colour-family tokens that were defined in globals.css but appeared in neither swatch table: --text-page/--text-page-secondary first (the one deliberately theme-aware text pair, for canvas-level text outside any card - News rendered white-on-white in light mode precisely because this pair was not discoverable here), then the chart family, the signal -bg/-border/-rgb composition variants with a note on why both an opaque and a bare-channel form of each colour has to exist, and --surface-inset/--surface-hover/--glass-hover/--accent-subtle/--border-strong/--border-divider. The ten legacy aliases (--bg-*, --color-success/warning/info, --text-muted, --border-default) get one note naming what each points at rather than swatches of their own, so a developer meeting one in an old file knows it is not a separate colour. --chart-primary and --chart-neutral are marked deprecated: a grep across the frontend finds zero var(--chart-primary) usages, and --chart-neutral is referenced only by the --chart-primary definition itself. Re-ran the WCAG maths against the values currently in globals.css and corrected four rows - text-secondary (6.95 -> 8.50), text-dim (5.13 -> 6.05), text-ghost (4.67 -> 5.45) and text-disabled (2.50 -> 2.68) had all been computed against the earlier 0.78 glass opacity and never redone when the base tier moved to 0.85; solving for the alpha that reproduces the old numbers gives 0.780 to three decimals on all four, which matches the "0.78 was not quite enough" note in the redesign entry below. Every one moved upward, so nothing was overstated, but text-secondary was under-claiming AA when it actually clears AAA. Added rows for --text-page and --text-page-secondary, measured against --surface-base directly rather than the glass composite, since the whole point of that pair is text with no card behind it. The table now carries the date it was verified and the exact composite it was measured against.',
  },
  {
    area: 'Global visual redesign - black / white / neon-orange only',
    change:
      'Full palette rebuild per an explicit design brief: only three primary colours (black, white, the existing --accent-primary orange, reused unchanged) plus the signal colours as the one deliberate exception, bolder this pass. The core architectural move: collapsed the theme cascade so --surface-base (the page background) is the ONLY token that flips between [data-theme="light"] and dark - every surface, border, text and glass token now lives once in :root with no light override, since --bg-primary/--bg-secondary/etc were already var(--surface-base)-style aliases and follow whichever theme scope they are read in automatically. Cards stay black smoked glass in BOTH themes now, not just dark mode - the previous light theme had its own near-white --glass-bg (added during an earlier contrast-only pass), which is exactly what this brief calls out not to do. --text-primary/secondary/dim/ghost/disabled moved from separate grey hexes to white-at-opacity tiers (0.95/0.72/0.58/0.54/0.30) since every card is black in both themes now, so text never needs a separate light-mode value either. --border-subtle/--border-mid moved from dark greys to white-opacity hairlines, matching the "thin translucent border" glass-material spec. Re-solved the WCAG math for the actual hard case this creates: black glass at typical opacity, composited over a WHITE light-theme page background, is NOT literally black - at 0.85 alpha it composites to roughly rgb(38,38,38), and every text/signal colour above had to clear 4.5:1 against that specific composite, not just against a "clean" black backdrop. That is why the base --glass-bg tier ended up at 0.85 opacity and elevated at 0.90, above the brief\'s own suggested 0.65-0.80 starting range - the brief also says "do not make the cards so transparent that content becomes difficult to read", and the maths said 0.78 was not quite enough for the new signal-negative to clear AA. Bolder --signal-positive (#00d97e, was #34d399) and --signal-negative (#ff5c5c, was #e5484d) per explicit direction; --color-danger is now a true alias of --signal-negative rather than its own separate, more muted red - caught one real regression from that unification before it shipped: Button.jsx\'s danger variant paired white text with the new, lighter red (3.03:1, failing AA) - fixed to pair it with --text-on-accent (black, 6.94:1) instead, same reasoning as the existing primary/orange variant. --chart-comparison/--chart-benchmark (the blue-grey secondary-series tokens the previous "charts" changelog entry below deliberately kept) are retired - portfolio/headline series are now --accent-primary, secondary/benchmark series are --text-secondary with a dashed stroke, in PerformanceLineChart, ContributionsChart and MonteCarloChart (MonteCarloChart\'s median line was deliberately left on the white-neutral token rather than also going orange, since it needs to stand out against the already-orange-tinted probability band behind it). terminal-card (dense tabular/ticker content) stays flat and opaque, not glass, on purpose - a backdrop-blur over small numbers hurts legibility more than the material consistency is worth; it now reads black in both themes for free since --surface-card is theme-invariant. Swept hardcoded literals bypassing the token system: a hand-typed rgba matching the old --color-danger in FormInput\'s focus glow (now composes from the new --signal-negative-rgb so it cannot drift again), a stray #000 in Sidebar\'s nav badge (now --text-on-accent), a few chart activeDot/pie-stroke props that matched var(--bg-primary) - the page background, now that it flips per theme - instead of the card they actually sit on (moved to --surface-card). Left alone, deliberately: genuinely categorical data-visualisation palettes (SectorAllocation\'s ~17-colour sector map, chartConfig.js\'s unused default palette) where hue is load-bearing information, not decoration - collapsing those to black/white/orange would make multi-sector charts unreadable, the same reasoning the earlier "Charts" entry below already applied to chart-comparison/benchmark before this pass retired those two specifically. Sequential/ranked breakdown palettes with no real category identity (SectorPieChart\'s fallback ramp, Portfolio.jsx\'s cyclic pie/bar colours, Landing.jsx\'s holdings-concentration pie) were converted to accent-orange-to-white-opacity ramps instead, since rank/magnitude does not need a foreign hue the way true categories do. Landing.jsx\'s hardcoded concentration-risk colours (a bespoke green/amber/pink trio) now read the actual --signal-positive/warning/negative tokens instead of duplicating them by hand. Making --text-primary/secondary theme-invariant white surfaced one more real gap: a handful of page-level headings, loading/empty states and un-backed bordered boxes (NotFound, AIChat\'s header, Portfolio\'s loading/upload screens, News\'s page header and stat boxes, Analytics\'s header and its inverted-colour Import Holdings button, this page\'s own hero) render text directly on the raw page canvas rather than inside a card, so they were relying on --text-primary tracking the page background the way it used to. Added --text-page/--text-page-secondary - the one deliberately theme-aware pair left in the system, dark-on-white in light mode and white-on-black in dark mode, used only for canvas-level text outside any card - and swapped those specific spots onto it; News\'s stat boxes got a real --surface-card background instead (they were bordered but backgroundless, so this was the more correct fix for a case that should have been a card anyway). Found by manual audit of the confirmed risk pattern, not an exhaustive scan of all ~48 token-consuming files - worth a full click-through of both themes before merging.',
  },
  {
    area: 'Neon-orange focal glow + light-grey glass, name/icon cleanup',
    change:
      'Card colour was still theme-dependent after the previous glass pass (--glass-bg/--glass-border/etc had separate dark and light values) - collapsed all of --glass-bg/--glass-border/--glass-bg-elevated/--glass-border-elevated/--glass-highlight/--glass-hover down to one theme-invariant value each in :root, with no [data-theme] overrides left, so cards stay the same light-grey glass in both themes and only --surface-base (the page background) switches white/black. Accent hue moved from #FF8A00 (amber-leaning) to #FF6A00, a more red-shifted, higher-energy orange, to read as neon rather than muted - --accent-hover/--accent-light/--accent-subtle/--border-accent moved with it (contrast ratios in the table below updated to match). Added BackgroundGlow.jsx, a giant blurred radial-gradient neon-orange glow mounted once in AppLayout (so it persists across every route) that eases toward the cursor with a lerp instead of tracking it directly - sits at z-index -1 behind all card content so the glass cards\' own backdrop-blur picks up its colour and motion; position is written straight to a ref in a rAF loop rather than React state so mouse movement never triggers a re-render, and it holds still (no rAF loop at all) under prefers-reduced-motion. Removed the AppLayout wrapper\'s own bg-primary fill in the process - it was a non-positioned div with an opaque background sitting in the same stacking context as the glow, which painted over the glow\'s negative z-index entirely; body already carries that colour, so nothing else depends on the wrapper having its own copy. Sidebar nav items dropped their icons - sidebar reads text-only now. Topbar\'s first-name greeting is gone (avatar initials only); the blur toggle, sign-out button and avatar circle all moved onto the same glass-surface + pressable treatment ThemeTogglePill already used, via a new .glass-control hover/press class, instead of each hand-rolling its own icon-button/plain-button styling. Added TopbarTicker.jsx, a small hardcoded 3-visible vertical marquee (list duplicated once, CSS keyframe 0% -> -50%, 22s linear) in the topbar\'s left slot that the old commented-out MARKET_DATA stub used to occupy - deliberately static for now, not wired to a feed, distinct from HoldingsTicker (the real per-holding ticker) on the right.',
  },
  {
    area: 'Rebalancing Insights removed, its one real signal folded into Today\'s Insights',
    change:
      'Rebalancing Insights (ConcentrationCard + SignalCard, backed by GET /portfolio/concentration and the client-side buildSummary signals) is gone from Dashboard.jsx - deleted the whole RebalancingInsights/ directory (component, test, ReviewTradeModal). Its only signal that was not otherwise redundant - the missing-sector opportunity ("You have no X exposure") - moved into buildInsights() in dashboardInsights.js, reusing the existing findMissing/COMMON_SECTORS helpers, so it renders as a Today\'s Insights card (a new `opportunity` entry in that component\'s TONE map, coloured --signal-positive) instead of its own row. buildSummary() keeps the rest of its signal logic (concentration/diversification/benchmark signals) as a defined-but-unused export rather than being deleted outright, same precedent as the unused portfolioService functions it calls - nothing currently renders it. The Sector Allocation/All Positions row dropped from a 3-column to a 2-column grid now that Rebalancing Insights is not the third card in it.',
  },
  {
    area: 'Global glass design system overhaul',
    change:
      'Glass was only ever applied to dashboard cards via GlassPanel - Sidebar, Topbar, every modal (SetGoalModal, ReviewTradeModal, Portfolio.jsx\'s "My Portfolios" dialog), HelpTooltip, the WatchlistPanel add-ticker dropdown, FloatingToggle\'s collapsed pill, ErrorBoundary\'s crash screen and most of Portfolio.jsx\'s own cards were flat, opaque surfaces with a plain solid border - exactly the "some cards glass, most chrome isn\'t" inconsistency this pass fixes. Introduced two shared CSS classes, .glass-surface and .glass-surface-elevated (see the Glass surfaces sub-section above), that bundle background + border + backdrop-blur + a soft inset highlight + a real shadow + a cross-fade transition in one place - GlassPanel.jsx now builds on these instead of hand-rolling the same four properties inline, and every surface named above was moved onto one of the two tiers. Also fixed three chart tooltips (ContributionsChart, PerformanceVsBenchmark, MonteCarloChart) that carried a stray backdrop-blur-xl class over an opaque background - a blur with nothing translucent to blur through, doing nothing; standardised all chart tooltips to the same solid --chart-tooltip-bg treatment the other four already used instead, since a busy chart underneath a hover tooltip is exactly the wrong place for reduced legibility. Light theme\'s --glass-bg was tightened from 0.78 to 0.55 opacity (was nearly opaque, did not read as glass); --glass-hover, previously undefined in light theme and silently inheriting a white-tint hover colour invisible against light glass, now has its own warm-dark value. New tokens: --glass-bg-elevated/--glass-border-elevated, --glass-blur, --glass-highlight, --duration-theme (400ms cross-fade, deliberately slower than the fast interactive-feedback durations), --scrim (replaces four separate hardcoded rgba(13,15,18,0.55) copies of the same modal-backdrop colour). Topbar and the Sidebar\'s matching top block grew from 36px to 60px - the old height was too compressed for comfortable icon targets. The old inline sun/moon icon-button theme toggle is now ThemeTogglePill, a glass pill with a glowing accent badge that slides between the two icons (framer-motion layoutId); the dead, unused ThemeToggle.jsx/.test.jsx (imported nowhere, pointed at asset paths that no longer exist) were removed rather than extended, per the migration plan. Two more dead components turned up during the audit, StockTickerCard and MarketTicker (unreferenced anywhere outside their own tests) - left alone, same reasoning as ThemeToggle, no point restyling code nothing renders. Deliberately NOT converted: BrandStyleGuide\'s own dense reference tables/swatches (this page is documentation, not product chrome - legibility of a reference table wins over decoration), form inputs and native <select> elements (glass text inputs hurt legibility of what you\'re typing), and content nested inside an already-glass panel (stat blocks, list rows) - stacking translucency on translucency is the "washed out" failure mode this pass was fixing, not a variant to reproduce.',
  },
  {
    area: 'Colour palette (black / white / orange pass)',
    change:
      'Neutral scale rebuilt to true achromatic near-black/gray - the previous dark palette (--surface-base #0d0f12, --border-subtle #262a33, etc) had a visible cool/blue hue, not a neutral one. --surface-base/raised/elevated, --border-subtle and --text-primary/secondary/ghost now match the brand reference exactly (#0a0a0a / #111111 / #181818 / #252525 / #f5f5f5 / #929292 / #5f5f5f); --surface-card, --surface-inset, --border-mid, --text-dim and --text-disabled were not individually specified by that reference but were shifted the same neutral-gray direction rather than left on the old blue-black scale, where they would have clashed against the newly-neutral tokens sitting right next to them. Accent moved from #ff6b00 to #ff8a00 (--accent-hover to #e67b00 with it, --border-accent alongside --accent-primary as before); added --accent-light (#ffb347) as a genuinely new token for highlights/gradients since --accent-hover already has a job (darker, for press feedback) that a lighter tint does not fit. text-ghost is now tracked in the contrast table for the first time (3.10:1, "AA large only", explicitly decorative/metadata use only - it was never tracked before despite being worse, 2.39:1 under the old value).',
  },
  {
    area: 'Charts (orange is a scarce signal, not a series colour)',
    change:
      '--chart-primary used to alias straight to --accent-primary, so every "portfolio" line/bar on the app drew its entire series in orange: PerformanceVsBenchmark\'s portfolio line, ContributionsChart\'s portfolio line, MonteCarloChart\'s p50 median line, PerformanceLineChart\'s portfolio area, Portfolio.jsx\'s Trading Activity bar and Dividend Income line, and DividendBarChart\'s bar fill/stroke - the exact "orange chart" anti-pattern the brand direction calls out by name. --chart-primary now points at a new --chart-neutral token (aliases --text-secondary) instead of the accent. Each chart keeps its Recharts activeDot/activeBar restyled to --accent-primary so the hovered/current point still pops - no new chart logic, just restyling the per-point props Recharts already exposed. --chart-comparison/--chart-benchmark (the blue-grey secondary-series tokens) were left alone - they were never the violation, and losing them would make portfolio-vs-benchmark charts unreadable (both lines the same grey).',
  },
  {
    area: 'Landing.jsx hardcoded accent',
    change:
      'Landing.jsx declared its own `const ACCENT = \'#FF6B00\'` outside the token system - this project\'s own convention (CLAUDE.md) is to read colours from globals.css, never hardcode. Removed the constant; its three usages now read var(--accent-primary) directly, or rgba(var(--accent-primary-rgb), n) where the old code appended a hex alpha suffix (`${ACCENT}40`) that a bare var() can\'t reproduce. Two Tailwind arbitrary-value shadow classes had the accent\'s rgb hardcoded too (rgba(255,107,0,...)) - would have silently gone stale (glowing the old orange) the moment --accent-primary changed, so both now read rgba(var(--accent-primary-rgb),...) as well.',
  },
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

/** @param {{ token: string, value: string, usage: string, deprecated?: boolean }} props */
const Swatch = ({ token, value, usage, deprecated }) => (
  <div
    style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      overflow: 'hidden',
      opacity: deprecated ? 0.6 : 1,
    }}
  >
    <div
      style={{
        height: '64px',
        // the -rgb tokens hold bare channels, so they need wrapping before they are a colour
        background: token.endsWith('-rgb') ? `rgb(var(${token}))` : `var(${token})`,
        borderBottom: '1px solid var(--border-subtle)',
      }}
    />
    <div style={{ padding: '12px 14px' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {token}
        {deprecated && <span style={{ color: 'var(--signal-warning)' }}> (deprecated)</span>}
      </p>
      <p
        style={{
          fontSize: '11px',
          color: value ? 'var(--text-secondary)' : 'var(--signal-negative)',
          fontFamily: 'var(--font-mono)',
          marginTop: '4px',
        }}
      >
        {value || 'not defined in globals.css'}
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

const TOKEN_NAMES = [
  ...COLOUR_GROUPS.flatMap((g) => g.swatches.map((sw) => sw.token)),
  ...GLASS_TOKENS.flatMap((t) => t.tokens),
  ...TOKEN_ALIASES.map((a) => a.alias),
];

const BrandStyleGuide = () => {
  const [formValue, setFormValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const { theme } = useThemeContext();
  const [tokenValues, setTokenValues] = useState(/** @type {Record<string, string>} */ ({}));
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const root = getComputedStyle(document.documentElement);
      const values = /** @type {Record<string, string>} */ ({});
      for (const token of TOKEN_NAMES) {
        values[token] = root.getPropertyValue(token).trim();
      }
      setTokenValues(values);
    });
    return () => cancelAnimationFrame(frame);
  }, [theme]);

  return (
    <div style={{ background: 'var(--surface-base)', minHeight: '100vh', color: 'var(--text-page)', fontFamily: 'var(--font-primary)' }}>
      <div
        className="glass-surface"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          borderRadius: 0,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
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
                {group.note && (
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px', maxWidth: '720px', lineHeight: 1.6 }}>
                    {group.note}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {group.swatches.map((sw) => (
                    <Swatch key={group.title + sw.token} {...sw} value={tokenValues[sw.token]} />
                  ))}
                </div>
              </div>
            ))}

            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px 18px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Legacy aliases
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px', maxWidth: '720px', lineHeight: 1.6 }}>
                These names still resolve, and you will meet them in older files. Each is an alias, not a
                separate colour - they are left out of the swatches above so the palette is not shown twice.
                Prefer the target on the right in new code.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {TOKEN_ALIASES.map((a) => (
                  <p key={a.alias} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {a.alias} <span style={{ color: 'var(--text-dim)' }}>&rarr;</span> {a.target}
                    <span style={{ color: 'var(--text-dim)' }}> &middot; {tokenValues[a.alias] || 'not defined'}</span>
                  </p>
                ))}
              </div>
            </div>
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
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Glass surfaces</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px', maxWidth: '640px' }}>
              Every card, panel, modal, dropdown, sidebar and topbar in the app builds off one of
              these two tiers via the shared <code style={{ fontFamily: 'var(--font-mono)' }}>.glass-surface</code> /{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>.glass-surface-elevated</code> CSS classes
              (see globals.css) rather than each component hand-styling its own translucency. Base is
              the everyday card; elevated is for anything floating over a base card - a touch more
              opaque, heavier shadow, so the depth reads correctly when one glass surface sits over
              another. Don&apos;t nest elevated-in-elevated or base-in-base - stacked translucency is
              what washes the effect out.
            </p>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              style={{
                padding: '32px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, var(--signal-info) 0%, var(--accent-primary) 50%, var(--signal-positive) 100%)',
              }}
            >
              <div className="glass-surface" style={{ borderRadius: '16px', padding: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  .glass-surface
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Base tier</p>
              </div>
              <div className="glass-surface-elevated" style={{ borderRadius: '16px', padding: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  .glass-surface-elevated
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Elevated tier</p>
              </div>
            </div>
            <div className="space-y-2" style={{ marginTop: '16px' }}>
              {GLASS_TOKENS.map((t) => (
                <div key={t.tokens.join()} style={{ display: 'flex', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', minWidth: '260px', flexShrink: 0 }}>
                    {t.tokens.map((token) => (
                      <span key={token} style={{ display: 'block' }}>
                        {token}
                        <span style={{ color: tokenValues[token] ? 'var(--text-dim)' : 'var(--signal-negative)' }}>
                          {' '}
                          {tokenValues[token] || 'not defined'}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: '240px' }}>{t.usage}</span>
                </div>
              ))}
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
            blurb="Target: WCAG 2.1 AA minimum (NFR-5.2), AAA encouraged for body text. Ratios below were computed programmatically from the real token values, not estimated."
          />
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px', maxWidth: '760px', lineHeight: 1.6 }}>
            Verified {CONTRAST_VERIFIED}, against {CONTRAST_COMPOSITE}. Recompute these whenever
            --glass-bg, --surface-base or a text alpha changes - the composite is what the ratios depend
            on, not the token values on their own.
          </p>
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
