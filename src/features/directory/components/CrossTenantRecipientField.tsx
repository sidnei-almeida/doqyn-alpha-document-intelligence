import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { looksLikeEmail, useDirectoryLookup } from '../hooks/useDirectoryLookup';
import { PartnerContactList } from './PartnerContactList';

/**
 * Campo próprio para achar alguém de **outra** empresa.
 *
 * Não é o mesmo campo da busca de colegas, e não deve ser: aquele procura por nome numa lista
 * conhecida; este resolve um e-mail exato contra o diretório, porque o nome está cifrado no
 * auth-service sem chave de busca. Misturar os dois num campo só escondia o caminho de fora atrás
 * do "ninguém encontrado" — e quem tem três colegas na lista nunca via que ele existia.
 *
 * A mesma peça serve compartilhar, pedir assinatura e requisitar: são três verbos, uma fronteira.
 */
type Resolution =
  | { tone: 'muted'; text: string }
  | { tone: 'warn'; text: string }
  | { tone: 'ok'; text: string };

export function CrossTenantRecipientField({
  label = 'E-mail de quem é de outra empresa',
  idleHint = 'Digite o e-mail completo. Fora da sua empresa não há busca por nome: o nome é guardado cifrado.',
  onPick,
  onFallbackToLink,
  fallbackLabel = 'Enviar por link',
  disabled,
}: {
  label?: string;
  idleHint?: string;
  /** Chamado quando o e-mail resolve para um usuário DOQYN de outra empresa. */
  onPick: (recipient: { email: string; name: string }) => void;
  /**
   * O caminho para quem não tem conta. Ausente quando o fluxo não oferece link com token — e aí o
   * campo só diz que não deu, em vez de prometer uma saída que não existe.
   */
  onFallbackToLink?: (email: string) => void;
  fallbackLabel?: string;
  disabled?: boolean;
}) {
  const [email, setEmail] = useState('');
  const normalized = email.trim().toLowerCase();
  const lookup = useDirectoryLookup(normalized, looksLikeEmail(normalized));

  let resolution: Resolution | null = null;
  let action: { label: string; run: () => void } | null = null;

  if (!looksLikeEmail(normalized)) {
    resolution = { tone: 'muted', text: idleHint };
  } else if (lookup.isLoading) {
    resolution = { tone: 'muted', text: 'Procurando…' };
  } else if (lookup.isError || !lookup.data) {
    resolution = { tone: 'warn', text: 'Não foi possível consultar agora.' };
  } else if (lookup.data.kind === 'self') {
    resolution = { tone: 'warn', text: 'Esse é o seu e-mail.' };
  } else if (lookup.data.kind === 'tenant_member') {
    // Achou em casa: o caminho certo é o campo de cima, e dizer isso evita o envio pendente
    // desnecessário para quem já é colega.
    resolution = {
      tone: 'warn',
      text: `${lookup.data.user.name} é da sua empresa. Use a busca acima.`,
    };
  } else if (lookup.data.kind === 'doqyn_user') {
    const { name } = lookup.data.user;
    resolution = {
      tone: 'ok',
      text: `${name} usa o DOQYN. O documento continua seu, e ela precisa aceitar antes de ver.`,
    };
    action = { label: `Escolher ${name}`, run: () => onPick({ email: normalized, name }) };
  } else {
    // Sem conta, ou com conta e o envio entre empresas desligado: a resposta é a mesma de
    // propósito, para que "tem conta aqui" não se descubra de graça.
    resolution = { tone: 'warn', text: 'Esse e-mail não tem conta DOQYN.' };
    if (onFallbackToLink) {
      action = { label: fallbackLabel, run: () => onFallbackToLink(normalized) };
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        label={label}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="pessoa@outraempresa.com"
        autoComplete="off"
        disabled={disabled}
      />

      {resolution ? (
        <span
          className={cn(
            'text-[11px]',
            resolution.tone === 'ok' && 'text-doqyn-accent-active',
            resolution.tone === 'warn' && 'text-doqyn-warning',
            resolution.tone === 'muted' && 'text-doqyn-subtle',
          )}
        >
          {resolution.text}
        </span>
      ) : null}

      {action ? (
        <Button type="button" size="sm" variant="ghost" onClick={action.run} disabled={disabled}>
          {action.label}
        </Button>
      ) : null}

      <PartnerContactList onPick={setEmail} />
    </div>
  );
}
