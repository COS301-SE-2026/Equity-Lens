import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import BrandStyleGuide from './BrandStyleGuide';

const renderPage = () =>
  render(
    <MemoryRouter>
      <BrandStyleGuide />
    </MemoryRouter>,
  );

describe('BrandStyleGuide', () => {
  it('renders the hero heading', () => {
    renderPage();
    expect(screen.getByText(/the equitylens design language/i)).toBeInTheDocument();
  });

  it('renders every nav section anchor', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Colour' })).toHaveAttribute('href', '#colour');
    expect(screen.getByRole('link', { name: 'Typography' })).toHaveAttribute('href', '#typography');
    expect(screen.getByRole('link', { name: 'Accessibility' })).toHaveAttribute('href', '#a11y');
    expect(screen.getByRole('link', { name: 'Changelog' })).toHaveAttribute('href', '#changelog');
  });

  it('renders the live Button component', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Danger' })).toBeInTheDocument();
  });

  it('discloses known danger-button contrast failure', () => {
    renderPage();
    expect(screen.getByText(/button danger text \(white\) on --color-danger bg/i)).toBeInTheDocument();
    expect(screen.getAllByText('Fails').length).toBeGreaterThan(0);
  });

  it('documents missing Landing.jsx in the changelog', () => {
    renderPage();
    expect(screen.getByText(/not present in this branch's working tree/i)).toBeInTheDocument();
  });

  it('links back to app', () => {
    renderPage();
    expect(screen.getByText(/back to equitylens/i).closest('a')).toHaveAttribute('href', '/');
  });
});
