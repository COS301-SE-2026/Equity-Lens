import { AlertTriangle, ChevronDown, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';

import {
  afterEventFor,
  breadthFor,
  buildEventQuestion,
  carSentence,
  chanceFor,
  collectedFor,
  detailRowsFor,
  headlineFor,
  impactFor,
  marketFor,
  newsFor,
  provenanceFor,
  unusualnessFor,
} from '../../../utils/eventNarrative';
import AnimatedReveal from '../shared/AnimatedReveal';
import SecondaryButton from '../shared/SecondaryButton';

import EventStudyChart from './EventStudyChart';

const ASK_BUTTON_CLASS =
  'pressable mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2 font-mono text-[12px] font-medium transition-opacity hover:opacity-80';
const ASK_BUTTON_STYLE = {
  background: 'var(--cta-emphasis)',
  color: 'var(--cta-emphasis-text)',
};

/** @param {{ children: any }} props */
const SectionLabel = ({ children }) => (
  <p
    className="mb-1.5 font-mono text-[11px] uppercase tracking-widest"
    style={{ color: 'var(--text-ghost)' }}>
    {children}
  </p>
);

/** @param {{ title: string, children: any }} props */
const Section = ({ title, children }) => (
  <section className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
    <SectionLabel>{title}</SectionLabel>
    {children}
  </section>
);

/** @param {{ children: any }} props */
const Body = ({ children }) => (
  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
    {children}
  </p>
);

/** @param {{ children: any }} props */
const Chip = ({ children }) => (
  <span
    className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px]"
    style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)' }}>
    {children}
  </span>
);

/** @param {{ market: { lines: string[], why: string|null } | null }} props */
const MarketPart = ({ market }) => {
  const [open, setOpen] = useState(false);
  if (!market) return null;

  return (
    <div className="mt-2 space-y-1">
      {market.lines.map((line) => <Body key={line}>{line}</Body>)}
      {market.why && (
        <>
          <SecondaryButton
            size="sm"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            expanded={open}
            className="!px-1.5 !py-0.5 !text-[11px]">
            Why we say this
          </SecondaryButton>
          <AnimatedReveal show={open}>
            <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
              {market.why}
            </p>
          </AnimatedReveal>
        </>
      )}
    </div>
  );
};

/** @param {{ news: NonNullable<ReturnType<typeof newsFor>> }} props */
const News = ({ news }) => {
  if (news.warning) {
    return (
      <div>
        <p
          className="flex items-center gap-1.5 text-[12px] font-medium"
          style={{ color: 'var(--signal-warning)' }}>
          <AlertTriangle size={12} aria-hidden="true" />
          {news.warning}
        </p>
        <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          {news.body}
        </p>
      </div>
  );}

  return (
    <div>
      <ol className="space-y-3">
        {news.articles.map((article) => (
          <li key={article.id} className="min-w-0">
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
              {article.relevance && <Chip>{article.relevance}</Chip>}
            </div>
            <div className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
              {article.source} &middot; {article.published}
            </div>
            {article.reasons.length > 0 && (
              <ul className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                {article.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            )}
            {article.quote && (
              <blockquote
                className="mt-1 border-l-2 pl-2 text-[11px] italic leading-snug"
                style={{ borderColor: 'var(--border-mid)', color: 'var(--text-secondary)' }}>
                {article.quote}
              </blockquote>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
        {news.caption}
      </p>
    </div>
  );};

/**
 * @param {{ event: any, detail: any, scan: any }} props
 */
const Details = ({ event, detail, scan }) => {
  const [open, setOpen] = useState(false);
  const rows = detailRowsFor(event, detail, scan);
  const articles = detail?.possible_explanations ?? [];
  const notes = [carSentence(detail), chanceFor(scan), collectedFor(scan)].filter(Boolean);

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
        <dl className="mt-2 space-y-0.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
              <dt style={{ color: 'var(--text-ghost)' }}>{row.label}</dt>
              <dd className="text-right" style={{ color: 'var(--text-primary)' }}>{row.value}</dd>
            </div>
          ))}
        </dl>

        {detail?.available && (
          <div className="mt-2">
            <EventStudyChart detail={detail} initialWorkingOpen />
          </div>
        )}

        {notes.map((note) => (
          <p key={note} className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
            {note}
          </p>
        ))}

        {articles.length > 0 && (
          <ul className="mt-2 space-y-1">
            {articles.map((/** @type {any} */ article) => (
              <li key={article.article_id} className="text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{article.title}</span>
                {' '}&middot; bm25 {article.scores?.bm25_normalised?.toFixed(2)}, proximity{' '}
                {article.scores?.date_proximity?.toFixed(2)}, entity {article.scores?.entity_match?.toFixed(1)},
                combined {article.scores?.combined?.toFixed(2)}.
                {provenanceFor(article) && ` ${provenanceFor(article)}`}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          Articles are ordered by BM25 term overlap against a fixed ceiling, how close they sit to
          the move in the exchange&apos;s own dates, and whether the headline names the company.
        </p>
      </AnimatedReveal>
    </div>
  );};

/** @param {{ headline: string, onClose?: () => void, children: any }} props */
const Shell = ({ headline, onClose, children }) => (
  <div
    className="glass-surface flex min-h-0 w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-xl shadow-lg"
    style={{ background: 'var(--surface-card)', border: '1px solid var(--border-mid)' }}>
    <div className="flex shrink-0 items-start gap-2 p-4 pb-2">
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
    <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
  </div>
);

/**
 * @param {{
 *   event: any,
 *   detail?: any,
 *   pending?: boolean,
 *   scan?: any,
 *   onClose?: () => void,
 *   onAsk?: (question: string) => void,
 * }} props
 */
const EventPopover = ({ event, detail = null, pending = false, scan = null, onClose, onAsk }) => {
  const top = headlineFor(event);
  if (!event || !top) return null;

  const usable = detail?.error ? null : detail;
  const fell = event.return_pct < 0;
  const impact = impactFor(usable);
  const unusual = unusualnessFor(event);
  const after = afterEventFor(usable);
  const breadth = breadthFor(event, usable);
  const news = newsFor(usable);

  return (
    <Shell headline={top.headline} onClose={onClose}>
      <div className="flex items-baseline gap-3">
        <span
          className="font-mono text-[22px] font-semibold"
          style={{ color: fell ? 'var(--signal-negative)' : 'var(--signal-positive)' }}>
          {top.move}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{top.date}</span>
      </div>

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

      {impact && (
        <Section title="Impact on your portfolio">
          <Body>{impact}</Body>
        </Section>
      )}

      <Section title="How unusual was this?">
        {unusual?.label && <Chip>{unusual.label}</Chip>}
        <div className="mt-1.5 space-y-1">
          {(unusual?.lines ?? []).map((line) => <Body key={line}>{line}</Body>)}
        </div>
        <MarketPart market={marketFor(usable)} />
        {breadth && (
          <p className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
            {breadth}
          </p>
        )}
        {after && (
          <p className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
            {after}
          </p>
        )}
      </Section>

      {news && (
        <Section title="What might explain it?">
          <News news={news} />
        </Section>
      )}

      <button
        type="button"
        onClick={() => onAsk?.(buildEventQuestion(event, usable))}
        className={ASK_BUTTON_CLASS}
        style={ASK_BUTTON_STYLE}>
        Explore possible causes
      </button>

      {usable && <Details event={event} detail={usable} scan={scan} />}
    </Shell>
  );
};

export default EventPopover;
