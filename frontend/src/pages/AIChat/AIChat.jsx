import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {Sparkles, Plus, Pencil, Trash2, MessageSquare, Search, Copy, Check, PanelLeftClose, X, Send, RefreshCw, PanelLeftOpen} from 'lucide-react';

import Button from '../../components/common/Button/Button';
import useAuth from '../../hooks/useAuth';
import useChat from '../../hooks/useChat';
import { useThemeContext } from '../../context/ThemeContext';

/**
 * @typedef {{id: number | string, role: 'user' | 'assistant', text: string, at: Date, failed?: boolean}} ChatMessage
 * @typedef {{id: number, title: string, updated_at: string}} Conversation
 * @typedef {{border: string, panelBg: string, bubbleBg: string, bubbleBorder: string, activeBg: string}} Palette
 */

const SUGGESTED_PROMPTS = [
  'How is MTN doing?',
  "Please show me some of the financial news",
  'How is my portfolio performing compared to the JSE benchmark?'
];

const CONTENT_MAX = 'max-w-[860px]';
const PANEL_WIDTH = 'w-[280px] min-w-[240px] max-w-[860px]';
const HOVER = 'transition-colors duration-150 hover:bg-[var(--surface-hover)]';
const COMPOSER_MAX_ROWS = 1500;
const COPIED_LABEL_MS = 3200;
const SWEEP_MS = 3200;


/**
 * @param {boolean} isLight
 * @returns {Palette}
 */
const paletteFor = (isLight) => ({
    border: isLight ? '#d6d1c6' : 'var(--border-subtle)',
    panelBg: isLight ? '#f2f0ea' : 'var(--surface-base)',
    bubbleBg: isLight ? '#ebe7de' : '#07080b',
    bubbleBorder: isLight ? '#dad4c8' : 'var(--border-mid)',
    activeBg: isLight ? 'rgba(255, 107, 0, 0.13)' : 'rgba(255, 107, 0, 0.14)',
});


/**@param {string} value*/
const signalColour = (value) => {
  if (value.startsWith('+')) return 'var(--signal-positive)';
  if (value.startsWith('-')) return 'var(--signal-negative)';
  return 'var(--text-primary)';
};


/** @param {string} text */
const richText = (text) =>
  text.split(/(\s+)/).map((inputWord, i) =>
    /\d/.test(inputWord)  ? (<span key={i} style={{fontFamily: 'var(--font-mono)', color: signalColour(inputWord)}}>{inputWord}</span>) : (inputWord));


/** @param {any} children */
const withRich = (children) =>
  React.Children.map(children, (child) => (typeof child === 'string' ? richText(child) : child));


/** 
 * @param {string} text 
 * @returns {Promise<boolean>}
*/
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** @param {Date} d */
const timeLabel = (d) =>
  d.toLocaleTimeString('en-ZA', {hour: '2-digit', minute: '2-digit', hour12: false});


/** @param {Date} d */
const dayLabel = (d) => {
  const todayDate = new Date();
  const yesterday = new Date();

  yesterday.setDate(todayDate.getDate() - 1);

  if (d.toDateString() === todayDate.toDateString()) {
    return 'Today';
  };

  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  };

  return d.toLocaleDateString('en-ZA', {day: 'numeric', month: 'long', year: 'numeric'});
};


/** @param {string|undefined} iso */
const stampLabel = (iso) => {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return '';
  if (d.toDateString() === new Date().toDateString()) {
    return timeLabel(d);
  }

  return `${d.toLocaleDateString('en-ZA',{weekday: 'short'})} ${timeLabel(d)}`;
};


//loader
const ReplyLoader = () => {
  /**@type {React.MutableRefObject<HTMLSpanElement|null>}*/
  const loaderIcon = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    let frame = 0;
    const start = performance.now();

    /** @param {number} now */
    const loop = (now) => {
      const angle = (((now - start) % SWEEP_MS) / SWEEP_MS) * Math.PI * 2;
      const x = 10 * Math.sin(angle);
      const y = 4 * Math.sin(angle * 2);
      if (loaderIcon.current) loaderIcon.current.style.transform = `translate(${x}px, ${y}px)`;
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      aria-live="polite"
      aria-label="Assistant is replying"
      style={{display: 'inline-flex', alignItems: 'center',gap: 8, padding: '4px 12px', color: 'var(--text-secondary)'}}>
      <span ref={loaderIcon} style={{ display: 'inline-flex', willChange: 'transform' }}>
        <Search size={20} aria-hidden="true" />
      </span>
    </div>
  );
};


//md
/**
 * @param {Palette} palette
 * @returns {import('react-markdown').Components}
 */
const buildMarkdownComponents = (palette) => {
  /** @param {string} size */
  const heading = (size) => ({fontSize: size, fontWeight: 600, lineHeight: 1.3, marginTop: 20, marginBottom: 8 });

  return {
    h1: ({children}) => <h1 style={heading('1.25rem')}>{children}</h1>,
    h2: ({children}) => <h2 style={heading('1.125rem')}>{children}</h2>,
    h3: ({children}) => <h3 style={heading('1rem')}>{children}</h3>,
    h4: ({children}) => (<h4 style={{ ...heading('1rem'), color: 'var(--text-secondary)' }}>{children}</h4>),
    p: ({children}) => <p style={{ marginBottom: 12 }}>{withRich(children)}</p>,
    strong: ({children}) => <strong>{withRich(children)}</strong>,
    ul: ({children}) => (<ul style={{ listStyle: 'disc', paddingLeft: 20, marginBottom: 12 }}>{children}</ul>),
    ol: ({children}) => (
      <ol style={{ listStyle: 'decimal', paddingLeft: 20, marginBottom: 12 }}>{children}</ol>
    ),
    li: ({children}) => <li style={{ marginBottom: 4 }}>{withRich(children)}</li>,
    a: ({href, children}) => (<a href={href} target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary)', textDecoration: 'underline',textUnderlineOffset: 2,}}>
                                  {children}
                                </a>),
    code: ({children}) => (<code style={{fontFamily: 'var(--font-mono)', fontSize: '0.9em', background: 'var(--surface-inset)', border: `1px solid ${palette.border}`, borderRadius: 4, padding: '1px 5px'}}>
                            {children}
                          </code>),
    pre: ({ children }) => <pre style={{ marginBottom: 12, overflowX: 'auto' }}>{children}</pre>,
    blockquote: ({ children }) => (<blockquote
        style={{borderLeft: '2px solid var(--border-mid)', paddingLeft: 12, marginBottom: 12, color: 'var(--text-secondary)'}}>
        {children}
      </blockquote>),
    hr: () => (<hr style={{ border: 0, borderTop: `1px solid ${palette.border}`, margin: '16px 0' }} />),
    table: ({ children }) => (
      <table
        style={{width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: '0.875rem'}}>
        {children}
      </table>),
    th: ({ children }) => (<th
        style={{ border: `1px solid ${palette.border}`, padding: '6px 8px', textAlign: 'left', background: 'var(--surface-inset)',fontWeight: 600,}}>
        {children}
      </th>),
    td: ({ children }) => (
      <td style={{ border: `1px solid ${palette.border}`, padding: '6px 8px', textAlign: 'left' }}>
        {children}
      </td>),
  };
};


const AIChat = () => {
  const [input, setInput] = useState('');
  const {
    messages, isThinking, conversationId, conversations, regeneratingId,
    sendMessage, regenerate, loadConversation, startNewChat, renameConversation,
    deleteConversation,
  } = /**@type {{messages: ChatMessage[], isThinking: boolean, conversationId: number|null,
        conversations: Conversation[], regeneratingId: string|number|null, sendMessage: Function,
        regenerate: Function, loadConversation: Function, startNewChat: Function,
        renameConversation: Function, deleteConversation: Function}}*/ (useChat());
  const [searchParams, setSearchParams] = useSearchParams();
  /**@type {React.MutableRefObject<HTMLDivElement | null>}*/
  const bottomRef = useRef(null);
  const [editingId, setEditingId] = useState(/**@type {number | null}*/(null));
  const [editTitle, setEditTitle] = useState('');
  /**@type {React.MutableRefObject<HTMLInputElement | null>}*/
  const renameRef = useRef(null)
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [headerEditing, setHeaderEditing] = useState(false);
  const [copiedId, setCopiedId] = useState(/**@type {string|number|null}*/(null));
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const { user } = useAuth();
  /**@type {React.MutableRefObject<HTMLTextAreaElement|null>}*/
  const composerRef = useRef(null);
  /**@type {React.MutableRefObject<number|undefined>}*/
  const copyTimer = useRef(undefined);
  const {theme} = useThemeContext();

  const palette = useMemo(() => paletteFor(theme === 'light'), [theme]);
  const mdComponents = useMemo(() => buildMarkdownComponents(palette), [palette]);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const activeConversation = conversations.find((c) => c.id === conversationId) ?? null;
  const cooling = cooldownLeft > 0;
  const busy = isThinking || regeneratingId !== null;
  const locked = busy || cooling;

  const fieldStyle = {
    background: 'var(--surface-card)',
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    color: 'var(--text-primary)',
    padding: '4px 8px',
    fontSize: '0.875rem',
  };

  const msgBtnStyle = /**@type {React.CSSProperties}*/ ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    padding: '2px 4px',
    color: 'var(--text-secondary)',
    opacity: locked ? 0.45 : 1,
    cursor: locked ? 'not-allowed' : 'pointer',
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking]);

  useEffect(() => {
    if (cooldownUntil === 0) 
      return undefined;

    const tick = () => {
      const lhs = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(lhs);
      if (lhs === 0) 
        setCooldownUntil(0);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (!q) return;

    setInput(q);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      return next;
    }, { replace: true });
  }, [searchParams]);

  useEffect(() => {
    if (editingId !== null) renameRef.current?.focus();
  }, [editingId]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  useEffect(() => {
    const el = composerRef.current;

    if (!el) 
      return;

    el.style.height = 'auto';
    const line = 24;
    el.style.height = `${Math.min(el.scrollHeight, line * COMPOSER_MAX_ROWS)}px`;
  }, [input]);

  /** @param {number} seconds */
  const startCooldown = (seconds) => {
    if (seconds > 0) setCooldownUntil(Date.now() + seconds * 1000);
  };

  /** @param {string} text */
  const submitMessage = (text) => {
    const sent = sendMessage(text);
    if (!sent) return;

    setInput('');
    return sent.then(startCooldown);
  };

  /** @param {ChatMessage} message */
  const retry = (message) => {
    const started = regenerate(message);
    return started ? started.then(startCooldown) : undefined;
  };

  /** @param {ChatMessage} message */
  const copyMessage = async (message) => {
    const ok = await copyToClipboard(message.text);
      
    if (!ok) 
      return;

    setCopiedId(message.id);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), COPIED_LABEL_MS);
  };

  /** @param {Conversation} convo */
  const openConversation = (convo) => {
    loadConversation(convo);
    setSheetOpen(false);
  };

  const createNewChat = () => {
    startNewChat();
    setSheetOpen(false);
  };

  /** @param {number} convoId */
  const submitRename = (convoId) => {
    return renameConversation(convoId, editTitle).then(() => {
      setEditingId(null);
      setHeaderEditing(false);
    });
  };

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const handleSubmit = (e) => {
    e.preventDefault();
    submitMessage(input);
  };

  /** @param {React.KeyboardEvent<HTMLTextAreaElement>} e */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage(input);
    }
  };

  /** @param {ChatMessage} message */
  const copyButton = (message) => (
    <button type="button" onClick={() => copyMessage(message)} className={`rounded-lg ${HOVER}`} style={{ ...msgBtnStyle, opacity: 1, cursor: 'pointer' }}>
      
      {copiedId === message.id ? (<Check size={16} aria-hidden="true" />) 
      : (<Copy size={16} aria-hidden="true" />)}
      {copiedId === message.id ? 'Copied' : 'Copy'}
    </button>
  );

  const conversationStyles = {
    button: `flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2 text-left ${HOVER}`,
    icon: "mt-0.5 shrink-0",
    content: "min-w-0 flex-1",
    title: "block break-words text-sm leading-snug",
    date: "mt-1 block text-xs"
  };
  
  const conversationList = (
    <div>
      <div className="flex items-center justify-between px-4 py-4" style={{borderBottom: `1px solid ${palette.border}`}}>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          Conversations
        </h2>
        <button type="button" onClick={() => setPanelOpen(false)} aria-label="Collapse conversations" className={`hidden rounded-lg p-1 sm:block ${HOVER}`} style={{ color: 'var(--text-secondary)' }}>
          <PanelLeftClose size={16}/>
        </button>
        <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close conversations" className={`rounded-lg p-1 sm:hidden ${HOVER}`} style={{ color: 'var(--text-secondary)' }}>
          <X size={16}/>
        </button>
      </div>
      
      <div className = "flex justify-center px-3 py-3">
        <Button type="button" variant="primary" size = "sm" fullWidth onClick={createNewChat} className = "mx-auto max-w-[180px]">
          <Plus size={16} aria-hidden="true"></Plus>
          New Chat
        </Button>
      </div>

      <div className = "convo">
        {conversations.length === 0 ? (
          <p className="flex justify-center errMessg">
            No saved chats yet 
          </p>) 
          : (
          conversations.map((convo) => {
            const isActive = conversationId === convo.id;
            return (<div key={convo.id} className="group mb-1 flex items-start gap-1"
                style={{borderRadius: 8, background: isActive ? palette.activeBg : 'transparent', borderLeft: `2px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`}}>
                {editingId === convo.id ? (
                <form className = "flex  w-full gap-1  py-1" onSubmit={(e) => {
                      e.preventDefault();
                       submitRename(convo.id);}}>

                <input ref={renameRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={ () => setEditingId(null)}  aria-label="Conversation title"  className="min-w-0 flex-1" style={fieldStyle}/>
                  </form>) : (<>
                    <button type="button" onClick={()=> openConversation(convo)} className={conversationStyles.button} style={{ color: 'var(--text-primary)' }}>
                      <MessageSquare  size={16} className={conversationStyles.icon} aria-hidden="true" style={{ color: "var(--text-secondary)" }}/>
                        <span className={conversationStyles.content}>
                        <span className={conversationStyles.title}>
                          {convo.title}
                        </span>
                          <span className={conversationStyles.date} style={{ color: "var(--text-secondary)" }}>
                          {stampLabel(convo.updated_at)}
                          </span>
                        </span>
                    </button>

                    <button type="button" aria-label={`Rename ${convo.title}`}
                      onClick={() => {setEditingId(convo.id); setEditTitle(convo.title);} }
                      className={`mt-2 shrink-0 rounded-lg p-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 ${HOVER}`}
                      style={{ color: 'var(--text-secondary)'}}>
                      <Pencil size={16}/>
                    </button>

                      <button
                        type="button"
                        aria-label={`Delete ${convo.title}`}
                        onClick={() => deleteConversation(convo.id)}
                        className={`mt-2 shrink-0 rounded-lg p-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 ${HOVER}`}
                        style={{color: 'var(--text-secondary)'}}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );

    let lastDay = '';

    return (
      <div className="-m-4 flex h-[calc(100%+2rem)] overflow-hidden" style={{background: 'var(--surface-base)', fontFamily: 'var(--font-primary)'}}>
        {panelOpen && (
          <aside className={`hidden shrink-0 flex-col sm:flex ${PANEL_WIDTH}`}
            style={{
              background: palette.panelBg,
              borderRight: `1px solid ${palette.border}`,
            }}>
            {conversationList}
          </aside>
        )}

        {sheetOpen && (
          <div className="fixed inset-0 z-40 flex sm:hidden">
            <div className="absolute inset-0" style={{background: 'var(--surface-base)', opacity: 0.8}} onClick={() => setSheetOpen(false)} aria-hidden="true"/>
            <aside
              className="relative z-10 flex h-full w-[280px] max-w-[85vw] flex-col"
              style={{ background: 'var(--surface-base)', borderRight: `1px solid ${palette.border}`}}
              aria-label="Conversations">
              {conversationList}
            </aside>
          </div>
        )}

        <div className = "flex min-w-0 flex-1 flex-col">
          <header
            className = "flex shrink-0 items-center justify-between gap-3 px-4 py-4"
            style={{borderBottom: `1px solid ${palette.border}` }} >
            <div className="flex min-w-0 items-center gap-2">
              {!panelOpen && (<button type="button" onClick = { () => 
                  setPanelOpen(true)
                } aria-label="Expand conversations" className ={`hidden rounded-lg p-1 sm:block ${HOVER}`} style = {{ color: 'var(--text-primary)' }}>
                  <PanelLeftOpen size={16}/>
                </button>
              )}

              <button type="button" onClick={() =>  setSheetOpen(true) } aria-label = "Open conversations" className={`rounded-lg p-1 sm:hidden ${HOVER}` } style={{ color: 'var(--text-primary)'}}>
                <MessageSquare size={16}/>
              </button>

              <Sparkles size ={16} aria-hidden = "true" style = {{ color: 'var(--text-primary)' }} />
              
              <h1 className = "truncate text-base font-semibold" style = {{ color: 'var(--text-primary)' }}>
                  AI Assistant
               </h1>
            
            </div>

            {activeConversation && (
              <div className="flex min-w-0 items-center gap-1">
                {headerEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitRename(activeConversation.id);
                    }}>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={() => setHeaderEditing(false)}
                       aria-label="Conversation title" className="w-40" style={fieldStyle}/>
                  </form>
                ) : (
                  <>
                    <span className="truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {activeConversation.title}
                    </span>
                    <button
                      type="button"
                      aria-label="Rename conversation"
                      onClick={() => {
                        setEditTitle(activeConversation.title);
                        setHeaderEditing(true);
                      }}
                      className={`shrink-0 rounded-lg p-1 ${HOVER}`}
                      style={{color: 'var(--text-secondary)'}}>
                      <Pencil size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center">
                <div className={CONTENT_MAX}>
                  <p className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Hello {firstName}
                  </p>
                  <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
                     Type below to get started.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => submitMessage(prompt)}
                        className={`rounded-lg ${HOVER}`}
                        style={{background: 'var(--surface-card)', border: `1px solid ${palette.border}`,
                          color: 'var(--text-primary)', padding: '8px 12px', fontSize: '0.875rem'}}>
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`mx-auto ${CONTENT_MAX} flex-col gap-6 px-4 py-6`}>
                {messages.map((message) => {
                  const day = dayLabel(message.at);
                  const showDay = day !== lastDay;

                  lastDay = day;

                  return (<div key={message.id}>
                      {showDay && (<p className="mb-6 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      {day}
                                  </p>
                      )}

                      {message.role === 'user' ? (
                        <div className="flex flex-col items-end">
                          <div className="text-base"
                            style={{maxWidth: '80%',background: palette.bubbleBg, border: `1px solid ${palette.bubbleBorder}`, borderRadius: 16,
                              padding: '12px 16px',color: 'var(--text-primary)', lineHeight: 1.625}}>
                            {message.text}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span>{timeLabel(message.at)}</span>
                            {copyButton(message)}
                          </div>
                        </div>
                      ) : (<div>
                          {regeneratingId === message.id ? (
                            <ReplyLoader />) : (<>
                              <div
                                className="text-base"
                                style={{color: 'var(--text-primary)', lineHeight: 1.7, overflowWrap: 'break-word'}}>
                                <ReactMarkdown components={mdComponents}>{message.text}</ReactMarkdown>
                              </div>

                              <div className="mt-2 flex items-center gap-4 text-xs"
                                style={{color: 'var(--text-secondary)'}}>
                                <span>{timeLabel(message.at)}</span>

                                {message.failed ? (<button type="button" onClick={() => retry(message)} disabled={locked}
                                  className={`rounded-lg ${HOVER}`} style={msgBtnStyle}>
                                    <RefreshCw size={16} aria-hidden="true"/>
                                    {cooling ? `Retry in ${cooldownLeft}s` : 'Retry'}
                                  </button>) 
                                : (<>
                                    {copyButton(message)}
                                    <button type="button" onClick={() => retry(message)} disabled={locked}
                                      className={`rounded-lg ${HOVER}`} style={msgBtnStyle}>
                                      <RefreshCw size={16} aria-hidden="true"/>
                                        Regenerate
                                    </button>
                                  </>)}
                              </div>
                            </>)}
                        </div>)}
                      </div>);
                })}

                {isThinking && <ReplyLoader/>}

                <div ref={bottomRef}/>
              </div>)}
          </div>

          <div className="shrink-0 px-6 pb-4 pt-3" style={{ borderTop: `1px solid ${palette.border}` }}>
            <form className={`mx-auto ${CONTENT_MAX}`} onSubmit={handleSubmit}>
              <div style={{display: 'flex', alignItems: 'flex-end', gap: 8, background: 'var(--surface-card)',
                    border: `1px solid ${composerFocused ? 'var(--accent-primary)' : palette.border}`,
                    boxShadow: composerFocused ? '0 0 0 1px var(--accent-primary)' : 'none',
                   borderRadius: 16,padding: '8px 12px'}}>
                <textarea ref={composerRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown} onFocus={() => setComposerFocused(true)} onBlur={() => setComposerFocused(false)}
                  placeholder={cooling ? `Rate limited - ${cooldownLeft}s left` : 'Ask the assistant...'}
                  maxLength={500}  aria-label="Message the assistant"
                   className="min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-6 placeholder:text-[var(--text-secondary)] focus:outline-none"
                  style={{ color: 'var(--text-primary)'}}/>
                <Button type="submit" variant="primary" size="sm" className="min-w-[3.25rem]" disabled={locked || !input.trim()}>
                  {cooling ? (<span className="tabular-nums" aria-label={`Rate limited, ${cooldownLeft} seconds left`}>
                      {cooldownLeft}s </span>) : (<> <Send size={16} aria-hidden="true" />
                        <span className="sr-only">
                          Send
                          </span>
                      </>
                  )}
                </Button>
              </div>
            </form>
            <p className={`mx-auto mt-2 ${CONTENT_MAX} text-xs`} style={{ color: 'var(--text-secondary)' }}>
              AI responses are informational only and not financial advice.
            </p>
        </div>
      </div>
    </div>
  );
};

export default AIChat;