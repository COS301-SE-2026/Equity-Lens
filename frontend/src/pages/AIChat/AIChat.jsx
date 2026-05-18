import Button from '../../components/common/Button/Button';

const AIChat = () => (
  <div className="flex h-full flex-col">
    {/* Page heading */}
    <header className="border-b border-[var(--border-subtle)] pb-3">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">
        AI Assistant
      </h1>
    </header>

    {/* Message area */}
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-[var(--text-dim)]">
        Start a conversation below.
      </p>
    </div>

    {/* Composer */}
    <div className="border-t border-[var(--border-subtle)] pt-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="text"
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

export default AIChat;
