import React, { useState, useEffect, useRef, useMemo, useCallback} from 'react';
import ReactMarkdown from 'react-markdown';
import {Sparkles, Plus, Pencil, Trash2, MessageSquare, Search, Copy, Check, PanelLeftClose, X, Send, RefreshCw, PanelLeftOpen} from 'lucide-react';

import Button from '../../components/common/Button/Button';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import api from '../../services/api'

/**
 * @typedef {{id: number | string, role: 'user' | 'assistant', text: string}} ChatMessage
 * @typedef {{id: number, title: string}} Conversation
 * @typedef {{id: number, role: 'user' | 'assistant', content:string}} ApiMessage
 * @typedef {{border: string, panelBg: string, bubbleBg: string, bubbleBorder: string, activeBg: string}} Palette
 */

const SUGGESTED_PROMPTS = [
  'How is MTN doing?',
  "What is the news with Sasol?",
  'How is my portfolio performing compared to the JSE benchmark?'
];

const PANEL_WIDTH = 260;
const HOVER = 'transition-colors duration-150 hover:bg-[var(--surface-hover)]';
const COPIED_LABEL_MS = 3200;
const GENERIC_ERROR = "Something went wrong, try again.";
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
    /\d/.test(inputWord)  ? (<span key={i} style={{fontFamily: 'var(--font-mono)', color: signalColour(word)}}>{word}</span>) : (word));


/** @param {any} children */
const withRich = (children) =>
  React.Children.map(children, (child) => (typeof child === 'string' ? richText(child) : child));


/** 
 * @param {any} err
  * @returns {{text: string, retryAfter: number}}
  */
const readError = (err) => {
  if (err?.response?.status !== 429) return {text: GENERIC_ERROR, retryAfter: 0};

  const errDetail = err.response.data?.detail;
  const retryHeader = Number(err.response.headers?.['retry-after']);
  const retryAfter = Number(errDetail?.retry_after) ||(retryHeader > 0 ? retryHeader : 60);

  return {
    text:
      typeof errDetail?.message === 'string'? errDetail.message: `You have been rate limited. Please try again in ${retryAfter} seconds.`,
       retryAfter
  };
};


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
  const [messages, setMessages] = useState(/**@type {ChatMessage[]}*/ ([]));
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState(/**@type {number | null}*/(null));
  const [conversations, setConversations] = useState(/**@type {Conversation[]}*/([]));
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
  const [regeneratingId, setRegeneratingId] = useState(/**@type {string|number|null}*/(null));
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const { user } = useAuth();
  /**@type {React.MutableRefObject<number|undefined>}*/
  const copyTimer = useRef(undefined);
  const {theme} = useTheme();
  const palette = useMemo(() => paletteFor(theme === 'light'), [theme]);
  const mdComponents = useMemo(() => buildMarkdownComponents(palette), [palette]);
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const cooling = cooldownLeft > 0;
  const locked = busy || cooling;
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

  // fetch conversations 
  useEffect(() => {
    api.get('/ai_chat/conversations/')
      .then((res) => setConversations(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  useEffect(() => {

  /** @param {number} seconds */
  const startCooldown = (seconds) => {
    if (seconds > 0) setCooldownUntil(Date.now() + seconds * 1000);
  };

  /** @param {string} rawText */
  const sendMessage = (rawText) => {
    if (locked) 
      return;

    const text = rawText.trim();

    if (!text) 
      return;

    const userMessage = /**@type {ChatMessage}*/ ({id: Date.now(), role: 'user', text, at: new Date()});
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

          setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', text: res.data.reply, at: new Date() },]);
        .catch((err) => {
          const { text: errorText, retryAfter} = readError(err);
          startCooldown(retryAfter);
          setMessages((prev) => [...prev,{id: Date.now() + 1, role: 'assistant', text: errorText,at: new Date(),failed: true}]);
        }).finally(() => setIsThinking(false));
    };

      .then((res) => {
        const responseMessage = /** @type {ChatMessage} */({id: Date.now() + 1, role: 'assistant', text: res.data.reply,});
        setConversationId(res.data.conversation_id);
        setMessages((prev) => [...prev, responseMessage]);

        api.get('/ai_chat/conversations/')
        .then((res) => setConversations(res.data))
        .catch(() => {});
      })

    //Error checking incase ai call fails
    .catch((err) => {

  /** @param {ChatMessage} message */
  const copyMessage = async (message) => {
    const ok = await copyToClipboard(message.text);
      
    if (!ok) 
      return;

    setCopiedId(message.id);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), COPIED_LABEL_MS);
  };
  
  //now to load the messages
  /**@param {Conversation} convo*/
  const loadConversation = (convo) => {
    setConversationId(convo.id);
    api.get(`/ai_chat/conversations/${convo.id}/messages/`)
      .then((res) => {
        setMessages(
          /**@type {ApiMessage[]} */(res.data).map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content
            at: m.created_at ? new Date(m.created_at) : new Date()}))
        )
      })
      .catch(() => {})
  };

  // Adding a new chat button
  const createNewChat = () => {
    setConversationId(null);
    setMessages([]);
  }

  /**@param {Number} convoId*/
  const renameConversation = (convoId) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      return;
    }

    api.put(`/ai_chat/conversations/${convoId}/`, {title: trimmed})
      .then(() => {
        setConversations((prev) => 
          prev.map((c) => (c.id === convoId ? {...c, title: trimmed} : c))
        );
        setEditingId(null);
      })
      .catch(() => {})
  };

  /**@param {Number} convoId*/
  const deleteConversation = (convoId) => {
    api.delete(`/ai_chat/conversations/${convoId}/`)
      .then(() => {
        setConversations((prev) => 
          prev.filter((c) => c.id !== convoId)
        );
        if (conversationId === convoId) {
          setConversationId(null);
          setMessages([]);
        }
      })
      .catch(() => {});
  };

  /** @param {React.FormEvent<HTMLFormElement>} e*/
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  /** @param {ChatMessage} message */
  const copyButton = (message) => (
    <button type="button" onClick={() => copyMessage(message)} className={`rounded-lg ${HOVER}`} style={{ ...msgBtnStyle, opacity: 1, cursor: 'pointer' }}>
      
      {copiedId === message.id ? (<Check size={16} aria-hidden="true" />) 
      : (<Copy size={16} aria-hidden="true" />)}
      {copiedId === message.id ? 'Copied' : 'Copy'}
    </button>
  );

                          {stampLabel(convo.updated_at)}
    let lastDay = '';

  return (
  <div className="flex h-[calc(100vh-64px)] -m-4">
    <aside className = "flex w-64 flex-col border-r border-[var(--border-subtle)] p-3">
      <button type = "button"
        onClick = {createNewChat}
        className = {`mb-3 w-full truncate rounded-lg border border-[var(--border-default)]
                     bg-[var(--bg-secondary)] px-3 py-2 text-sm font-medium
                     text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]`}>
          + New Chat                  
      </button>
      <div className = "flex-1 overflow-y-auto">
        {conversations.map((convo) => (
          <div key = {convo.id} className = "group mb-1 flex items-center">
            {editingId === convo.id ? (
              <form className = "flex w-full gap-1"
                    onSubmit = {(e) => {
                      e.preventDefault();
                      renameConversation(convo.id);
                    }}>
                <input ref = {renameRef}
                       value = {editTitle}
                       onChange = {(e) => setEditTitle(e.target.value)}
                       onBlur = {() => setEditingId(null)}
                       className = "min-w-0 flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1 text-sm text-[var(--text-primary)]" 
                />    
              </form>
            ) : (
              <>
                {/* Making it an actual button */}
                <button type = "button"
                  onClick = {() => loadConversation(convo)}
                  className = {`mb-1 w-full truncate rounded-lg px-3 py-2 text-left text-sm
                                ${conversationId === convo.id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]': 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                  {convo.title}
                </button>
                <button type = "button"
                        onClick = {() => {
                          setEditingId(convo.id);
                          setEditTitle(convo.title);
                        }}
                        className = "invisible ml-1 rounded px-1 text-sm text-[var(--text-dim)] hover:text-[var(--text-primary)] group-hover:visible">
                  <i className="fa fa-pencil" aria-hidden="true" />
                </button>
                <button type = "button"
                        onClick = {() => deleteConversation(convo.id)}
                        className = "invisible ml-1 rounded px-1 text-sm text-[var(--text-dim)] hover:text-[var(--signal-negative)] group-hover:visible">
                  <i className="fa fa-trash" />
                </button>
        </>
        )}
      </div>
      ))}
    </div>
    </aside>
    <div className = "flex flex-1 flex-col px-4">
    {/* Page heading */}
    <header className="border-b border-[var(--border-subtle)] pb-3">
      <h1 className="text-center text-lg font-semibold text-[var(--text-primary)]">
        AI Assistant
      </h1>
    </header>

    {/* Message area */}
    <div className="flex-1 overflow-y-auto py-4">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-center">
          <div>
            <p className="text-5xl font-semibold text-[var(--text-dim)]">
              Hello {firstName}
            </p>
            <p className="mt-2 text-base font-normal text-[var(--text-dim)]">
              Type below to get started.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-[var(--border-default)]
                             bg-[var(--bg-secondary)] px-3 py-1.5 text-sm
                             text-[var(--text-secondary)]
                             hover:bg-[var(--bg-tertiary)]
                             hover:text-[var(--text-primary)]
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-[var(--accent-primary)]">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

      ) : (
                  const day = dayLabel(message.at);
                  const showDay = day !== lastDay;

                  lastDay = day;

                  return (<div key={message.id}>
                      {showDay && (<p className="mb-6 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      {day}
                                  </p>
                      )}

              {message.role === 'user' ? (
                <p className="max-w-[80%] rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {message.text}
                          <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span>{timeLabel(message.at)}</span>
                            {copyButton(message)}
                              <div className="mt-2 flex items-center gap-4 text-xs"
                                style={{color: 'var(--text-secondary)'}}>
                                <span>{timeLabel(message.at)}</span>
                </div>
                {isThinking && <ReplyLoader/>}
    </div>

    {/* Composer */}
    <div className="border-t border-[var(--border-subtle)] pt-3">
      <form
        className="flex items-center gap-2"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
                  placeholder={cooling ? `Rate limited - ${cooldownLeft}s left` : 'Ask the assistant...'}
          onChange={(e) => setInput(e.target.value)}
          placeholder= "Ask the assistant..."
          maxLength={500}
                <Button type="submit" variant="primary" size="sm" className="min-w-[3.25rem]" disabled={locked || !input.trim()}>
                  {cooling ? (<span className="tabular-nums" aria-label={`Rate limited, ${cooldownLeft} seconds left`}>
                      {cooldownLeft}s </span>) : (<> <Send size={16} aria-hidden="true" />
                        <span className="sr-only">
                          Send
                          </span>
                      </>
                  )}
        </Button>
      </form>
      <p className="mt-2 text-[12px] text-[var(--text-dim)]">
        AI responses are informational only and not financial advice.
      </p>
      </div>
    </div>
  </div>
  );
};

export default AIChat;
