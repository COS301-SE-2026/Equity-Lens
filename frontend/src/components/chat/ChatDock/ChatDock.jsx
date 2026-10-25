import { lazy, Suspense, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { useChatContext } from '../../../context/ChatContext';

const loadDockPanel = () => import('./DockPanel');
const loadDockMarkdown = () => import('./DockMarkdown');
const DockPanel = lazy(loadDockPanel);

const preload = () => {
  loadDockPanel();
  loadDockMarkdown();
};

const ChatDock = () => {
  const { pathname } = useLocation();
  const {
    sendMessage,
    dockOpen,
    openDock,
    closeDock,
    pendingQuestion,
    pendingEvent,
    clearPendingQuestion,
  } = useChatContext();

  /** @type {React.MutableRefObject<HTMLButtonElement | null>} */
  const triggerRef = useRef(null);
  const sentQuestionRef = useRef(/** @type {string|null} */ (null));

  useEffect(() => {
    if (!dockOpen || !pendingQuestion) return;
    if (sentQuestionRef.current === pendingQuestion) return;
    sentQuestionRef.current = pendingQuestion;
    sendMessage(pendingQuestion, pendingEvent);
    clearPendingQuestion();
  }, [dockOpen, pendingQuestion, pendingEvent, sendMessage, clearPendingQuestion]);

  const refocusTrigger = useRef(false);
  useEffect(() => {
    if (!dockOpen && refocusTrigger.current) {
      refocusTrigger.current = false;
      triggerRef.current?.focus();
    }
  }, [dockOpen]);

  const handleClose = () => {
    refocusTrigger.current = true;
    closeDock();
  };

  if (pathname === '/ai') return null;

  if (!dockOpen) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => openDock()}
        onPointerEnter={preload}
        onFocus={preload}
        aria-label="Open EquityLens assistant"
        className="pressable fixed bottom-5 right-5 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg"
        style={{
          background: 'var(--accent-deep)',
          color: 'var(--icon-on-accent)',
        }}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
        </svg>
      </button>);}

  return (
    <Suspense fallback={null}>
      <DockPanel onClose={handleClose} />
    </Suspense>
  );
};

export default ChatDock;