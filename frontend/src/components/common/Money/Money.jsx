/**
 * @param {{
 *   children: React.ReactNode,
 *   className?: string,
 *   as?: keyof JSX.IntrinsicElements,
 *   style?: React.CSSProperties,
 * }} props
 */
const Money = ({ children, className = '', as: Tag = 'span', ...rest }) => (
  <Tag className={`money-value ${className}`.trim()} {...rest}>
    {children}
  </Tag>
);

export default Money;