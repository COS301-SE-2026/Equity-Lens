const FormInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="text-sm font-medium text-[var(--text-primary)]"
        >
          {label}
          {required && <span className="text-[var(--color-danger)] ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`
          w-full px-3.5 py-2.5 rounded-lg text-sm
          bg-[var(--bg-secondary)] text-[var(--text-primary)]
          border transition-all duration-150
          placeholder:text-[var(--text-secondary)]
          disabled:opacity-40 disabled:cursor-not-allowed
          ${error
            ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
            : 'border-[var(--border-default)] focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_rgba(255,184,0,0.15)]'
          }
          focus:outline-none
        `}
      />
      {error && (
        <p
          id={`${name}-error`}
          className="text-xs text-[var(--color-danger)] mt-0.5"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default FormInput;