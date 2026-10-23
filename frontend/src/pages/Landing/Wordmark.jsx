import BrandMark from '../../components/common/BrandMark/BrandMark';

const LETTERS = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  letterSpacing: '0.06em',
};

/** @param {{ size?: number }} props */
const Wordmark = ({ size = 36 }) => (
  <span className="inline-flex items-center gap-2.5">
    <BrandMark size={size} />
    <span className="whitespace-nowrap text-[15px]" style={LETTERS}>
      <span className="text-[var(--text-primary)]">EQUITY</span>
      <span className="text-[var(--accent-primary)]">LENS</span>
    </span>
  </span>
);

export default Wordmark;
