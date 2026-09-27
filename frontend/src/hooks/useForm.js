import { useState } from 'react';

/**
 * @template {Record<string, string>} T
 * @param {T} initialValues
 * @param {(values: T) => Record<string, string>} [validate]
 */
const useForm = (initialValues, validate) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [touched, setTouched] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** @param {{ target: { name: string, value: string } }} e */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (touched[name] && validate) {
      const validationErrors = validate({ ...values, [name]: value });
      setErrors(validationErrors);
    }
  };

  /** @param {{ target: { name: string } }} e */
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
    }
  };

  /** @param {(values: T) => Promise<void> | void} onSubmit */
  const handleSubmit = (onSubmit) => async (/** @type {React.FormEvent} */ e) => {
    e.preventDefault();
    const allTouched = Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {});
    setTouched(allTouched);
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  };
};

export default useForm;
