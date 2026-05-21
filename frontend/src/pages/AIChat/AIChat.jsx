import { useState, useEffect, useRef } from 'react';
import Button from '../../components/common/Button/Button';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getMockResponse } from '../../services/aiService';
import StockTickerCard from '../../components/dashboard/StockTickerCard/StockTickerCard';
import useAuth from '../../hooks/useAuth';

const SUGGESTED_PROMPTS = [
  'Show all cards',
  'How is MTN doing?',
  "What's Sasol trading at?",
  'How is my portfolio performing compared to the JSE benchmark?',
];

const AIChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const { user } = useAuth();
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const bottomRef = useRef(null);

  // Keep the newest message (or the typing indicator) in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = (rawText) => {
    if (isThinking) return;
    const text = rawText.trim();
    if (!text) return;
    const userMessage = { id: Date.now(), role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    // Simulate the assistant "thinking" before its reply lands.
    setTimeout(() => {
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        ...getMockResponse(text),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsThinking(false);
    }, 900);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
  <div className="flex h-full flex-col">
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
                    {message.changeText}
                  </p>
                  {message.cards && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {message.cards.map((card) => (
                        <StockTickerCard key={card.ticker} {...card} />
                      ))}
                    </div>
                  )}
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
  );
};

export default AIChat;
