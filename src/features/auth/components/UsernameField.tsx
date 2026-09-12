import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

/**
 * O nome de usuário, escolhido no cadastro.
 *
 * **Não é apelido, e não é opcional.** É a identidade pela qual pessoas de outras empresas
 * encontram você — o nome está guardado cifrado e o e-mail só tem hash exato, então o handle é a
 * única coisa que responde a uma busca digitada. Deixá-lo opcional significava que quase ninguém
 * escolheria, e todo mundo seria achado por um nome derivado do e-mail que nunca decidiu usar.
 *
 * A sugestão vem do nome digitado logo acima, para que exigir não vire atrito: quem não se importa
 * aceita o que está lá; quem se importa troca.
 */
const CHECK_URL = '/auth/username-available';

const REASON_KEYS: Record<string, string> = {
  too_short: 'usernameField.reason.tooShort',
  too_long: 'usernameField.reason.tooLong',
  invalid_shape: 'usernameField.reason.invalidShape',
  reserved: 'usernameField.reason.reserved',
  taken: 'usernameField.reason.taken',
};

export function normalizeUsernameInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

export function suggestUsername(firstName: string, lastName: string): string {
  const parts = [firstName, lastName].map(normalizeUsernameInput).filter(Boolean);
  if (!parts.length) return '';
  return parts.join('.').slice(0, 32);
}

export function UsernameField({
  value,
  onChange,
  suggestion,
  onValidityChange,
}: {
  value: string;
  onChange: (username: string) => void;
  /** Derivada do nome digitado acima. Preenche só enquanto ninguém tocou no campo. */
  suggestion?: string;
  onValidityChange?: (valid: boolean) => void;
}) {
  const { t } = useTranslation('auth');

  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [reason, setReason] = useState<string | null>(null);

  const username = normalizeUsernameInput(value);

  // A sugestão acompanha o nome enquanto o campo não foi tocado, e para no instante em que a
  // pessoa digita: sobrescrever a escolha dela porque ela voltou a corrigir o sobrenome seria
  // apagá-la. Parar no primeiro valor preenchido não serviria — o nome é digitado letra a letra,
  // e a sugestão ficaria congelada na primeira delas.
  useEffect(() => {
    if (touched || !suggestion || value === suggestion) return;
    onChange(suggestion);
  }, [onChange, suggestion, touched, value]);

  useEffect(() => {
    if (username.length < 3) {
      setStatus('idle');
      setReason(null);
      onValidityChange?.(false);
      return;
    }

    let cancelled = false;
    setStatus('checking');

    // Espera a digitação parar: conferir a cada tecla gasta uma chamada por letra e pisca a
    // resposta na cara de quem ainda está escrevendo.
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${CHECK_URL}?username=${encodeURIComponent(username)}`);
        const body = (await response.json()) as { available?: boolean; reason?: string };
        if (cancelled) return;

        setStatus(body.available ? 'free' : 'taken');
        setReason(body.available ? null : (body.reason ?? 'taken'));
        onValidityChange?.(body.available === true);
      } catch {
        if (cancelled) return;
        // Sem resposta, não trava o cadastro: o servidor recusa depois se estiver ocupado.
        setStatus('idle');
        setReason(null);
        onValidityChange?.(true);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onValidityChange, username]);

  const feedback = useMemo(() => {
    if (username.length > 0 && username.length < 3) return t('usernameField.reason.tooShort');
    if (status === 'checking') return t('usernameField.checking');
    if (status === 'free') return t('usernameField.available');
    if (status === 'taken') {
      return t(REASON_KEYS[reason ?? 'taken'] ?? 'usernameField.reason.taken');
    }
    return t('usernameField.hint');
  }, [reason, status, username.length, t]);

  return (
    <div>
      <Input
        label={t('usernameField.nomeDeUsuario')}
        value={value}
        onChange={(event) => {
          setTouched(true);
          onChange(normalizeUsernameInput(event.target.value));
        }}
        placeholder={t('usernameField.placeholder')}
        autoComplete="off"
        required
      />
      <span
        className={cn(
          'mt-1 block text-[11px]',
          status === 'free' && 'text-doqyn-accent-active',
          status === 'taken' && 'text-doqyn-warning',
          status !== 'free' && status !== 'taken' && 'text-doqyn-subtle',
        )}
      >
        {feedback}
      </span>
    </div>
  );
}
