import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ChatDock from '../components/chat/ChatDock/ChatDock';
import useAuth from '../hooks/useAuth';
import AIChat from '../pages/AIChat/AIChat';
import api from '../services/api';

import { ChatProvider, useChatContext } from './ChatContext';
import { ThemeProvider } from './ThemeContext';

vi.mock('../hooks/useAuth');
vi.mock('../services/api');
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: { accessToken: { toString: () => 'test-token' } },
  }),
}));

// the chat page streams its reply over fetch as server-sent events, one frame per event
/** @param {...object} events */
const sseResponse = (...events) => {
  const encoder = new TextEncoder();
  const frames = events.map((e) => encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < frames.length
            ? { done: false, value: frames[i++] }
            : { done: true, value: undefined },
      }),
    },
  };
};

/** @param {number} n which fetch call, 0-based */
const sentBody = (n) => JSON.parse(/** @type {any} */ (globalThis.fetch).mock.calls[n][1].body);

const mockUseAuth = /** @type {any} */ (useAuth);

const DashboardStub = () => <div>Dashboard Page</div>;

const NavStub = () => {
  const navigate = useNavigate();
  return (
    <nav>
      <button onClick={() => navigate('/dashboard')}>Go to dashboard</button>
      <button onClick={() => navigate('/ai')}>Go to AI page</button>
    </nav>
  );
};

const Harness = ({ initialPath = '/dashboard' }) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <ThemeProvider>
      <ChatProvider>
        <NavStub />
        <Routes>
          <Route path="/dashboard" element={<DashboardStub />} />
          <Route path="/ai" element={<AIChat />} />
        </Routes>
      </ChatProvider>
    </ThemeProvider>
  </MemoryRouter>
);

describe('shared conversation across navigation', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { full_name: 'Josh Heath' } });
    /** @type {any} */ (api.get).mockResolvedValue({ data: [] });
    // a fresh stream per call, so the second send gets its own reply
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse(
          { type: 'text', value: 'Technology is your largest sector.' },
          { type: 'done', conversation_id: 'convo-42' },
        ),
      );
  });

  it('streams with the guest token when a guest session is in the tab', async () => {
    sessionStorage.setItem(
      'equitylens.guest',
      JSON.stringify({
        access_token: 'guest-token',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        user: { id: 'guest-1', full_name: 'Guest', is_guest: true },
      }),
    );
    try {
      render(<Harness initialPath="/ai" />);
      fireEvent.change(screen.getByPlaceholderText('Ask the assistant...'), {
        target: { value: 'hello' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
      const headers = /** @type {any} */ (globalThis.fetch).mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer guest-token');
    } finally {
      sessionStorage.clear();
    }
  });

  it('a follow-up message on /ai reuses the conversation_id the first reply returned', async () => {
    render(<Harness initialPath="/ai" />);

    fireEvent.change(screen.getByPlaceholderText('Ask the assistant...'), {
      target: { value: 'Why is Technology so big?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Technology is your largest sector.')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai_chat/stream/'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(sentBody(0)).toMatchObject({
      message: 'Why is Technology so big?',
      conversation_id: null,
    });

    fireEvent.change(screen.getByPlaceholderText('Ask the assistant...'), {
      target: { value: 'follow up' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(sentBody(1)).toMatchObject({ message: 'follow up', conversation_id: 'convo-42' });
  });

  it('conversationId and its messages survive navigating from /ai to /dashboard and back', async () => {
    render(<Harness initialPath="/ai" />);

    fireEvent.change(screen.getByPlaceholderText('Ask the assistant...'), {
      target: { value: 'first message' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('Technology is your largest sector.');
        const threadGets = () =>
        /** @type {import('vitest').Mock} */ (api.get).mock.calls.filter(
        ([url]) => String(url).includes('/messages/'),).length;
    const getCallsAfterSend = threadGets();

    fireEvent.click(screen.getByText('Go to dashboard'));
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('first message')).not.toBeInTheDocument(); // page swapped out, not the state

    fireEvent.click(screen.getByText('Go to AI page'));

    // same thread reappears without a refetch - ChatProvider never unmounted across the hop
    expect(screen.getByText('first message')).toBeInTheDocument();
    expect(screen.getByText('Technology is your largest sector.')).toBeInTheDocument();
        expect(threadGets()).toBe(getCallsAfterSend);
  });
});

const AskFromCard = () => {
  const { openDock } = useChatContext();
  return (
    <button onClick={() => openDock('What moved MTN?', { ticker: 'MTN.JO', date: '2026-07-31' })}>
      Explore possible causes
    </button>
  );
};

describe('asking from an event card', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { full_name: 'Josh Heath' } });
    /** @type {any} */ (api.get).mockResolvedValue({ data: [] });
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () =>
        sseResponse(
          { type: 'text', value: 'Consistent with the trading update.' },
          { type: 'done', conversation_id: 'convo-7' },
        ),
      );
  });

  it('sends the event with the first message only', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ThemeProvider>
          <ChatProvider>
            <AskFromCard />
            <ChatDock />
          </ChatProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Explore possible causes' }));
    await screen.findByText('Consistent with the trading update.');
    expect(sentBody(0)).toMatchObject({
      message: 'What moved MTN?',
      event: { ticker: 'MTN.JO', date: '2026-07-31' },
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'and the sector?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(sentBody(1)).toMatchObject({ message: 'and the sector?', conversation_id: 'convo-7' });
    expect(sentBody(1)).not.toHaveProperty('event');
  });
});
