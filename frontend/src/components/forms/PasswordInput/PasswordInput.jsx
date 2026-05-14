import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import FormInput from '../FormInput/FormInput';

const PasswordInput = ({
  label = 'Password',
  name = 'password',
  value,
  onChange,
  onBlur,
  error,
  placeholder = 'Enter your password',
  required = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <FormInput
        label={label}
        name={name}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        placeholder={placeholder}
        required={required}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-3 top-9 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

export default PasswordInput;