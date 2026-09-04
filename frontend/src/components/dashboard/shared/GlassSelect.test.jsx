import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GlassSelect from './GlassSelect';

const sampleOptions = [
  { value: 'option-1', label: 'Option 1' },
  { value: 'option-2', label: 'Option 2' },
  { value: 'option-3', label: 'Option 3' },
];

describe('GlassSelect', () => {
  const defaultProps = {
    id: 'test-select',
    value: null,
    options: sampleOptions,
    onChange: vi.fn(),
  };

  it('renders trigger button with placeholder when no value is provided', () => {
    render(<GlassSelect {...defaultProps} placeholder="Choose an item" />);
    
    const trigger = screen.getByRole('button', { name: /choose an item/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders selected option label when matching value is passed', () => {
    render(<GlassSelect {...defaultProps} value="option-2" />);
    
    expect(screen.getByRole('button')).toHaveTextContent('Option 2');
  });

  it('opens listbox in portal on trigger click and manages ARIA attributes', async () => {
    const user = userEvent.setup();
    render(<GlassSelect {...defaultProps} ariaLabel="Select Category" />);

    const trigger = screen.getByRole('button', { name: /select category/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const listbox = screen.getByRole('listbox', { name: /select category/i });
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Option 1');
  });

  it('handles option selection via click and fires onChange', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<GlassSelect {...defaultProps} onChange={handleChange} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', { name: 'Option 2' }));

    expect(handleChange).toHaveBeenCalledWith('option-2');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates through options using arrow keys', async () => {
  const user = userEvent.setup();
  render(<GlassSelect {...defaultProps} value={null} />);

  const trigger = screen.getByRole('button');
  
  trigger.focus();

  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-activedescendant', 'test-select-option-0');

  await user.keyboard('{ArrowDown}');
  expect(trigger).toHaveAttribute('aria-activedescendant', 'test-select-option-1');

  await user.keyboard('{Enter}');
  expect(defaultProps.onChange).toHaveBeenCalledWith('option-2');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

  it('closes dropdown when pressing Escape', async () => {
    const user = userEvent.setup();
    render(<GlassSelect {...defaultProps} />);

    const trigger = screen.getByRole('button');
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when clicking outside the wrapper and portal list', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <GlassSelect {...defaultProps} />
        <button id="outside-btn">Outside</button>
      </div>
    );

    await user.click(screen.getByRole('button', { name: /select…/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('respects disabled state', async () => {
    const user = userEvent.setup();
    render(<GlassSelect {...defaultProps} disabled />);

    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('positions listbox correctly when direction is "up"', async () => {
    const user = userEvent.setup();

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 240,
      left: 50,
      width: 150,
      height: 40,
      right: 200,
      x: 50,
      y: 200,
      toJSON: () => {},
    });

    render(<GlassSelect {...defaultProps} direction="up" />);

    await user.click(screen.getByRole('button'));
    const listbox = screen.getByRole('listbox');

    expect(listbox).toHaveAttribute('data-direction', 'up');
    expect(listbox.style.bottom).toBe(`${window.innerHeight - 200 + 4}px`);
  });
});