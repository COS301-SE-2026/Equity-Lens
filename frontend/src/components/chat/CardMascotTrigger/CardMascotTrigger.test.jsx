import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import CardMascotTrigger from './CardMascotTrigger';

const AiStub = () => {
  const [params] = useSearchParams();
  return <div>AI page - q={params.get('q')}</div>;
};

/**
 * @param {{ questions: string[], label?: string, className?: string }} props
 */
const renderTrigger = (props) =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <div className="group relative">
              <CardMascotTrigger {...props} />
            </div>
          }
        />
        <Route path="/ai" element={<AiStub />} />
      </Routes>
    </MemoryRouter>,
  );

describe('CardMascotTrigger', () => {
  it('renders nothing when the caller has no questions for this card', () => {
    const { container } = renderTrigger({ questions: [] });
    expect(container.querySelector('.group')).toBeEmptyDOMElement();
  });

  it('labels itself in visible text rather than relying on an icon alone', () => {
    renderTrigger({
      questions: ['Why is Technology 26% of my portfolio?'],
      label: 'Ask AI about sector allocation',
    });
    expect(screen.getByText('EquityLens Insight')).toBeInTheDocument();
  });

  it('keeps the per-card label as the accessible name, not the shared badge text', () => {
    renderTrigger({
      questions: ['Why is Technology 26% of my portfolio?'],
      label: 'Ask AI about sector allocation',
    });
    const trigger = screen.getByRole('button', { name: 'Ask AI about sector allocation' });
    expect(trigger).toHaveAccessibleName('Ask AI about sector allocation');
    expect(screen.queryByRole('button', { name: /EquityLens Insight/ })).not.toBeInTheDocument();
  });

  it('is reachable by keyboard - a real button, tabbable, activates on click', () => {
    renderTrigger({
      questions: ['Why is Technology 26% of my portfolio?'],
      label: 'Ask AI about sector allocation',
    });
    const trigger = screen.getByRole('button', { name: 'Ask AI about sector allocation' });
    trigger.focus();
    expect(trigger).toHaveFocus();
    expect(trigger.tabIndex).not.toBe(-1);
  });

  it('stays hidden until the card is hovered or the badge itself is focused', () => {
    renderTrigger({
      questions: ['Why is Technology 26% of my portfolio?'],
      label: 'Ask AI about sector allocation',
    });
    const trigger = screen.getByRole('button', { name: 'Ask AI about sector allocation' });
    expect(trigger.className).toContain('opacity-0');
    expect(trigger.className).toContain('group-hover:opacity-100');
    expect(trigger.className).toContain('focus-visible:opacity-100');
  });

  it('navigates straight to /ai with the question prefilled when there is only one', () => {
    renderTrigger({
      questions: ['Why is Technology 26% of my portfolio?'],
      label: 'Ask AI about sector allocation',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about sector allocation' }));
    expect(
      screen.getByText('AI page - q=Why is Technology 26% of my portfolio?'),
    ).toBeInTheDocument();
  });

  it('opens a popover of chips when there is more than one question, and navigates on chip click', () => {
    const questions = [
      'Why is Technology 26% of my portfolio?',
      'Should I diversify away from Technology?',
    ];
    renderTrigger({ questions, label: 'Ask AI about sector allocation' });
    const trigger = screen.getByRole('button', { name: 'Ask AI about sector allocation' });

    fireEvent.click(trigger);
    expect(screen.getByText(questions[0])).toBeInTheDocument();
    expect(screen.getByText(questions[1])).toBeInTheDocument();

    fireEvent.click(screen.getByText(questions[1]));
    expect(screen.getByText(`AI page - q=${questions[1]}`)).toBeInTheDocument();
  });

  it('closes the popover on an outside click without navigating', async () => {
    const questions = [
      'Why is Technology 26% of my portfolio?',
      'Should I diversify away from Technology?',
    ];
    renderTrigger({ questions, label: 'Ask AI about sector allocation' });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI about sector allocation' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});