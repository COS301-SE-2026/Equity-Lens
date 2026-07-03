import { useState, useEffect, useRef } from 'react';
import Button from '../../components/common/Button/Button';
import api from '../../services/api'
import useAuth from '../../hooks/useAuth';

const SUGGESTED_PROMPTS = [
  'How is MTN doing?',
  "What's Sasol trading at?",
  'How is my portfolio performing compared to the JSE benchmark?'
];

const AIChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const { user } = useAuth();
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const bottomRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  //scroll to bottom of new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, isThinking]);

  // fetch conversations 
  useEffect(() => {
    api.get('/ai_chat/conversations/')
      .then((res) => setConversations(res.data))
      .catch(() => {});
  }, []);

  const sendMessage = (rawText) => {
    if (isThinking) return;
    const text = rawText.trim();
    if (!text) return;
    const userMessage = { id: Date.now(), role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    // The ai assistant replying now 
    api.post('/ai_chat/', {message: text, conversation_id: conversationId})
      .then((res) => {
        const responseMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          text: res.data.reply,
        };
        setConversationId(res.data.conversation_id);
        setMessages((prev) => [...prev, responseMessage]);

        api.get('/ai_chat/conversations/')
        .then((res) => setConversations(res.data))
        .catch(() => {});
      })

      //Error checking incase ai call fails
      .catch(() => {
        const errorMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          text: "Something went wrong, try again.",          
        };
        setMessages((prev) => [...prev, errorMessage]);
      })
      .finally(() => setIsThinking(false));
    };
  
  //now to load the messages
  const loadConversation = (convo) => {
    setConversationId(convo.id);
    api.get(`/ai_chat/conversations/${convo.id}/messages/`)
      .then((res) => {
        setMessages(
          res.data.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content
          }))
        )
      })
      .catch(() => {})
  };

  // Adding a new chat button
  const createNewChat = () => {
    setConversationId(null);
    setMessages([]);
  }

  const renameConversation = (convoId) => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;

    api.put(`/ai_chat/conversations/${convoId}/`, {title: trimmed})
      .then(() => {
        setConversations((prev) => 
          prev.map((c) => (c.id === convoId ? {...c, title: trimmed} : c))
        );
        setEditingId(null);
      })
      .catch(() => {})
  };

  const deleteConversation = (convoId) => {
    api.delete(`/ai_chat/conversations/${convoId}/`)
      .then(() => {
        setConversations((prev) => 
          prev.filter((c) => c.id !== convoId)
        );
        if (conversationId == convoId) {
          setConversationId(null);
          setMessages([]);
        }
      })
      .catch(() => {});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

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
                <input autoFocus
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
                  <i className="fa fa-pencil" aria-hidden="true"></i>
                </button>
                <button type = "button"
                        onClick = {() => deleteConversation(convo.id)}
                        className = "invisible ml-1 rounded px-1 text-sm text-[var(--text-dim)] hover:text-red-500 group-hover:visible">
                  <i class="fa fa-trash"></i>
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
                             focus-visible:ring-[var(--accent-primary)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'user' ? (
                <p className="max-w-[80%] rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {message.text}
                </p>
              ) : (
                <div className="max-w-[80%]">
                  <p className="text-sm text-[var(--text-secondary)]">
                    {message.text}
                  </p>
                </div>
              )}
            </li>
          ))}

          {/* Typing indicator while the assistant "thinks" */}
          {isThinking && (
            <li className="flex justify-start">
              <span className="flex items-center gap-1 px-1 py-2">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-2 w-2 animate-bounce rounded-full bg-[var(--text-dim)]"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </li>
          )}
        </ul>
      )}
      <div ref={bottomRef} />
    </div>

    {/* Composer */}
    <div className="border-t border-[var(--border-subtle)] pt-3">
      <form
        className="flex items-center gap-2"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the assistant…"
          maxLength={500}
          className="flex-1 rounded-lg border border-[var(--border-default)]
                     bg-[var(--bg-secondary)] px-3 py-2.5 text-sm
                     text-[var(--text-primary)] placeholder:text-[var(--text-dim)]
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-[var(--accent-primary)]"
        />
        <Button type="submit" variant="primary" disabled={isThinking || !input.trim()}>
          Send
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
