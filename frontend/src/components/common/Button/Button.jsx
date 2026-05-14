const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  className = '',
}) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-semibold rounded-lg transition-all duration-150
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: 'bg-[var(--accent-primary)] text-[#0A0A0A] hover:bg-[var(--accent-hover)]',
    secondary: 'bg-transparent text-[var(--accent-primary)] border border-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]',
    ghost: 'bg-transparent text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]',
    danger: 'bg-[var(--color-danger)] text-white hover:bg-red-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;