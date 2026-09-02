import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import AnimatedReveal from './AnimatedReveal';

const revealed = () => screen.getByTestId('body').parentElement;

describe('AnimatedReveal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <AnimatedReveal show={false}>
        <span data-testid="body">panel body</span>
      </AnimatedReveal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the content clipped, so the height tween has something to grow into', async () => {
    render(
      <AnimatedReveal show>
        <span data-testid="body">panel body</span>
      </AnimatedReveal>,
    );
    await waitFor(() => expect(revealed()).toHaveStyle({ overflow: 'hidden' }));
  });
});
