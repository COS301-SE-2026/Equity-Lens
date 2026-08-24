import { formatShortCurrency } from '../../../utils/formatters';

/**
 * @param {{ x?: number, y?: number, payload?: { value: number } }} props
 */
const MoneyAxisTick = ({ payload, ...rest }) => (
  <text
    {...rest}
    dy={4}
    className="money-value"
    fontSize={10}
    fontFamily="monospace"
    fill="var(--chart-axis-text)"
  >
    {formatShortCurrency(payload?.value ?? 0)}
  </text>
);

export default MoneyAxisTick;
