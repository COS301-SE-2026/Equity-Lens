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

  it('shows the conversation it shares with the /ai page', () => {
    chat.dockOpen = true;
    chat.messages = [
      { id: 1, role: 'user', text: 'Why is NPN so big?', at: new Date() },
      { id: 2, role: 'assistant', text: 'It is 41% of your book.', at: new Date() },
    ];
    renderDock();

    expect(screen.getByText('Why is NPN so big?')).toBeInTheDocument();
    expect(screen.getByText('It is 41% of your book.')).toBeInTheDocument();
  });

  it('sends what you type', () => {
    chat.dockOpen = true;
    renderDock();

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'What should I watch?' } });
    fireEvent.click(screen.getByLabelText('Send'));

    expect(chat.sendMessage).toHaveBeenCalledWith('What should I watch?');
  });
});