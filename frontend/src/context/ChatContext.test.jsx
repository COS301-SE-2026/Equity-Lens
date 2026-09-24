import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import useAuth from '../hooks/useAuth';
import AIChat from '../pages/AIChat/AIChat';
import api from '../services/api';

import { ChatProvider } from './ChatContext';
import { ThemeProvider } from './ThemeContext';

vi.mock('../hooks/useAuth');
vi.mock('../services/api');

const mockUseAuth = /** @type {any} */ (useAuth);

const DashboardStub = () => <div>Dashboard Page</div>;

const NavStub = () => {
  const navigate = useNavigate();
  return (
    <nav>
      <button onClick={() => navigate('/dashboard')}>Go to dashboard</button>
      <button onClick={() => navigate('/ai')}>Go to AI page</button>
    </nav>);};

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
    /** @type {any} */ (api.post).mockResolvedValue({
      data: { reply: 'Technology is your largest sector.', conversation_id: 'convo-42' },
    });
  });

  it('a follow-up message on /ai reuses the conversation_id the first reply returned', async () => {
    render(<Harness initialPath="/ai" />);

    fireEvent.change(screen.getByPlaceholderText('Ask the assistant...'), {
      target: { value: 'Why is Technology so big?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Technology is your largest sector.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ai_chat/', {
      message: 'Why is Technology so big?',
      conversation_id: null,
    });

    fireEvent.change(screen.getByPlaceholderText('Ask the assistant...'), {
      target: { value: 'follow up' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(api.post).toHaveBeenLastCalledWith('/ai_chat/', {
      message: 'follow up',
      conversation_id: 'convo-42',
    });
  });

  it('conversationId and its messages survive navigating from /ai to /dashboard and back', async () => {
    render(<Harness initialPath="/ai" />);

    fireEvent.change(screen.getByPlaceholderText('Ask the assistant...'), {
      target: { value: 'first message' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('Technology is your largest sector.');
    const getCallsAfterSend = /** @type {any} */ (api.get).mock.calls.length;

    fireEvent.click(screen.getByText('Go to dashboard'));
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('first message')).not.toBeInTheDocument(); // page swapped out, not the state

    fireEvent.click(screen.getByText('Go to AI page'));

    // same thread reappears without a refetch - ChatProvider never unmounted across the hop
    expect(screen.getByText('first message')).toBeInTheDocument();
    expect(screen.getByText('Technology is your largest sector.')).toBeInTheDocument();
    expect(/** @type {any} */ (api.get).mock.calls.length).toBe(getCallsAfterSend);
  });
});