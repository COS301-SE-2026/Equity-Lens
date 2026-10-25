import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import ChatDock from './ChatDock';

const chat = vi.hoisted(() => ({
  messages: /** @type {any[]} */ ([]),
  isThinking: false,
  sendMessage: vi.fn(),
  dockOpen: false,
  openDock: vi.fn(),
  closeDock: vi.fn(),
  pendingQuestion: /** @type {string|null} */ (null),
  pendingEvent: /** @type {{ ticker: string, date: string }|null} */ (null),
  clearPendingQuestion: vi.fn(),
}));

vi.mock('../../../context/ChatContext', () => ({ useChatContext: () => chat }));

const renderDock = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ChatDock />
    </MemoryRouter>,
  );

// the open dock is its own lazy chunk, so wait for it to arrive
const renderOpenDock = async () => {
  const view = renderDock();
  await screen.findByRole('dialog');
  return view;
};

beforeEach(() => {
  chat.messages = [];
  chat.isThinking = false;
  chat.dockOpen = false;
  chat.pendingQuestion = null;
  chat.pendingEvent = null;
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

  it('closes on Escape', async () => {
    chat.dockOpen = true;
    await renderOpenDock();

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
    expect(chat.sendMessage).toHaveBeenCalledWith('Why is NPN 41% of my portfolio?', null);
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

  it('sends what you type', async () => {
    chat.dockOpen = true;
    await renderOpenDock();

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'What should I watch?' },
    });
    fireEvent.click(screen.getByLabelText('Send'));

    expect(chat.sendMessage).toHaveBeenCalledWith('What should I watch?');
  });

  it('says under its header that the answers come from an AI', async () => {
    chat.dockOpen = true;
    await renderOpenDock();

    expect(
      screen.getByText('Answers are AI-generated and can be wrong. Informational only, not financial advice.',),
    ).toBeInTheDocument();
  });

});

/** @param {number} width @param {number} height */
const viewport = (width, height) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};

const panel = () => /** @type {HTMLElement} */ (screen.getByRole('dialog').parentElement);
const sizeOf = () => ({
  width: parseFloat(panel().style.width),
  height: parseFloat(panel().style.height),
});
const grip = () => screen.getByRole('button', { name: 'Resize assistant' });

/** @param {number} dx @param {number} dy */
const dragBy = (dx, dy) => {
  fireEvent.pointerDown(grip(), { pointerId: 1, clientX: 500, clientY: 500 });
  fireEvent.pointerMove(grip(), { pointerId: 1, clientX: 500 + dx, clientY: 500 + dy });
  fireEvent.pointerUp(grip(), { pointerId: 1, clientX: 500 + dx, clientY: 500 + dy });
};

describe('ChatDock size', () => {
  const realWidth = window.innerWidth;
  const realHeight = window.innerHeight;

  beforeEach(() => {
    chat.dockOpen = true;
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    viewport(1920, 1080);
  });

  afterEach(() => {
    viewport(realWidth, realHeight);
    vi.restoreAllMocks();
  });

  it('grows up and to the left from its corner', async () => {
    await renderOpenDock();
    expect(sizeOf()).toEqual({ width: 380, height: 560 });

    // 1920 x 1080 allows 960 x 968, so a (-200, -100) drag fits
    dragBy(-200, -100);

    expect(sizeOf()).toEqual({ width: 580, height: 660 });
  });

  it('stops at half the width, under the top bar, and never below today', async () => {
    viewport(1366, 768);
    await renderOpenDock();

    dragBy(-2000, -2000);
    // 1366 / 2 = 683 wide, 768 - 72 top bar - 2 x 20 margin = 656 high
    expect(sizeOf()).toEqual({ width: 683, height: 656 });

    dragBy(3000, 3000);
    expect(sizeOf()).toEqual({ width: 380, height: 560 });
  });

  it('resizes from the keyboard', async () => {
    await renderOpenDock();

    fireEvent.keyDown(grip(), { key: 'ArrowLeft' });
    expect(sizeOf()).toEqual({ width: 404, height: 560 });

    fireEvent.keyDown(grip(), { key: 'ArrowUp', shiftKey: true });
    expect(sizeOf()).toEqual({ width: 404, height: 656 });

    fireEvent.keyDown(grip(), { key: 'Home' });
    expect(sizeOf()).toEqual({ width: 380, height: 560 });
  });

  it('expands to the largest size and restores', async () => {
    await renderOpenDock();
    const expand = screen.getByRole('button', { name: 'Expand assistant' });
    expect(expand).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(expand);
    expect(sizeOf()).toEqual({ width: 960, height: 968 });
    expect(expand).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(expand);
    expect(sizeOf()).toEqual({ width: 380, height: 560 });
    expect(expand).toHaveAttribute('aria-pressed', 'false');
  });

  it('remembers the size between visits', async () => {
    const first = await renderOpenDock();
    dragBy(-100, -40);
    first.unmount();

    await renderOpenDock();
    expect(sizeOf()).toEqual({ width: 480, height: 600 });
  });

  it('fits a remembered size into a smaller window, now and when the window shrinks', async () => {
    localStorage.setItem('equitylens.dock.size', JSON.stringify({ width: 900, height: 900 }));
    viewport(1366, 768);
    await renderOpenDock();
    expect(sizeOf()).toEqual({ width: 683, height: 656 });

    act(() => {
      viewport(1024, 700);
      window.dispatchEvent(new Event('resize'));
    });
    // 1024 / 2 = 512, 700 - 72 - 40 = 588
    expect(sizeOf()).toEqual({ width: 512, height: 588 });
  });

  it('still opens when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await renderOpenDock();

    expect(sizeOf()).toEqual({ width: 380, height: 560 });
    fireEvent.keyDown(grip(), { key: 'ArrowLeft' });
    expect(sizeOf()).toEqual({ width: 404, height: 560 });
  });

  it('keeps the phone size with no grip or expand button', async () => {
    viewport(375, 812);
    await renderOpenDock();

    expect(screen.queryByRole('button', { name: 'Resize assistant' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand assistant' })).not.toBeInTheDocument();
    expect(panel()).toHaveClass('w-[min(92vw,380px)]');
    expect(panel().style.width).toBe('');
  });

  it('still closes on Escape and hands focus back to the button that opened it', async () => {
    const view = await renderOpenDock();
    chat.closeDock.mockImplementationOnce(() => {
      chat.dockOpen = false;
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    view.rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ChatDock />
      </MemoryRouter>,
    );

    expect(chat.closeDock).toHaveBeenCalled();
    expect(screen.getByLabelText('Open EquityLens assistant')).toHaveFocus();
  });
});
