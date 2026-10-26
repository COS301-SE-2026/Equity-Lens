import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Maximize2, Minimize2, Send, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { useChatContext } from '../../../context/ChatContext';
import { GlassPanel } from '../../dashboard/shared/GlassPanel';
const DockMarkdown = lazy(() => import('./DockMarkdown'));

const DOCK_DEFAULT = { width: 380, height: 560 };
const TOP_BAR = 72;
const EDGE = 20;
const STEP = 24;
const BIG_STEP = 96;
const PHONE_WIDTH = 768;
const SIZE_KEY = 'equitylens.dock.size';

/** @typedef {{ width: number, height: number }} Size */

/** @returns {Size} */
const maxSize = () => ({
  width: Math.floor(window.innerWidth / 2),
  height: window.innerHeight - TOP_BAR - 2 * EDGE,
});

/** @param {Size} size @returns {Size} */
const clampSize = (size) => {
  const max = maxSize();
  return {
    width: Math.min(Math.max(size.width, DOCK_DEFAULT.width), max.width),
    height: Math.min(Math.max(size.height, DOCK_DEFAULT.height), max.height),
  };
};

/** @returns {Size} */
const savedSize = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SIZE_KEY) ?? 'null');
    if (typeof saved?.width === 'number' && typeof saved?.height === 'number') {
      return clampSize(saved);
    }
  } catch {
    // 
  }
  return clampSize(DOCK_DEFAULT);
};

/** @param {Size} size */
const saveSize = (size) => {
  try {
    window.localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  } catch {
    //
  }
};

/**
 * @param {{ onClose: () => void }} props
 */
const DockPanel = ({ onClose }) => {
  const { messages, isThinking, sendMessage } = useChatContext();

  const [draft, setDraft] = useState('');
  /** @type {React.MutableRefObject<HTMLTextAreaElement | null>} */
  const inputRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const shouldReduceMotion = useReducedMotion();
  const [size, setSize] = useState(savedSize);
  const [phone, setPhone] = useState(() => window.innerWidth < PHONE_WIDTH);
  const dragRef = useRef(/** @type {{ x: number, y: number, size: Size } | null} */ (null));
  const frameRef = useRef(0);

  useEffect(() => {
    const onResize = () => {
      setPhone(window.innerWidth < PHONE_WIDTH);
      setSize((current) => clampSize(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** @param {Size} next */
  const resizeTo = (next) => {
    const clamped = clampSize(next);
    setSize(clamped);
    saveSize(clamped);
  };

  const max = maxSize();
  const expanded = size.width === max.width && size.height === max.height;

  /** @param {import('react').PointerEvent<HTMLButtonElement>} e */
  const startDrag = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, size };
    document.body.style.userSelect = 'none';
  };

  /** @param {import('react').PointerEvent<HTMLButtonElement>} e */
  const drag = (e) => {
    const start = dragRef.current;
    if (!start) return;
    const next = clampSize({
      width: start.size.width + start.x - e.clientX,
      height: start.size.height + start.y - e.clientY,
    });
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => setSize(next));
  };

  /** @param {import('react').PointerEvent<HTMLButtonElement>} e */
  const endDrag = (e) => {
    const start = dragRef.current;
    if (!start) return;
    dragRef.current = null;
    document.body.style.userSelect = '';
    resizeTo({
      width: start.size.width + start.x - e.clientX,
      height: start.size.height + start.y - e.clientY,
    });
  };

  /** @param {import('react').KeyboardEvent<HTMLButtonElement>} e */
  const resizeWithKeys = (e) => {
    const step = e.shiftKey ? BIG_STEP : STEP;
    const moves = {
      ArrowLeft: { width: size.width + step, height: size.height },
      ArrowRight: { width: size.width - step, height: size.height },
      ArrowUp: { width: size.width, height: size.height + step },
      ArrowDown: { width: size.width, height: size.height - step },
      Home: DOCK_DEFAULT,
    };
    const next = moves[/** @type {keyof typeof moves} */ (e.key)];
    if (!next) return;
    e.preventDefault();
    resizeTo(next);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    if (messages[messages.length - 1]?.role === 'user') stickToBottom.current = true;
  }, [messages]);

  useEffect(() => {
    if (listRef.current && stickToBottom.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isThinking, size]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft('');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
        transition={{ duration: 0.18 }}
        className="fixed bottom-5 right-5 z-40"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <GlassPanel
          elevated
          className={`relative flex flex-col ${phone ? 'w-[min(92vw,380px)]' : ''}`}
          style={
            phone ? { height: 'min(70vh, 560px)' } : { width: size.width, height: size.height }
          }
        >
          {!phone && (
            <button
              type="button"
              aria-label="Resize assistant"
              title="Drag to resize, or use the arrow keys"
              onPointerDown={startDrag}
              onPointerMove={drag}
              onPointerUp={endDrag}
              onKeyDown={resizeWithKeys}
              className="absolute left-0 top-0 z-10 h-4 w-4 cursor-nwse-resize touch-none rounded-tl-xl"
              style={{
                borderTop: '2px solid var(--border-strong)',
                borderLeft: '2px solid var(--border-strong)',
              }}
            />
          )}
          <div role="dialog" aria-label="EquityLens Assistant" className="flex h-full flex-col">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="font-mono text-[11px] tracking-widest"style={{ color: 'var(--text-ghost)' }}> 
                EquityLens Assistant
              </span>
              <div className="flex items-center gap-3">
                {!phone && (
                  <button
                    type="button"
                    onClick={() => resizeTo(expanded ? DOCK_DEFAULT : maxSize())}
                    aria-label="Expand assistant"
                    aria-pressed={expanded}
                    title={expanded ? 'Restore' : 'Expand'}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close assistant"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <p className="px-4 pt-2 text-[11px] leading-snug"
              style={{ color: 'var(--text-ghost)' }}
            >
              Answers are AI-generated and can be wrong. Informational only, not financial advice.
            </p>

            <div ref={listRef} onScroll={handleListScroll} className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
              {messages.length === 0 && !isThinking && (
                <p className="p-2 text-[13px]" style={{ color: 'var(--text-ghost)' }}>
                  Ask about your portfolio, a holding, or anything on this page.
                </p>
              )}
              {messages.map((/** @type {any} */ m) => {
                const plain = m.role === 'user' || m.failed;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[85%] break-words rounded-lg px-3 py-2 text-[13px] ${m.role === 'user' ? 'ml-auto' : 'mr-auto'} ${plain ? 'whitespace-pre-wrap' : ''}`}
                    style={{
                      background:
                        m.role === 'user' ? 'var(--accent-subtle)' : 'var(--surface-hover)',
                      color: m.failed ? 'var(--signal-negative)' : 'var(--text-primary)',
                    }}
                  >
                    {plain ? (
                      m.text
                    ) : (
                      <Suspense fallback={m.text}>
                        <DockMarkdown text={m.text} />
                      </Suspense>
                    )}
                  </div>
                );
              })}
              {isThinking && (
                <div
                  className="mr-auto rounded-lg px-3 py-2 text-[13px]"
                  style={{ background: 'var(--surface-hover)', color: 'var(--text-ghost)' }}
                >
                  EquityLens is thinking…
                </div>
              )}
            </div>

            <div className="flex items-end gap-2 p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                aria-label="Message"
                placeholder="Ask a question"
                className="flex-1 resize-none rounded-lg px-2.5 py-2 text-[13px] outline-none"
                style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={!draft.trim() || isThinking}
                aria-label="Send"
                className="pressable flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40"
                style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </GlassPanel>
      </motion.div>
    </AnimatePresence>
  );
};

export default DockPanel;
