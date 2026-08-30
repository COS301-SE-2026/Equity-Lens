import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

describe('Sidebar', () => {



  it('shows Dashboard on the screen', () => {
    render(
      <MemoryRouter>
        <Sidebar open={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });






  it('it showes the Portfolio on the side', () => {
    render(
      <MemoryRouter>
        <Sidebar open={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });




  it('it showes the News on the side', () => {
    render(
      <MemoryRouter>
        <Sidebar open={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText('News')).toBeInTheDocument();
  });

});