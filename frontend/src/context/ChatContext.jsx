import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { API_BASE_URL } from '../utils/constants';

import api from '../services/api';

/**
 * @typedef {{id: number|string, role: 'user'|'assistant', text: string, at: Date, failed?: boolean, savedFacts?: string[], streaming?: boolean}} ChatMessage
 * @typedef {{id: string, title: string}} Conversation
 * @typedef {{id: string, role: 'user'|'assistant', content: string, created_at?: string|null}} ApiMessage
 */
const ChatContext = createContext(/** @type {any} */ (null));

const GENERIC_ERROR = 'Something went wrong, try again.';

const SCOPE_STORAGE_KEY = 'equitylens.chatScope';

/** @returns {Record<string, string|null>} */
const readScopes = () => {
  try {
    return JSON.parse(window.localStorage.getItem(SCOPE_STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }};

/** @param {Record<string, string|null>} scopes */
const persistScopes = (scopes) => {
  try {
    window.localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scopes));
  } catch {
    // storage blocked or full
  }};

/**
 * @param {ChatMessage[]} list
 * @param {ChatMessage} message
 * @returns {ChatMessage[]}
 */
const upsert = (list, message) => (list.some((m) => m.id === message.id)
  ? list.map((m) => (m.id === message.id ? message : m))
  : [...list, message]);

/**
 * @param {any} err
 * @returns {{text: string, retryAfter: number}}
 */
const readError = (err) => {
  if (err?.response?.status !== 429) {
    return { text: GENERIC_ERROR, retryAfter: 0 };
  }

  const detail = err.response.data?.detail;
  const header = Number(err.response.headers?.['retry-after']);
  const retryAfter = Number(detail?.retry_after) || (header > 0 ? header : 60);

  return {
    text:
      typeof detail?.message === 'string'
        ? detail.message
        : `You have been rate limited. Please try again in ${retryAfter} seconds.`,
    retryAfter,
  };
};

/**
 * @param {Response} response
 * @returns {Promise<Error & {response: object}>}
 */
const asAxiosError = async (response) => {
  const data = await response.json().catch(() => ({}));
  const err = /** @type {Error & {response: object}} */ (new Error(String(response.status)));
  err.response = {
    status: response.status,
    data,
    headers: { 'retry-after': response.headers.get('retry-after') },};
  return err;};

/** @param {{ children: import('react').ReactNode }} props */
export const ChatProvider = ({ children }) => {
  const [conversationId, setConversationId] = useState(/** @type {string|null} */ (null));
  const [messages, setMessages] = useState(/** @type {ChatMessage[]} */ ([]));
  const [viewKey, setViewKey] = useState(/** @type {string|null} */ (null));
  const viewKeyRef = useRef(/** @type {string|null} */ (null));
  const [busyKeys, setBusyKeys] = useState(() => /** @type {Set<string>} */ (new Set()));
  const isThinking = viewKey !== null && busyKeys.has(viewKey);
  const [regeneratingId, setRegeneratingId] = useState(/** @type {number|string|null} */ (null));
  const [conversations, setConversations] = useState(/** @type {Conversation[]} */ ([]));
  /** @typedef {{id: string, fact: string, created_at?: string|null}} Memory */
  const [memories, setMemories] = useState(/** @type {Memory[]} */ ([]));
  /** @typedef {{id: string, label: string, portfolio_name: string, account_number: string}} ChatPortfolio */    
  const [portfolios, setPortfolios] = useState(/** @type {ChatPortfolio[]} */ ([]));
  const [portfolioId, setPortfolioId] = useState(/** @type {string|null} */ (null));
  const [savedScopes] = useState(readScopes);
  const scopeByConversation = useRef(savedScopes);

  /** @param {string|null} key */
  const showChat = (key) => {
    viewKeyRef.current = key;
    setViewKey(key);};

  /** @param {string} key @param {boolean} on */
  const markBusy = (key, on) => setBusyKeys((prev) => {
    const next = new Set(prev);
    if (on) {next.add(key);} else {next.delete(key);}
    return next;});

  useEffect(() => {
    api.get('/ai_chat/portfolios/')
      .then((res) => setPortfolios(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!conversationId) {return;}
    scopeByConversation.current[conversationId] = portfolioId;
    persistScopes(scopeByConversation.current);
  }, [conversationId, portfolioId]);


  const refreshConversations = () =>
    api
      .get('/ai_chat/conversations/')
      .then((res) => setConversations(res.data))
      .catch(() => {});
  useEffect(() => {
    refreshConversations();
  }, []);

  const refreshMemories = () =>
    api.get('/ai_chat/memories/')
      .then((res) => setMemories(res.data))
      .catch(() => {});

  /** @param {string} memoryId */
  const deleteMemory = (memoryId) => {
    return api.delete(`/ai_chat/memories/${memoryId}/`)
      .then(() => {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      })
      .catch(() => {});};


  /**
   * @param {string} rawText
   * @returns {Promise<number>|undefined}
   */
  const sendMessageStreaming = (rawText) => {
    if (isThinking) {return;}
    const text = rawText.trim();
    if (!text) {return;}
    return runStream(text);};

  /**
   * @param {string} text
   * @returns {Promise<number>}
   */
  const runStream = async (text) => {
    const stamp = Date.now();
    const startedIn = conversationId;
    const scope = portfolioId;
    const streamKey = startedIn ?? `pending-${stamp}`;
    const onScreen = () => viewKeyRef.current === streamKey;

    const userMessage = /** @type {ChatMessage} */ ({
      id: `u-${stamp}`, role: 'user', text, at: new Date() });
    let replyText = '';
    let replyAt = new Date();
    let replyStatus = /** @type {'none'|'streaming'|'done'|'failed'} */ ('none');

    const draw = () => {
      if (!onScreen()) {return;}
      setMessages((prev) => {
        const next = upsert(prev, userMessage);
        if (replyStatus === 'none') {return next;}
        return upsert(next, /** @type {ChatMessage} */ ({
          id: `a-${stamp}`, role: 'assistant', text: replyText, at: replyAt,
          streaming: replyStatus === 'streaming', failed: replyStatus === 'failed' }));});};

    if (!startedIn) {showChat(streamKey);}
    markBusy(streamKey, true);
    draw();

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();

      const response = await fetch(`${API_BASE_URL}/ai_chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: text, conversation_id: startedIn, portfolio_id: scope }) });

      if (!response.ok) {throw await asAxiosError(response);}

      if (!response.body) {
        throw new Error('Streaming response body is unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {break;}

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          if (!frame.startsWith('data: ')) {continue;}

          const event = JSON.parse(frame.slice(6));

          if (event.type === 'text') {
            if (replyStatus === 'none') {replyAt = new Date();}
            replyStatus = 'streaming';
            replyText += event.value;
            draw();
          } else if (event.type === 'done') {
            if (onScreen()) {
              showChat(event.conversation_id);
              setConversationId(event.conversation_id);
            } else if (!startedIn) {
              scopeByConversation.current[event.conversation_id] = scope;
              persistScopes(scopeByConversation.current);
            }
            if (replyStatus === 'streaming') {replyStatus = 'done';}
            markBusy(streamKey, false);
            draw();
          } else if (event.type === 'error') {
            throw new Error(event.value);
          }
        }
      }

      window.setTimeout(() => { refreshConversations(); refreshMemories(); }, 2500);
      await refreshConversations();
      return 0;
    } catch (err) {
      const { text: errorText, retryAfter } = readError(err);
      replyStatus = 'failed';
      replyText = errorText;
      replyAt = new Date();
      draw();
      return retryAfter;
    } finally {
      markBusy(streamKey, false);
      if (replyStatus === 'streaming') {
        replyStatus = 'done';
        draw();
      }
    }};

  /** @param {ChatMessage} message */
  const regenerate = (message) => {
    if (isThinking || regeneratingId !== null) {
      return;
    }
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1 || index !== messages.length - 1) {
      return;}
    const priorUser = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
    if (!priorUser) {
      return;
    }

    const key = viewKeyRef.current;
    const droppedTail = messages.slice(index + 1);
    setMessages((prev) => prev.slice(0, index + 1));
    setRegeneratingId(message.id);

    return api.post('/ai_chat/', {
      message: priorUser.text, conversation_id: conversationId, portfolio_id: portfolioId,
      replace_last: !message.failed })
      .then((res) => {
        if (viewKeyRef.current !== key) {return refreshConversations().then(() => 0);}
        showChat(res.data.conversation_id);
        setConversationId(res.data.conversation_id);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id ? { ...m, text: res.data.reply, at: new Date(), failed: false } : m,
          ),
        );
        return refreshConversations().then(() => 0);
      })
      .catch((err) => {
        const { text: errorText, retryAfter } = readError(err);
        if (viewKeyRef.current === key) {
          setMessages((prev) => [
            ...prev.map((m) => (m.id === message.id ? { ...m, text: errorText, failed: true } : m)),
            ...droppedTail,]);
        }
        return retryAfter;})
      .finally(() => setRegeneratingId(null));};   


  /** @param {Conversation} convo */
  const loadConversation = (convo) => {
    showChat(convo.id);
    setConversationId(convo.id);
    setPortfolioId(scopeByConversation.current[convo.id] ?? null);
    setMessages([]);
    return api.get(`/ai_chat/conversations/${convo.id}/messages/`)
      .then((res) => {
        if (viewKeyRef.current !== convo.id) {return;}
        setMessages(
          /** @type {ApiMessage[]} */ (res.data).map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            at: m.created_at ? new Date(m.created_at) : new Date(),
          })),
        );
      })
      .catch(() => {});
  };

  const startNewChat = () => {
    showChat(null);
    setConversationId(null);
    setPortfolioId(null);
    setMessages([]);};

  /** @param {string} convoId @param {string} title */
  const renameConversation = (convoId, title) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return Promise.resolve();
    }
    return api
      .put(`/ai_chat/conversations/${convoId}/`, { title: trimmed })
      .then(() => {
        setConversations((prev) =>
          prev.map((c) => (c.id === convoId ? { ...c, title: trimmed } : c)),
        );
      })
      .catch(() => {});
  };

  /** @param {string} convoId */
  const deleteConversation = (convoId) => {
    return api
      .delete(`/ai_chat/conversations/${convoId}/`)
      .then(() => {
        setConversations((prev) => prev.filter((c) => c.id !== convoId));
        if (viewKeyRef.current === convoId) {
          showChat(null);
          setConversationId(null);
          setMessages([]);
        }
      })
      .catch(() => {});
  };

  return (
    <ChatContext.Provider
      value={{
        conversationId,
        messages,
        isThinking,
        regeneratingId,
        conversations,
        memories,
        portfolios,
        portfolioId,
        setPortfolioId,
        sendMessageStreaming,
        regenerate,
        loadConversation,
        startNewChat,
        renameConversation,
        deleteConversation,
        refreshMemories,
        deleteMemory
      }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChatContext must be used within ChatProvider');
  return context;
};
