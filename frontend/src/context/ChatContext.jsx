import { createContext, useContext, useState, useEffect } from 'react';

import api from '../services/api';

/**
 * @typedef {{id: number|string, role: 'user'|'assistant', text: string}} ChatMessage
 * @typedef {{id: string, title: string}} Conversation
 * @typedef {{id: string, role: 'user'|'assistant', content: string}} ApiMessage
 */
const ChatContext = createContext(/** @type {any} */ (null));

/** @param {{ children: import('react').ReactNode }} props */
export const ChatProvider = ({ children }) => {
  const [conversationId, setConversationId] = useState(/** @type {string|null} */ (null));
  const [messages, setMessages] = useState(/** @type {ChatMessage[]} */ ([]));
  const [isThinking, setIsThinking] = useState(false);
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
    const userMessage = /** @type {ChatMessage} */ ({ id: Date.now(), role: 'user', text });
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);

    return api.post('/ai_chat/', { message: text, conversation_id: conversationId })
      .then((res) => {
        const responseMessage = /** @type {ChatMessage} */ ({
          id: Date.now() + 1,
          role: 'assistant',
          text: res.data.reply,});
        setConversationId(res.data.conversation_id);
        setMessages((prev) => [...prev, responseMessage]);
        return refreshConversations();})
      .catch(() => {
        const errorMessage = /** @type {ChatMessage} */ ({
          id: Date.now() + 1,
          role: 'assistant',
          text: 'Something went wrong, try again.',});
        setMessages((prev) => [...prev, errorMessage]);})
      .finally(() => setIsThinking(false));};

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
        conversations,
        sendMessage,
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