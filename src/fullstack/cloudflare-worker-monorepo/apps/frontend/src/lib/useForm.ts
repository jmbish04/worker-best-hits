import { useState } from "react";

type FormValues = Record<string, string>;

/**
 * Lightweight form helper for controlled components used in the chat panel.
 * It keeps the implementation dependency-free for clarity in this template.
 */
export function useForm<TValues extends FormValues>(initialValues: TValues) {
  const [values, setValues] = useState<TValues>(initialValues);

  return {
    values,
    handleChange: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const { name, value } = event.target;
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    reset: () => setValues(initialValues)
  };
}
