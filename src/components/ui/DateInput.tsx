import type { ChangeEvent } from 'react';
import { DateField } from './DateField';

export interface DateInputProps {
  id?: string;
  label?: string;
  error?: string;
  value?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  /** `boxed` para formulários, `rule` para barras de filtro. */
  variant?: 'boxed' | 'rule';
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}

/**
 * Campo de data com a API de `<input>` que as telas já usam — por dentro é o
 * `DateField`, que abre o calendário do produto em vez do calendário do
 * navegador. O evento sintético mantém `onChange={(e) => ...e.target.value}`
 * funcionando em quem já chamava assim.
 */
export function DateInput({ onChange, ...props }: DateInputProps) {
  return (
    <DateField
      {...props}
      onChange={(isoDate) =>
        onChange?.({ target: { value: isoDate } } as ChangeEvent<HTMLInputElement>)
      }
    />
  );
}
