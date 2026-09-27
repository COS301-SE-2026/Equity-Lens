import { Check, ChevronDown } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';

import {
  clearHealthConfig,
  getHealthConfig,
  saveHealthConfig,
} from '../../../services/portfolioService';
import Modal from '../../common/Modal/Modal';
import AnimatedReveal from '../shared/AnimatedReveal';
import SecondaryButton from '../shared/SecondaryButton';

/** @type {Record<string, string>} */
const SOURCE_LABEL = {
  custom: 'your own settings',
  preset: 'your choice',
  derived: 'matched to your portfolio',
  default: 'the EquityLens default',
};

const WEIGHT_KEYS = ['weight_sector_concentration', 'weight_single_position', 'weight_breadth'];
const WEIGHT_SUM_TOLERANCE = 0.001;

const CUSTOM_FIELDS = [
  { key: 'weight_sector_concentration', label: 'Sector spread weight', bounds: ['weight_min', 'weight_max'], step: 0.05 },
  { key: 'weight_single_position', label: 'Single-position weight', bounds: ['weight_min', 'weight_max'], step: 0.05 },
  { key: 'weight_breadth', label: 'Breadth weight', bounds: ['weight_min', 'weight_max'], step: 0.05 },
  { key: 'concentration_low', label: 'Flag a holding from (%)', bounds: ['concentration_pct_min', 'concentration_pct_max'], step: 1 },
  { key: 'concentration_high', label: 'High concentration from (%)', bounds: ['concentration_pct_min', 'concentration_pct_max'], step: 1 },
  { key: 'hhi_well_spread', label: 'Sector HHI target', bounds: ['hhi_target_min', 'hhi_target_max'], step: 0.01 },
  { key: 'breadth_target_n', label: 'Effective positions target', bounds: ['breadth_target_min', 'breadth_target_max'], step: 1 },
];

/**
 * @param {Record<string, number>} config
 * @returns {string[] | null}
 */
export const measuresFacts = (config) => {
  const { concentration_low: low, hhi_well_spread: hhi, breadth_target_n: n } = config ?? {};
  if (typeof low !== 'number' || typeof hhi !== 'number' || typeof n !== 'number') return null;
  if (hhi <= 0) return null;
  return [
    `Flags a holding above ${low}%`,
    `targets ~${Math.round(1 / hhi)} evenly-weighted sectors`,
    `${n}+ effective positions`,
  ];};

/**
 * @typedef {{
 *   active: Record<string, number>,
 *   source: string,
 *   preset_key: string | null,
 *   derived_preset_key: string | null,
 *   default_preset_key: string,
 *   presets: { key: string, name: string, description: string, config: Record<string, number> }[],
 *   bounds: Record<string, number>,
 * }} HealthConfig
 * @param {{ open: boolean, onClose: () => void, onChanged?: () => void }} props
 */
const HealthSettingsModal = ({ open, onClose, onChanged }) => {
  const [state, setState] = useState(
    /** @type {{ loading: boolean, error: string | null, data: HealthConfig | null }} */
    ({ loading: true, error: null, data: null }),
  );
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draft, setDraft] = useState(/** @type {Record<string, string>} */ ({}));

  const load = useCallback(async () => {
    try {
      const data = await getHealthConfig();
      setState({ loading: false, error: null, data });
    } catch (err) {
      console.warn('health config fetch failed:', err);
      setState({ loading: false, error: "Couldn't load scoring settings.", data: null });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** @param {() => Promise<HealthConfig>} run */
  const apply = async (run) => {
    setSaving(true);
    try {
      const data = await run();
      setState({ loading: false, error: null, data });
      onChanged?.();
    } catch (err) {
      console.warn('health config save failed:', err);
      const detail = /** @type {any} */ (err)?.response?.data?.detail;
      setState((prev) => ({
        ...prev,
        error:
          typeof detail === 'string'
            ? detail
            : "Couldn't save that. Settings are unchanged.",
      }));
    } finally {
      setSaving(false);
}};

  const data = state.data;

  const openAdvanced = () => {
    if (!advancedOpen && data) {
      setDraft(Object.fromEntries(Object.entries(data.active).map(([k, v]) => [k, String(v)])));
    }
    setAdvancedOpen((o) => !o);
  };

  if (state.loading || !data) return null;

  const presets = data.presets ?? [];
  const activeKey = data.preset_key;
  const active = presets.find((p) => p.key === activeKey);
  const derived = presets.find((p) => p.key === data.derived_preset_key);
  const canRevertToDerived =
    Boolean(data.derived_preset_key) && data.source !== 'derived' && data.source !== 'default';

  const weightTotal = WEIGHT_KEYS.reduce((sum, key) => sum + (Number(draft[key]) || 0), 0);
  const weightsBalanced = Math.abs(weightTotal - 1) <= WEIGHT_SUM_TOLERANCE;

  return (
    <Modal open={open} onClose={onClose} title="Portfolio health scoring" maxWidth="860px">
      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        Scored against{' '}
        <span style={{ color: 'var(--text-primary)' }}>
          {active ? active.name : 'custom settings'}
        </span>
        {data.source !== 'preset' && <> - {SOURCE_LABEL[data.source] ?? data.source}</>}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {presets.map((preset) => {
          const selected = preset.key === activeKey;
          const facts = measuresFacts(preset.config);
          return (
            <button
              key={preset.key}
              type="button"
              aria-pressed={selected}
              disabled={saving}
              onClick={() => apply(() => saveHealthConfig({ preset_key: preset.key }))}
              className="flex h-full flex-col rounded-xl p-3 text-left transition-colors disabled:opacity-50"
              style={{
                border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: selected ? 'rgba(var(--accent-primary-rgb), 0.12)' : 'var(--surface-raised)',
              }}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {preset.name}
                </span>
                {selected && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
              </span>

              <span className="mt-1.5 block flex-1 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                {preset.description}
              </span>

              {facts && (
                <span
                  className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-2 font-mono text-[12px] leading-snug"
                  style={{ color: 'var(--text-ghost)' }}>
                  {facts.map((fact, i) => (
                    <Fragment key={fact}>
                      {i > 0 && <span aria-hidden="true">·</span>}
                      <span className="whitespace-nowrap">{fact}</span>
                    </Fragment>
                  ))}
                </span>
              )}
            </button>);
        })}
      </div>

      <p className="mt-4 text-[13px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
        Presets change what your portfolio is compared to.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {canRevertToDerived && (
          <SecondaryButton size="sm" disabled={saving} onClick={() => apply(() => clearHealthConfig())}>
            Use the one matched to my portfolio{derived ? ` (${derived.name})` : ''}
          </SecondaryButton>
        )}
        {activeKey !== data.default_preset_key && (
          <SecondaryButton
            size="sm"
            disabled={saving}
            onClick={() => apply(() => saveHealthConfig({ preset_key: data.default_preset_key }))}
          >
            Reset to EquityLens
          </SecondaryButton>
        )}
      </div>

      <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <SecondaryButton
          size="sm"
          onClick={openAdvanced}
          expanded={advancedOpen}
          trailing={
            <ChevronDown
              size={10}
              style={{
                transform: advancedOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}/>}>
          Advanced - define your own
        </SecondaryButton>

        <AnimatedReveal show={advancedOpen}>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CUSTOM_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="block text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {field.label}
                  </span>
                  <input
                    type="number"
                    step={field.step}
                    min={data.bounds[field.bounds[0]]}
                    max={data.bounds[field.bounds[1]]}
                    value={draft[field.key] ?? ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg px-2 py-1.5 font-mono text-[12px] outline-none"
                    style={{
                      background: 'var(--surface-inset)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}/>
                </label>
              ))}
            </div>

            <p
              className="font-mono text-[11px]"
              style={{ color: weightsBalanced ? 'var(--text-ghost)' : 'var(--signal-negative)' }}
            >
              Weights total: {Math.round(weightTotal * 100)}%
            </p>

            <SecondaryButton
              size="sm"
              disabled={saving || !weightsBalanced}
              onClick={() =>
                apply(() =>
                  saveHealthConfig({
                    config: Object.fromEntries(
                      CUSTOM_FIELDS.map((f) => [f.key, Number(draft[f.key])]),
                    ),
                  }),)}>
              Save my settings
            </SecondaryButton>
          </div>
        </AnimatedReveal>
      </div>

      {state.error && (
        <p className="mt-3 text-[12px]" style={{ color: 'var(--signal-negative)' }}>
          {state.error}
        </p>
      )}
    </Modal>
  );};

export default HealthSettingsModal;