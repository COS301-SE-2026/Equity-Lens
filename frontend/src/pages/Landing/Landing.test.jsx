import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGuestModeStatus } from '../../services/authService';

import Landing from './Landing';
import { PAGES } from './landingData';

const mockAuth = vi.hoisted(() => ({ isAuthenticated: false, startGuest: vi.fn() }));
const motionState = vi.hoisted(() => ({ reduce: false }));

vi.mock('../../hooks/useAuth', () => ({
  default: () => mockAuth,
}));

vi.mock('../../services/authService', () => ({
  getGuestModeStatus: vi.fn(),
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = /** @type {typeof import('framer-motion')} */ (await importOriginal());
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route path="/analytics" element={<div>Analytics Page</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

/** @param {string} name */
const card = (name) =>
  within(screen.getByRole('region', { name: 'Six pages, one portfolio.' })).getByRole('button', {
    name,
  });

const tryButton = () => screen.queryByRole('button', { name: /try it now, no sign-up/i });

beforeEach(() => {
  mockAuth.isAuthenticated = false;
  mockAuth.startGuest = vi.fn();
  motionState.reduce = false;
  vi.mocked(getGuestModeStatus).mockResolvedValue(false);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Landing', () => {
  it('has exactly one h1, and it leads with why the portfolio moved', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/why your portfolio moved/i);
  });

  it('links the nav to the sections and the help centre', () => {
    renderPage();
    const nav = within(screen.getByRole('navigation', { name: 'Primary' }));
    expect(nav.getByRole('link', { name: 'Platform' })).toHaveAttribute('href', '#platform');
    expect(nav.getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    expect(nav.getByRole('link', { name: 'Security' })).toHaveAttribute('href', '#security');
    expect(nav.getByRole('link', { name: 'Help Centre' })).toHaveAttribute('href', '/help');
    expect(screen.getByText(/skip to content/i)).toHaveAttribute('href', '#main');
  });

  it('opens the mobile menu and closes it on Escape, handing focus back', () => {
    renderPage();
    const toggle = screen.getByRole('button', { name: /open menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('mobile-nav')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('points Get started at register and Log in at login', async () => {
    renderPage();
    await waitFor(() => expect(getGuestModeStatus).toHaveBeenCalled());
    for (const link of screen.getAllByRole('link', { name: /get started/i })) {
      expect(link).toHaveAttribute('href', '/register');
    }
    for (const link of screen.getAllByRole('link', { name: /^log in$/i })) {
      expect(link).toHaveAttribute('href', '/login');
    }
  });

  it('only offers the guest button when guest mode is on', async () => {
    renderPage();
    await waitFor(() => expect(getGuestModeStatus).toHaveBeenCalled());
    expect(tryButton()).not.toBeInTheDocument();
  });

  it('starts a guest session and lands on the dashboard', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockAuth.startGuest.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    const [heroButton] = await screen.findAllByRole('button', { name: /try it now, no sign-up/i });
    await user.click(heroButton);

    expect(mockAuth.startGuest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
  });

  it('says the demo is busy when the server is at capacity', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockAuth.startGuest.mockRejectedValue({ response: { status: 503 } });
    const user = userEvent.setup();
    renderPage();

    const [heroButton] = await screen.findAllByRole('button', { name: /try it now, no sign-up/i });
    await user.click(heroButton);

    const message = await screen.findByText('The demo is busy, try again in a minute.');
    expect(message.closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.getAllByText('The demo is busy, try again in a minute.')).toHaveLength(1);
  });

  it('gives a signed-in user or guest only the dashboard', async () => {
    mockAuth.isAuthenticated = true;
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    renderPage();
    await waitFor(() => expect(getGuestModeStatus).toHaveBeenCalled());

    expect(screen.getAllByRole('link', { name: /go to dashboard/i }).length).toBeGreaterThan(0);
    expect(tryButton()).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create an account/i })).not.toBeInTheDocument();
  });

  it('opens an anomaly card from the keyboard', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText('Illustrative example')).toBeInTheDocument();

    const dot = screen.getByRole('button', { name: /unusual day, 20 Mar/i });
    dot.focus();
    await user.keyboard('{Enter}');

    expect(dot).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Retail shares rise across the sector')).toBeInTheDocument();
    expect(screen.getByText('Published the day before · about the sector')).toBeInTheDocument();
  });

  it('shows the event card straight away under reduced motion', () => {
    motionState.reduce = true;
    renderPage();

    expect(screen.getByText('Acacia Holdings lowers its full-year guidance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unusual day, 14 Apr/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('blurs the sample amounts with the toggle', async () => {
    const user = userEvent.setup();
    renderPage();
    const toggle = screen.getByRole('button', { name: /blur amounts/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sample-amounts')).toHaveClass('money-blurred');
  });

  it('copies the contact email and says so without an alert', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPage();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await user.click(screen.getByRole('button', { name: /copy email/i }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(screen.getByText('Copied').closest('[role="status"]')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('thebigfivetb5@gmail.com');
    expect(alert).not.toHaveBeenCalled();
  });

  it('uses the new mark, never the old logo.png', () => {
    const { container } = renderPage();
    expect(screen.getByRole('link', { name: 'EquityLens home' })).toBeInTheDocument();
    expect(container.querySelector('img[src="/logo.png"]')).toBeNull();
  });

  it('makes no claim the app cannot back up', async () => {
    renderPage();
    await waitFor(() => expect(document.title).toBe('EquityLens · See why your portfolio moved'));
    const meta = [...document.head.querySelectorAll('meta')].map((m) => m.content).join(' ');
    // alts and callouts are not in the body text, so check the gallery data as well
    const gallery = PAGES.map((p) =>
      [p.name, p.line, p.alt, p.note, ...p.callouts.map((c) => c.text)].join(' '),
    ).join(' ');
    const text = `${document.body.textContent} ${document.title} ${meta} ${gallery}`;

    for (const banned of [
      /flatten/i,
      /look-?through/i,
      /caus(e|ed|es)\b/i,
      /multiple brokers/i,
      /underlying (companies|holdings)/i,
      /Equity[- ]Lens/,
    ]) {
      expect(text).not.toMatch(banned);
    }
  });
  it('shows the six pages in order on a light band', () => {
    const { container } = renderPage();
    const gallery = screen.getByRole('region', { name: 'Six pages, one portfolio.' });
    expect(gallery).toHaveAttribute('data-theme', 'light');

    const titles = within(gallery)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual([
      'Dashboard',
      'Portfolio',
      'Analytics',
      'News',
      'Explore',
      'AI Assistant',
    ]);

    const images = container.querySelectorAll('#platform img');
    expect(images).toHaveLength(4);
    for (const img of images) {
      expect(img).toHaveAttribute('width', '800');
      expect(img).toHaveAttribute('height', '500');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img.getAttribute('alt')).toMatch(/\w+/);
    }
  });

  it('moves focus to a card from its hero chip', async () => {
    const user = userEvent.setup();
    renderPage();
    const chips = screen.getByText('Inside').parentElement;

    await user.click(
      within(/** @type {HTMLElement} */ (chips)).getByRole('button', { name: 'News' }),
    );

    expect(document.getElementById('page-news')).toHaveFocus();
  });

  it('opens a page with its callouts and moves with the arrows and buttons', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(card('Analytics'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    expect(within(dialog).getByText('One row for each holding.')).toBeInTheDocument();
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/showcase/analytics-1440.webp');

    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('heading', { name: 'News' })).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(within(dialog).getByRole('heading', { name: 'Portfolio' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Previous' }));
    expect(within(dialog).getByRole('heading', { name: 'Portfolio' })).toBeInTheDocument();
  });

  it('closes on Escape and hands focus back to the card', async () => {
    const user = userEvent.setup();
    renderPage();
    const explore = card('Explore');

    await user.click(explore);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');

    expect(explore).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('sends a signed-in user straight to the page', async () => {
    mockAuth.isAuthenticated = true;
    const user = userEvent.setup();
    renderPage();

    await user.click(card('Analytics'));

    expect(screen.getByRole('link', { name: 'Open Analytics' })).toHaveAttribute(
      'href',
      '/analytics',
    );
  });

  it('starts a guest session from the dialog when guest mode is on', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockAuth.startGuest.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('button', { name: /try it now, no sign-up/i });

    await user.click(card('Analytics'));
    await user.click(screen.getByRole('button', { name: 'Try it with your own statement' }));

    expect(mockAuth.startGuest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
  });

  it('offers Get started in the dialog when guest mode is off', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(getGuestModeStatus).toHaveBeenCalled());

    await user.click(card('Analytics'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(within(dialog).queryByRole('link', { name: /open analytics/i })).not.toBeInTheDocument();
  });

  it('states each trust fact once, in the security section', () => {
    renderPage();
    for (const fact of [
      /Cape Town/,
      /af-south-1/,
      /authenticator/i,
      /read in your browser/i,
      /delete your data/i,
      /guest data/i,
    ]) {
      expect(screen.getAllByText(fact)).toHaveLength(1);
    }
    const security = screen.getByRole('region', { name: 'Your portfolio stays yours.' });
    expect(within(security).getByText('Hosted in Cape Town')).toBeInTheDocument();
  });

  it('no longer has the trust strip or the features section', () => {
    const { container } = renderPage();
    expect(screen.queryByRole('region', { name: 'At a glance' })).not.toBeInTheDocument();
    expect(container.querySelector('#features')).toBeNull();
  });

  it('ends on the orange band with the start buttons', async () => {
    renderPage();
    await waitFor(() => expect(getGuestModeStatus).toHaveBeenCalled());
    const band = screen.getByRole('region', { name: 'Find out what moved your portfolio.' });
    expect(band).toHaveClass('bg-[var(--accent-primary)]');
    expect(within(band).getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
