import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ChatDock from './ChatDock';

const chat = vi.hoisted(() => ({
  messages: /** @type {any[]} */ ([]),
  isThinking: false,
  sendMessage: vi.fn(),
  dockOpen: false,
  openDock: vi.fn(),
  closeDock: vi.fn(),
  pendingQuestion: /** @type {string|null} */ (null),
  clearPendingQuestion: vi.fn(),
}));

vi.mock('../../../context/ChatContext', () => ({ useChatContext: () => chat }));

const renderDock = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ChatDock />
    </MemoryRouter>,
  );

beforeEach(() => {
  chat.messages = [];
  chat.isThinking = false;
  chat.dockOpen = false;
  chat.pendingQuestion = null;
  chat.sendMessage.mockClear();
  chat.openDock.mockClear();
  chat.closeDock.mockClear();
  chat.clearPendingQuestion.mockClear();
});

describe('ChatDock', () => {
  it('opens from the collapsed button', () => {
    renderDock();

    fireEvent.click(screen.getByLabelText('Open EquityLens assistant'));

    expect(chat.openDock).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    chat.dockOpen = true;
    renderDock();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(chat.closeDock).toHaveBeenCalled();
  });

  it('sends a pending question exactly once', async () => {
    chat.dockOpen = true;
    chat.pendingQuestion = 'Why is NPN 41% of my portfolio?';
    const { rerender } = renderDock();

    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ChatDock />
      </MemoryRouter>,
    );

    await waitFor(() => expect(chat.sendMessage).toHaveBeenCalledTimes(1));
    expect(chat.sendMessage).toHaveBeenCalledWith('Why is NPN 41% of my portfolio?');
    expect(chat.clearPendingQuestion).toHaveBeenCalled();
  });

  it('stays out of the way on /ai, where the full page already is', () => {
    chat.dockOpen = true;
    const { container } = renderDock('/ai');

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the conversation it shares with the /ai page', async () => {
    chat.dockOpen = true;
    chat.messages = [
      { id: 1, role: 'user', text: 'Why is NPN so big?', at: new Date() },
      { id: 2, role: 'assistant', text: 'It is 41% of your book.', at: new Date() },
    ];
    renderDock();

    expect(await screen.findByText('Why is NPN so big?')).toBeInTheDocument();
    expect(await screen.findByText('It is 41% of your book.')).toBeInTheDocument();
  });

  it('sends what you type', () => {
    chat.dockOpen = true;
    renderDock();

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'What should I watch?' },
    });
    fireEvent.click(screen.getByLabelText('Send'));

    expect(chat.sendMessage).toHaveBeenCalledWith('What should I watch?');
  });

  it('says under its header that the answers come from an AI', () => {
    chat.dockOpen = true;
    renderDock();

    expect(
      screen.getByText('Answers are AI-generated and can be wrong. Informational only, not financial advice.',),
    ).toBeInTheDocument();
  });

  describe('markdown in replies', () => {
    /** @param {any[]} messages */
    const openWith = (messages) => {
      chat.dockOpen = true;
      chat.messages = messages.map((m, i) => ({ id: i + 1, at: new Date(), ...m }));
      return renderDock();
    };

    it('leaves what the user typed alone', async () => {
      openWith([
        { role: 'user', text: 'is **this** bold?' },
        { role: 'assistant', text: '**ready**' },
      ]);
      await screen.findByText('ready');

      const typed = screen.getByText('is **this** bold?');
      expect(typed.querySelector('strong')).toBeNull();
    });

    it('shows a failed reply as the plain error line, not markdown', async () => {
      openWith([
        { role: 'assistant', text: 'Something went wrong, try again.', failed: true },
        { role: 'assistant', text: '**ready**' },
      ]);
      await screen.findByText('ready');

      expect(screen.getByText('Something went wrong, try again.').tagName).toBe('DIV');
    });

    it('never turns raw html in a reply into an element', async () => {
      const { container } = openWith([
        { role: 'assistant', text: '<img src=x onerror=alert(1)>' },
        { role: 'assistant', text: '**ready**' },
      ]);

      expect((await screen.findByText('ready')).tagName).toBe('STRONG');
      expect(container.querySelector('img')).toBeNull();
    });

    it('opens links in a new tab without handing over the opener', async () => {
      openWith([{ role: 'assistant', text: '[docs](https://example.com)' }]);

      const link = await screen.findByRole('link', { name: 'docs' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    });
  });
});
