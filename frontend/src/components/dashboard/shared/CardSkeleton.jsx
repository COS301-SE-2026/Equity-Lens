import { GlassPanel, PanelHead } from './GlassPanel';

/** @param {{ label?: string, height?: number }} props */
const CardSkeleton = ({ label = 'Loading', height = 420 }) => (
  <GlassPanel className="flex flex-col" style={{ height }}>
    <PanelHead label={label} />
    <div className="flex-1 animate-pulse space-y-3 p-5">
      <div className="h-6 w-1/3 rounded" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-4 w-2/3 rounded" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-4 w-1/2 rounded" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-24 w-full rounded" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-4 w-3/4 rounded" style={{ background: 'var(--border-subtle)' }} />
    </div>
  </GlassPanel>
);

export default CardSkeleton;
