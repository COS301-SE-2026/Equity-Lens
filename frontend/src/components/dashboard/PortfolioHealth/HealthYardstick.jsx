import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  clearHealthConfig,
  getHealthConfig,
  saveHealthConfig,
} from '../../../services/portfolioService';
import AnimatedReveal from '../shared/AnimatedReveal';
import GlassSelect from '../shared/GlassSelect';
import SecondaryButton from '../shared/SecondaryButton';

/** @type {Record<string, string>} */
const SOURCE_LABEL = {
  custom: 'your own settings',
  preset: 'your choice',
  derived: 'matched to your goal',
  default: 'the EquityLens default',
};

/**
 * @typedef {{
 *   source: string,
 *   preset_key: string,
 *   derived_preset_key: string | null,
 *   default_preset_key: string,
 *   presets: { key: string, name: string, description: string }[],
 * }} HealthConfig
 * @param {{ onChanged?: () => void }} props
 */
const HealthYardstick = ({ onChanged }) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(
    /** @type {{ loading: boolean, error: string | null, data: HealthConfig | null }} */
    ({ loading: true, error: null, data: null }),
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try 
    {
      const data = await getHealthConfig();
      setState({ loading: false, error: null, data });
    } 
    catch (err) {
      console.warn('health config fetch failed:', err);
      setState({ loading: false, error: "Couldn't load your scoring settings.", data: null });
    }}, []);

  useEffect(() => 
    {
    load();
  }, [load]);

  /** @param {() => Promise<HealthConfig>} run */
  const apply = async (run) => {
    setSaving(true);
    try {
      const data = await run();
      setState({ loading: false, error: null, data });
      onChanged?.();
    } catch (err) 
    {
      console.warn('health config save failed:', err);
      setState((prev) => ({ ...prev, error: "Couldn't save that. Your settings are unchanged." }));
    } finally 
    {
      setSaving(false);
    }};

  const data = state.data;
  if (state.loading || !data) return null;

  const presets = data.presets ?? [];
  const activeKey = data.preset_key;
  const active = presets.find((p) => p.key === activeKey);
  const derived = presets.find((p) => p.key === data.derived_preset_key);
  const canRevertToDerived =
    Boolean(data.derived_preset_key) && data.source !== 'derived' && data.source !== 'default';

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          Measured against{' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            {active ? active.name : 'custom settings'}
          </span>{' '}
          - {SOURCE_LABEL[data.source] ?? data.source}
        </span>
        <SecondaryButton
          size="sm"
          onClick={() => setOpen((o) => !o)}
          expanded={open}
          trailing={
            <ChevronDown
              size={10}
              style={{
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}/>}>
          Change
        </SecondaryButton>
      </div>

      <AnimatedReveal show={open}>
        <div className="mt-2 space-y-2">
          <label
            htmlFor="health-preset-picker"
            className="block text-[10px] font-semibold"
            style={{ color: 'var(--text-primary)' }}>
            Score my portfolio as
          </label>
          <GlassSelect
            id="health-preset-picker"
            direction="up"
            disabled={saving}
            value={activeKey}
            placeholder="Custom settings"
            onChange={(key) => apply(() => saveHealthConfig({ preset_key: String(key) }))}
            options={presets.map((p) => ({ value: p.key, label: p.name }))}/>

          {active && (
            <p className="text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
              {active.description}
            </p>)}

          <p className="text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
            Presets change what your portfolio is compared to, not how much risk it carries. The
            underlying percentages above stay the same whichever you pick.
          </p>

          <div className="flex flex-wrap gap-2">
            {canRevertToDerived && (
              <SecondaryButton
                size="sm"
                disabled={saving}
                onClick={() => apply(() => clearHealthConfig())}>
                Use the one matched to my goal{derived ? ` (${derived.name})` : ''}
              </SecondaryButton>
            )}
            {activeKey !== data.default_preset_key && (
              <SecondaryButton
                size="sm"
                disabled={saving}
                onClick={() =>
                  apply(() => saveHealthConfig({ preset_key: data.default_preset_key }))
                }>
                Reset to EquityLens
              </SecondaryButton>
            )}</div>

          {state.error && (
            <p className="text-[10px]" style={{ color: 'var(--signal-negative)' }}>
              {state.error}
            </p>
          )}
        </div>
      </AnimatedReveal>
    </div>
  );
};

export default HealthYardstick;
