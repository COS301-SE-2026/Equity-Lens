import { describe, it, expect} from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

describe('Sidebar', () => {

  it('when sidebar is open', () => {
    render(
      <MemoryRouter>
        <Sidebar open={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText(/News/i)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/JSE · LIVE · POPI/i)).toBeInTheDocument();
    expect(screen.getByText(/COS 301 Capstone 2026/i)).toBeInTheDocument();
  });


  it('when sidebar is closed', () => {
    render(
      <MemoryRouter>
        <Sidebar open={false} onClose={() => {() => {}}} />
      </MemoryRouter>
    );

  });



});