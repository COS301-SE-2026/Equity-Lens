import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useChatContext } from '../../../context/ChatContext';
import { GlassPanel } from '../../dashboard/shared/GlassPanel';

const ChatDock = () => {
  const { pathname } = useLocation();
  const {
    messages,
    isThinking,
    sendMessage,
    dockOpen,
    openDock,
    closeDock,
    pendingQuestion,
    clearPendingQuestion,
  } = useChatContext();

  const [draft, setDraft] = useState('');
  /** @type {React.MutableRefObject<HTMLTextAreaElement | null>} */
  const inputRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLButtonElement | null>} */
  const triggerRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const listRef = useRef(null);
  const sentQuestionRef = useRef(/** @type {string|null} */ (null));
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!dockOpen || !pendingQuestion) return;
    if (sentQuestionRef.current === pendingQuestion) return;
    sentQuestionRef.current = pendingQuestion;
    sendMessage(pendingQuestion);
    clearPendingQuestion();
  }, [dockOpen, pendingQuestion, sendMessage, clearPendingQuestion]);

  useEffect(() => {
    if (dockOpen) inputRef.current?.focus();
  }, [dockOpen]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isThinking]);

  const handleClose = () => {
    closeDock();
    triggerRef.current?.focus();
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft('');
  };
  if (pathname === '/ai') return null;

  if (!dockOpen) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => openDock()}
        aria-label="Open EquityLens assistant"
        className="pressable fixed bottom-5 right-5 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg"
        style={{
          background: 'var(--accent-deep)',
          color: 'var(--icon-on-accent)',
        }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
        </svg>
      </button>);}

  return (
    <AnimatePresence>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
        transition={{ duration: 0.18 }}
        className="fixed bottom-5 right-5 z-40"
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
      >
        <GlassPanel
          elevated
          className="flex w-[min(92vw,380px)] flex-col"
          style={{ height: 'min(70vh, 560px)' }}>
          <div
            role="dialog"
            aria-label="EquityLens Assistant"
            className="flex h-full flex-col">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="font-mono text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                EquityLens Assistant
              </span>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close assistant"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={14} />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.length === 0 && !isThinking && (
                <p className="p-2 text-[13px]" style={{ color: 'var(--text-ghost)' }}>
                  Ask about your portfolio, a holding, or anything on this page.
                </p>
              )}
              {messages.map((/** @type {any} */ m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] ${m.role === 'user' ? 'ml-auto' : 'mr-auto'}`}
                  style={{
                    background: m.role === 'user' ? 'var(--accent-subtle)' : 'var(--surface-hover)',
                    color: m.failed ? 'var(--signal-negative)' : 'var(--text-primary)',
                  }}
                >
                  {m.text}
                </div>
              ))}
              {isThinking && (
                <div className="mr-auto rounded-lg px-3 py-2 text-[13px]" style={{ background: 'var(--surface-hover)', color: 'var(--text-ghost)' }}>
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
                style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
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

export default ChatDock;