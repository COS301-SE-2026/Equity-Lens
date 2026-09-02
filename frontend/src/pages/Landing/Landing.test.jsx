import { render, screen, fireEvent, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Landing from './Landing';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return { ...actual, ResponsiveContainer: ({ children }) => <div>{children}</div> };});

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  vi.spyOn(window, 'alert').mockImplementation(() => {});});

describe('Landing', () => {
  it('renders hero headline and CTA', () => {
    renderPage();
    expect(screen.getByText(/see past the surface/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /analyse my portfolio/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /see how it works/i })).toHaveAttribute(
      'href',
      '#simulator',
    );}, 15000);

  it('link for keyboard users', () => {
    renderPage();
    expect(screen.getByText(/skip to content/i)).toHaveAttribute('href', '#main');});

  it('mobile menu toggle works', () => {
    renderPage();
    const toggle = screen.getByRole('button', { name: /open menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );});

  it('renders mission statement', () => {
    renderPage();
    expect(screen.getByText(/our mission/i)).toBeInTheDocument();});

  it('renders the merged why-equity-lens section with enriched rows', () => {
    renderPage();
    expect(screen.getByText(/what you see today/i)).toBeInTheDocument();
    expect(screen.getByText(/what you get instead/i)).toBeInTheDocument();
    expect(screen.getByText(/shows the underlying companies/i)).toBeInTheDocument();
    expect(screen.getByText(/a portfolio health score/i)).toBeInTheDocument();
    expect(screen.getByText(/news tied to your holdings/i)).toBeInTheDocument();
    expect(screen.getByText(/ask it directly/i)).toBeInTheDocument();
    expect(screen.getAllByText(/professional analysts use/i).length).toBeGreaterThan(0);});

  it('simulator renders presets as radios', () => {
    renderPage();
    const group = screen.getByRole('radiogroup', { name: /portfolio allocation/i });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);});

  it('switching presets updates the concentration summary', () => {
    renderPage();
    expect(
      screen.getByText(/no single company makes up more than 5%/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /jse blue-chip portfolio/i }));
    expect(
      screen.getByText(/these five blue-chips make up under 40%/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no single company makes up more than 5%/i),
    ).not.toBeInTheDocument();});

  it('renders flattening engine', () => {
    renderPage();
    expect(screen.getByText(/one market event can hit your whole portfolio/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated portfolio loss/i)).toBeInTheDocument();
    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);});

  it('renders all showcase rows in order', () => {
    renderPage();
    const labels = screen.getAllByText(
      /^(IMPORT PORTFOLIO|LOOK-THROUGH ANALYSIS|PORTFOLIO DASHBOARD|PORTFOLIO ANALYTICS|NEWS CORRELATION|AI PORTFOLIO ASSISTANT)$/,
    );
    expect(labels).toHaveLength(6);});

  it('renders trust bar security points', () => {
    renderPage();
    expect(screen.getByText(/your data stays yours/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no broker credentials/i })).toBeInTheDocument();
    expect(screen.getByText(/encrypted in transit and at rest/i)).toBeInTheDocument();
    expect(screen.getByText(/private to your account/i)).toBeInTheDocument();});

  it('renders final CTA', () => {
    renderPage();
    expect(screen.getByText(/ready to understand/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /analyse my portfolio/i }).length,
    ).toBeGreaterThan(0);});

  it.skip('footer links to help centre and github', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /help centre/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/help'),
    );
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      expect.stringContaining('github.com'),
    );});

  it('footer copies the email address', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('link', { name: /contact/i }));
    await screen.findByText(/email copied/i);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('thebigfivetb5@gmail.com');
  });});

