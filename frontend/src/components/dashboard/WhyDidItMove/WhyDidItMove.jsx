import { ChevronDown, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';

import {
  articleConfidence,
  buildEventNarrative,
  buildEventQuestion,
} from '../../../utils/eventNarrative';
import AnimatedReveal from '../shared/AnimatedReveal';
import SecondaryButton from '../shared/SecondaryButton';

import EventStudyChart from './EventStudyChart';

const RANKING_CAPTION =
  'Ranked by relevance to the event window. These are possible explanations, not established causes.';

const ASK_BUTTON_CLASS =
  'pressable mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2 font-mono text-[12px] font-medium transition-opacity hover:opacity-80';
const ASK_BUTTON_STYLE = {
  background: 'var(--cta-emphasis)',
  color: 'var(--cta-emphasis-text)',
};

const CONFIDENCE = {
  strong: { label: 'strong match', color: 'var(--signal-positive)', bg: 'var(--accent-subtle)' },
  moderate: { label: 'possible match', color: 'var(--accent-primary)', bg: 'var(--surface-hover)' },
  weak: { label: 'weak match', color: 'var(--text-ghost)', bg: 'var(--surface-hover)' },
};

/** @param {any} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** @param {number} n */
const signedPct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/** @param {string} iso */
const shortDate = (iso) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** @param {{ children: any }} props */
const SectionLabel = ({ children }) => (
  <p
    className="mb-1.5 font-mono text-[11px] uppercase tracking-widest"
    style={{ color: 'var(--text-ghost)' }}>
    {children}
  </p>
);

/** @param {{ label: string, value: string, tone?: 'up'|'down'|'flat' }} props */
const Stat = ({ label, value, tone = 'flat' }) => {
  const color =
    tone === 'up'
      ? 'var(--signal-positive)'
      : tone === 'down'
        ? 'var(--signal-negative)'
        : 'var(--text-primary)';
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="font-mono text-[11px] uppercase tracking-widest"
        style={{ color: 'var(--text-ghost)' }}
      >
        {label}
      </span>
      <span className="font-mono text-[13px] font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
};

/**
 * @param {{ event: any, detail: any, narrative: any, weightPct: number|null }} props
 */
const KeyNumbers = ({ event, detail, narrative, weightPct }) => {
  const move = num(event?.return_pct);
  const fell = event?.direction === 'down';
  const z = Math.abs(num(event?.z_score) ?? 0).toFixed(1);

  const eventDay = detail?.available
    ? (detail.abnormal_returns ?? []).find((/** @type {any} */ r) => r.offset === 0)
    : null;
  const abnormal = eventDay ? num(eventDay.abnormal_return_pct) : null;
  const moveTypeLabel =
    narrative.moveType === 'market'
      ? 'Market-wide'
      : narrative.moveType === 'company'
        ? 'Company-specific'
        : null;

  const weight = typeof weightPct === 'number' && Number.isFinite(weightPct) ? weightPct : null;
  const contribution = weight !== null && move !== null ? (weight / 100) * move : null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Stat label="Move" value={move === null ? '-' : signedPct(move)} tone={fell ? 'down' : 'up'} />
        <Stat label="Vs its own swing" value={`${z}σ`} />
        {moveTypeLabel && (
          <Stat
            label="Move type"
            value={abnormal === null ? moveTypeLabel : `${moveTypeLabel} · ${signedPct(abnormal)} abnormal`}
          />)}
      </div>

      {contribution !== null && weight !== null && move !== null && (
        <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          &asymp; {weight.toFixed(1)}% weight &times; {move.toFixed(1)}% move ={' '}
          {`${contribution >= 0 ? '+' : ''}${contribution.toFixed(2)}%`} estimated contribution
          to the portfolio that day.
        </p>
      )}
    </div>
  );};

/** @param {{ level: 'strong'|'moderate'|'weak' }} props */
const ConfidenceBadge = ({ level }) => {
  const c = CONFIDENCE[level];
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );};

/** @param {{ ticker: string }} props */
const NoNews = ({ ticker }) => (
  <div className="mt-3">
    <SectionLabel>What likely drove it</SectionLabel>
    <p className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
      We have no stored news about {ticker} within three days of this date.
    </p>
    <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
      The move is still described above by its size and whether it was market- or company-wide -
      there is just no stored catalyst to point at.
    </p>
  </div>);

/** @param {{ articles: any[], ticker: string }} props */
const LikelyDriver = ({ articles, ticker }) => {
  if (articles.length === 0) return <NoNews ticker={ticker} />;

  const ranked = [...articles].sort(
    (a, b) => (b.scores?.combined ?? 0) - (a.scores?.combined ?? 0),
  );

  return (
    <div className="mt-3">
      <SectionLabel>What likely drove it</SectionLabel>
      <ol className="space-y-2.5">
        {ranked.map((/** @type {any} */ article) => (
          <li key={article.article_id} className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span
                className="min-w-0 break-words text-[12px] leading-snug"
                style={{ color: 'var(--text-primary)' }}>
                {article.title}
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Open: ${article.title}`}
                    className="ml-1 inline-block align-middle"
                    style={{ color: 'var(--text-ghost)' }}>
                    <ExternalLink size={10} />
                  </a>
                )}
              </span>
              <ConfidenceBadge level={articleConfidence(article.scores)} />
            </div>
            <div className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
              {article.source_name ?? 'Unknown source'} &middot; {shortDate(article.published_at)}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
        {RANKING_CAPTION}
      </p>
    </div>
  );};

/**
 * @param {{ event: any, detail: any }} props
 */
const Details = ({ event, detail }) => {
  const [open, setOpen] = useState(false);
  const z = Math.abs(num(event?.z_score) ?? 0).toFixed(1);
  const vol = (num(event?.annualised_volatility_pct) ?? 0).toFixed(1);

  return (
    <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <SecondaryButton
        size="sm"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        expanded={open}
        className="!px-1.5 !py-0.5 !text-[11px]"
        trailing={
          <ChevronDown
            size={10}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
          />}>
        Detection &amp; event-study details
      </SecondaryButton>

      <AnimatedReveal show={open}>
        <p className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          Flagged by an EWMA volatility model (RiskMetrics, &lambda; 0.94): a {z}&sigma; move
          against {vol}% annualised volatility over {event?.observations} trading days.
        </p>

        <div className="mt-2">
          <EventStudyChart detail={detail} initialWorkingOpen />
        </div>

        <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          News is matched by BM25 term overlap, how close the article sits to the event date, and
          whether the holding is named as an entity
        </p>
      </AnimatedReveal>
    </div>
  );};

/** @param {{ headline: string, onClose?: () => void, children: any }} props */
const Shell = ({ headline, onClose, children }) => (
  <div
    className="glass-surface flex max-h-[calc(100vh-8rem)] w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-xl shadow-lg"
    style={{ background: 'var(--surface-card)', border: '1px solid var(--border-mid)' }}>
    <div className="flex items-start gap-2 p-4 pb-2">
      <p className="flex-1 text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
        {headline}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close this explanation"
        className="pressable -mr-1 -mt-1 shrink-0 rounded-md p-1"
        style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}>
        <X size={16} />
      </button>
    </div>
    <div className="overflow-y-auto px-4 pb-4">{children}</div>
  </div>
);

/**
 * @param {{
 *   event: any,
 *   detail?: any,
 *   pending?: boolean,
 *   weightPct?: number|null,
 *   onClose?: () => void,
 *   onAsk?: (question: string) => void,
 * }} props
 */
const EventPopover = ({ event, detail = null, pending = false, weightPct = null, onClose, onAsk }) => {
  if (!event) return null;

  const usable = detail?.error ? null : detail;
  const narrative = buildEventNarrative(event, usable);
  const articles = usable?.possible_explanations ?? [];
  const topArticle = articles.find((/** @type {any} */ a) => a.url);
  const paragraph = [
    narrative.marketPart,
    narrative.companyPart,
    narrative.abnormalPart,
    narrative.confidence,
  ].filter(Boolean).join(' ');

  return (
    <Shell headline={narrative.headline} onClose={onClose}>
      <KeyNumbers event={event} detail={usable} narrative={narrative} weightPct={weightPct} />

      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {paragraph}
      </p>

      <button
        type="button"
        onClick={() => onAsk?.(buildEventQuestion(event, usable))}
        className={ASK_BUTTON_CLASS}
        style={ASK_BUTTON_STYLE}
      >
        Ask AI about this move
      </button>

      {pending && (
        <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
          Looking...
        </p>
      )}

      <AnimatedReveal show={Boolean(detail?.error)}>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Could not load the detail for this move.
        </p>
      </AnimatedReveal>

      <AnimatedReveal show={Boolean(usable) && !usable?.available && narrative.moveType !== 'market'}>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Not enough price history for {event.ticker} to separate the market from the company.
        </p>
      </AnimatedReveal>

      {usable && <LikelyDriver articles={articles} ticker={event.ticker} />}

      {topArticle && (
        <div className="mt-2.5">
          <SecondaryButton
            size="sm"
            className="!text-[11px]"
            onClick={() => window.open(topArticle.url, '_blank', 'noopener,noreferrer')}
          >
            Read the article
          </SecondaryButton>
        </div>
      )}

      {usable?.available && <Details event={event} detail={usable} />}
    </Shell>
  );
};

export default EventPopover;
