import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import GroupBuilder, { loadGroups, resolveGroups, saveGroups } from './GroupBuilder';
import { MAX_GROUPS } from './HoldingSelector';

const HOLDINGS = [
  { ticker: 'NPN.JO', name: 'Naspers', value: 60000, current_price: 300 },
  { ticker: 'SBK.JO', name: 'Standard Bank', value: 25000, current_price: 250 },
  { ticker: 'AGL.JO', name: 'Anglo', value: 15000, current_price: 500 },
];

/** @param {any} props */
const renderBuilder = (props = {}) =>
  render(<GroupBuilder holdings={HOLDINGS} groups={[]} onChange={vi.fn()} {...props} />);

describe('GroupBuilder', () => {
  it('explains what a group is for before there are any', () => {
    renderBuilder();
    expect(screen.getByText(/Put several holdings on one line/)).toBeInTheDocument();
  });

  it('names a new group and leaves it empty', async () => {
    const onChange = vi.fn();
    renderBuilder({ onChange });

    await userEvent.click(screen.getByRole('button', { name: /new group/i }));

    const [next] = onChange.mock.calls[0];
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('Group 1');
    expect(next[0].members).toEqual([]);
  });

  it('shows the group\'s share of the book, not just its member count', () => {
    renderBuilder({ groups: [{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SBK.JO'] }] });

    expect(screen.getByRole('button', { name: '2 · 85.0%' })).toBeInTheDocument();
  });

  it('stops at the cap and says why in place', () => {
    const groups = Array.from({ length: MAX_GROUPS }, (_, i) => ({
      id: `g${i}`, name: `Group ${i + 1}`, members: [],
    }));
    renderBuilder({ groups });

    expect(screen.getByRole('button', { name: /new group/i })).toBeDisabled();
    expect(screen.getByText(new RegExp(`${MAX_GROUPS} groups is the cap`))).toBeInTheDocument();
  });

  it('says a holding may sit in more than one group rather than preventing it', () => {
    renderBuilder();
    expect(screen.getByText('A holding can sit in more than one group.')).toBeInTheDocument();
  });
});

describe('resolveGroups', () => {
  it('reads each member\'s value and price from the live holdings, never from storage', () => {
    const resolved = resolveGroups(
      [{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SBK.JO'] }],
      HOLDINGS,
    );

    expect(resolved[0].members).toEqual([
      { ticker: 'NPN.JO', value: 60000, currentPrice: 300 },
      { ticker: 'SBK.JO', value: 25000, currentPrice: 250 },
    ]);
  });

  it('reports a zero price rather than guessing one, so the group can fall back', () => {
    const resolved = resolveGroups(
      [{ id: 'g1', name: 'Banks', members: ['NPN.JO'] }],
      [{ ticker: 'NPN.JO', name: 'Naspers', value: 60000 }],
    );

    expect(resolved[0].members[0].currentPrice).toBe(0);
  });

  it('drops a stored ticker the user no longer holds', () => {
    const resolved = resolveGroups(
      [{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SOLD.JO'] }],
      HOLDINGS,
    );

    expect(resolved[0].members.map((m) => m.ticker)).toEqual(['NPN.JO']);
  });
});

describe('stored groups', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('survives a round trip', () => {
    saveGroups([{ id: 'g1', name: 'Banks', members: ['NPN.JO'] }]);
    expect(loadGroups()).toEqual([{ id: 'g1', name: 'Banks', members: ['NPN.JO'] }]);
  });

  it('does not trust whatever is in storage', () => {
    window.localStorage.setItem('performance_holding_groups', '{"not":"an array"}');
    expect(loadGroups()).toEqual([]);

    window.localStorage.setItem('performance_holding_groups', 'not json');
    expect(loadGroups()).toEqual([]);

    window.localStorage.setItem(
      'performance_holding_groups',
      JSON.stringify([{ id: 'g1', name: 'Banks', members: ['NPN.JO', 42, null] }]),
    );
    expect(loadGroups()[0].members).toEqual(['NPN.JO']);
  });

  it('keeps working when storage itself throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(loadGroups()).toEqual([]);
    expect(() => saveGroups([{ id: 'g1', name: 'Banks', members: [] }])).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});