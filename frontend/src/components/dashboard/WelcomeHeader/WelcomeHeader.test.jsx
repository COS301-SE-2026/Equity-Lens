import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WelcomeHeader from './WelcomeHeader';

describe('WelcomeHeader', () => {
  it('greets the user by name', () => {
    render(<WelcomeHeader name="Josh" />);
    expect(screen.getByText('Josh')).toBeInTheDocument();
  });

  it('renders a time-based greeting fragment', () => {
    render(<WelcomeHeader name="Josh" />);
    const greetings = ['Good morning,', 'Good afternoon,', 'Good evening,'];
    const found = greetings.some((g) => screen.queryByText(g));
    expect(found).toBe(true);
  });
});
