/**
 * @param {{ children: React.ReactNode, className?: string, as?: keyof JSX.IntrinsicElements }} props
 */
const Money = ({ children, className = '', as: Tag = 'span', ...rest }) => (
  <Tag className={`money-value ${className}`.trim()} {...rest}>
    {children}
  </Tag>
);

export default Money;