import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

const LENGTH = 6;

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando os seis dígitos ficam preenchidos — evita um clique a mais no caso comum. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
};

/**
 * Seis casas em régua, uma por dígito.
 *
 * Um campo só de seis caracteres seria menos código, mas some com a contagem: quem digita não vê
 * quantos faltam, e quem erra não sabe onde. Colar do e-mail é o caminho mais comum, então o
 * `onPaste` aceita a mensagem inteira e fica com os dígitos — `123 456`, `123-456` e o código
 * solto entram do mesmo jeito.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
}: CodeInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  function commit(next: string) {
    const cleaned = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(cleaned);
    // Só dispara ao completar de verdade — apagar e redigitar o último dígito não pode reenviar
    // a mesma tentativa e queimar o teto.
    if (cleaned.length === LENGTH && value.length < LENGTH) {
      onComplete?.(cleaned);
    }
    return cleaned;
  }

  function focusSlot(index: number) {
    const clamped = Math.max(0, Math.min(LENGTH - 1, index));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  }

  /**
   * As casas se preenchem da esquerda para a direita, sem buraco no meio.
   *
   * O valor é uma string compacta de dígitos, e as casas são posições — as duas coisas divergiam:
   * digitar na quarta casa com a segunda vazia gravava o dígito na segunda e deixava o foco na
   * quarta, então a pessoa via o número aparecer numa caixa e o cursor em outra. Apagar no meio
   * tinha o mesmo defeito ao contrário.
   *
   * Fechar o buraco resolve a classe inteira: clicar numa casa adiante do preenchido salta para a
   * primeira vazia, e o que se vê é sempre o que está guardado.
   */
  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;

    const at = Math.min(index, value.length);
    const next = (value.slice(0, at) + typed + value.slice(at)).slice(0, LENGTH);
    commit(next);
    focusSlot(Math.min(at + typed.length, LENGTH - 1));
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      // Apagar numa casa vazia recua e apaga a última preenchida — é o que o dedo espera.
      const target = Math.min(index, value.length - 1);
      if (target < 0) return;
      commit(value.slice(0, target) + value.slice(target + 1));
      focusSlot(target);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusSlot(index - 1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusSlot(Math.min(index + 1, value.length));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = commit(event.clipboardData.getData('text'));
    focusSlot(pasted.length);
  }

  return (
    <div className="flex items-end gap-2" role="group" aria-label="Código de confirmação">
      {digits.map((digit, index) => (
        <input
          // A posição é a identidade da casa: não há lista reordenável aqui.
          key={index}
          ref={(node) => {
            inputsRef.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit.trim()}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Dígito ${index + 1} de ${LENGTH}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => {
            if (index > value.length) {
              focusSlot(value.length);
              return;
            }
            event.target.select();
          }}
          className={cn(
            'h-12 w-10 border-0 border-b bg-transparent p-0 text-center font-mono text-[22px]',
            'text-doqyn-text transition-colors focus:outline-none focus:ring-0',
            'border-b-doqyn-border-subtle hover:border-b-doqyn-border-strong',
            'focus:border-b-2 focus:border-b-doqyn-action',
            invalid && 'border-b-doqyn-danger',
            disabled && 'text-doqyn-disabled',
          )}
        />
      ))}
    </div>
  );
}
