import { createContext, useContext, useState, useEffect } from 'react';

import api from '../services/api';

/**
 * @typedef {{id: number|string, role: 'user'|'assistant', text: string, at: Date, failed?: boolean}} ChatMessage
 * @typedef {{id: string, title: string}} Conversation
 * @typedef {{id: string, role: 'user'|'assistant', content: string, created_at?: string|null}} ApiMessage
 */
const ChatContext = createContext(/** @type {any} */ (null));

const GENERIC_ERROR = 'Something went wrong, try again.';

/**
 * @param {any} err
 * @returns {{text: string, retryAfter: number}}
 */
const readError = (err) => {
  if (err?.response?.status !== 429) {
    return { text: GENERIC_ERROR, retryAfter: 0 };}

  const detail = err.response.data?.detail;
  const header = Number(err.response.headers?.['retry-after']);
  const retryAfter = Number(detail?.retry_after) || (header > 0 ? header : 60);

  return {
    text: typeof detail?.message === 'string'
      ? detail.message
      : `You have been rate limited. Please try again in ${retryAfter} seconds.`,
    retryAfter,};};

/** @param {{ children: import('react').ReactNode }} props */
export const ChatProvider = ({ children }) => {
  const [conversationId, setConversationId] = useState(/** @type {string|null} */ (null));
  const [messages, setMessages] = useState(/** @type {ChatMessage[]} */ ([]));
  const [isThinking, setIsThinking] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(/** @type {number|string|null} */ (null));
  const [conversations, setConversations] = useState(/** @type {Conversation[]} */ ([]));

  const refreshConversations = () =>
    api.get('/ai_chat/conversations/')
      .then((res) => setConversations(res.data))
      .catch(() => {});
  useEffect(() => {
    refreshConversations();
  }, []);

  /** @param {string} rawText */
  const sendMessage = (rawText) => {
    if (isThinking)
      {return;}
    const text = rawText.trim();
    if (!text) {
      return;}
    const userMessage = /** @type {ChatMessage} */ ({
      id: Date.now(), role: 'user', text, at: new Date() });
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);

    return api.post('/ai_chat/', { message: text, conversation_id: conversationId })
      .then((res) => {
        const responseMessage = /** @type {ChatMessage} */ ({
          id: Date.now() + 1,
          role: 'assistant',
          text: res.data.reply,
          at: new Date(),});
        setConversationId(res.data.conversation_id);
        setMessages((prev) => [...prev, responseMessage]);
        return refreshConversations().then(() => 0);})
      .catch((err) => {
        const { text: errorText, retryAfter } = readError(err);
        const errorMessage = /** @type {ChatMessage} */ ({
          id: Date.now() + 1,
          role: 'assistant',
          text: errorText,
          at: new Date(),
          failed: true,});
        setMessages((prev) => [...prev, errorMessage]);
        return retryAfter;})
      .finally(() => setIsThinking(false));};

  /** @param {ChatMessage} message */
  const regenerate = (message) => {
    if (isThinking || regeneratingId !== null) {
      return;}
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) {
      return;}
    const priorUser = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
    if (!priorUser) {
      return;}

    const droppedTail = messages.slice(index + 1);
    setMessages((prev) => prev.slice(0, index + 1));
    setRegeneratingId(message.id);

    return api.post('/ai_chat/', { message: priorUser.text, conversation_id: conversationId })
      .then((res) => {
        setConversationId(res.data.conversation_id);
        setMessages((prev) => prev.map((m) =>
          (m.id === message.id
            ? { ...m, text: res.data.reply, at: new Date(), failed: false }
            : m)),);
        return refreshConversations().then(() => 0);})
      .catch((err) => {
        const { text: errorText, retryAfter } = readError(err);
        setMessages((prev) => [
          ...prev.map((m) => (m.id === message.id ? { ...m, text: errorText, failed: true } : m)),
          ...droppedTail,]);
        return retryAfter;})
      .finally(() => setRegeneratingId(null));};

  /** @param {Conversation} convo */
  const loadConversation = (convo) => {
    setConversationId(convo.id);
    return api.get(`/ai_chat/conversations/${convo.id}/messages/`)
      .then((res) => {
        setMessages(
          /** @type {ApiMessage[]} */ (res.data).map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            at: m.created_at ? new Date(m.created_at) : new Date(),
          })),);})
      .catch(() => {});};

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);};

  /** @param {string} convoId @param {string} title */
  const renameConversation = (convoId, title) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return Promise.resolve();}
    return api.put(`/ai_chat/conversations/${convoId}/`, { title: trimmed })
      .then(() => {
        setConversations((prev) =>
          prev.map((c) => (c.id === convoId ? { ...c, title: trimmed } : c)),
        );})
      .catch(() => {});};

  /** @param {string} convoId */
  const deleteConversation = (convoId) => {
    return api.delete(`/ai_chat/conversations/${convoId}/`)
      .then(() => {
        setConversations((prev) => prev.filter((c) => c.id !== convoId));
        if (conversationId === convoId) {
          setConversationId(null);
          setMessages([]);
        }})
      .catch(() => {});};

  return (
    <ChatContext.Provider
      value={{
        conversationId,
        messages,
        isThinking,
        regeneratingId,
        conversations,
        sendMessage,
        regenerate,
        loadConversation,
        startNewChat,
        renameConversation,
        deleteConversation,
      }}>
      {children}
    </ChatContext.Provider>);};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChatContext must be used within ChatProvider');
  return context;};