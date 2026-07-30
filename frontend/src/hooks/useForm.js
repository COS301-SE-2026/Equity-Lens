import { useState } from 'react';

/**
 * 
 * @param {*} initialValues
 * @param {*} validate
 * @returns 
 */
const useForm = (initialValues, validate) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const [touched, setTouched] = useState(/** @type {any} */ ({}));
  const [isSubmitting, setIsSubmitting] = useState(false);


  /**
 * 
 * @param {*} e
 * @returns 
 */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues(/**@param {any} prev*/(prev) => ({ ...prev, [name]: value }));
    if (touched[name] && validate) {
      const validationErrors = validate({ ...values, [name]: value });
      setErrors(validationErrors);
    }
  };

    /**
 * 
 * @param {*} e
 * @returns 
 */
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(/**@param {any} prev*/(prev) => ({ ...prev, [name]: true }));
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
    }
  };

  /**
 * 
 * @param {*} onSubmit
 * @returns 
 */
  const handleSubmit = (onSubmit) => /**@param {any} e*/async (e) => {
    e.preventDefault();
    const allTouched = Object.keys(values).reduce(
      (acc, key) => ({ ...acc, [key]: true }), {}
    );
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