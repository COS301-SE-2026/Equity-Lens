import { useState } from 'react';
import Button from '../../components/common/Button/Button';

const AIChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const userMessage = { id: Date.now(), role: 'user', text };
    const aiMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      text: 'Responses coming soon...',
    };
    setMessages((prev) => [...prev, userMessage, aiMessage]);
    setInput('');
  };

  return (
  <div className="flex h-full flex-col">
    {/* Page heading */}
    <header className="border-b border-[var(--border-subtle)] pb-3">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">
        AI Assistant
      </h1>
    </header>

    {/* Message area */}
    <div className="flex-1 overflow-y-auto py-4">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-[var(--text-dim)]">
            Start a conversation below.
          </p>
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
              <p
                className={
                  message.role === 'user'
                    ? 'max-w-[80%] rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)]'
                    : 'max-w-[80%] text-sm text-[var(--text-secondary)]'
                }
              >
                {message.text}
              </p>
            </li>
          ))}
        </ul>
      )}
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
          className="flex-1 rounded-lg border border-[var(--border-default)]
                     bg-[var(--bg-secondary)] px-3 py-2.5 text-sm
                     text-[var(--text-primary)] placeholder:text-[var(--text-dim)]
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-[var(--accent-primary)]"
        />
        <Button type="submit" variant="primary">
          Send
        </Button>
      </form>
      <p className="mt-2 text-[12px] text-[var(--text-dim)]">
        AI responses are informational only and not financial advice.
      </p>
    </div>
  </div>
  );
};

export default AIChat;
