import { useCallback, type ChangeEvent, type ClipboardEvent } from 'react';

type UseFormattedInputOptions = {
  value: string;
  onChange: (formatted: string) => void;
  format: (raw: string) => string;
};

/**
 * Hook para inputs mascarados: formata enquanto digita e normaliza colagem.
 */
export function useFormattedInput({ value, onChange, format }: UseFormattedInputOptions) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(format(event.target.value));
    },
    [format, onChange],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      const pasted = event.clipboardData.getData('text');
      onChange(format(pasted));
    },
    [format, onChange],
  );

  return {
    value,
    onChange: handleChange,
    onPaste: handlePaste,
  };
}
