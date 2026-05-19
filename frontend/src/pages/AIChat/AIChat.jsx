import { useState } from 'react';
import Button from '../../components/common/Button/Button';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getMockResponse } from '../../services/aiService';
import useAuth from '../../hooks/useAuth';

const AIChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const { user } = useAuth();
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const userMessage = { id: Date.now(), role: 'user', text };
    const aiMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      ...getMockResponse(text),
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
        <div className="flex h-full items-center justify-center text-center">
          <div>
            <p className="text-5xl font-semibold text-[var(--text-dim)]">
              Hello {firstName}
            </p>
            <p className="mt-2 text-base font-normal text-[var(--text-dim)]">
              Type below to get started.
            </p>
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
              <p
                className={
                  message.role === 'user'
                    ? 'max-w-[80%] rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)]'
                    : 'max-w-[80%] text-sm text-[var(--text-secondary)]'
                }
              >
                {message.trend === 'up' && (
                  <TrendingUp
                    size={16}
                    className="mr-1 inline text-[var(--color-success)]"
                  />
                )}
                {message.trend === 'down' && (
                  <TrendingDown
                    size={16}
                    className="mr-1 inline text-[var(--color-danger)]"
                  />
                )}
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
