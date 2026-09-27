import ReactMarkdown from 'react-markdown';
const heading = 'mb-1 mt-2 font-semibold first:mt-0';

/** @type {import('react-markdown').Components} */
const components = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-1.5 list-decimal pl-4 last:mb-0">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className={heading}>{children}</h1>,
  h2: ({ children }) => <h2 className={heading}>{children}</h2>,
  h3: ({ children }) => <h3 className={heading}>{children}</h3>,
  h4: ({ children }) => <h4 className={heading}>{children}</h4>,
  code: ({ children }) => (
    <code
      className="rounded px-1"
      style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-inset)' }}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => <pre className="mb-1.5 overflow-x-auto last:mb-0">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote
      className="mb-1.5 border-l-2 pl-2 last:mb-0"
      style={{ borderColor: 'var(--border-mid)', color: 'var(--text-secondary)' }}
    >
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-2"
      style={{ color: 'var(--accent-primary)' }}
    >
      {children}
    </a>
  ),
};

/** @param {{ text: string }} props */
const DockMarkdown = ({ text }) => <ReactMarkdown components={components}>{text}</ReactMarkdown>;

export default DockMarkdown;
