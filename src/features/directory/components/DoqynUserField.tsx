import { useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { looksLikeEmail, useDirectoryLookup } from '../hooks/useDirectoryLookup';
import { PartnerContactList } from './PartnerContactList';

/**
 * Achar alguém do DOQYN que não é da sua empresa.
 *
 * Só e-mail exato, e isso não é escolha de produto: o nome está cifrado no auth-service sem chave
 * de busca, e hash determinístico não responde prefixo. Buscar por nome entre empresas exigiria
 * tirar o nome da criptografia.
 *
 * O que compensa a falta de busca é a memória do que já aconteceu: quem já trocou documento com
 * uma empresa não devia ter que redigitar o e-mail da mesma pessoa toda vez. As sugestões saem das
 * trocas aceitas, e por isso a lista nasce vazia e cresce sozinha.
 */
export function DoqynUserField({
  value,
  onChange,
  label = 'E-mail de quem vai receber',
  hint,
}: {
  value: string;
  onChange: (email: string) => void;
  label?: string;
  hint?: string;
}) {
  const email = value.trim().toLowerCase();
  const lookup = useDirectoryLookup(email, looksLikeEmail(email));

  const resolution = useMemo(() => {
    if (!looksLikeEmail(email)) return null;
    if (lookup.isLoading) return { tone: 'muted' as const, text: 'Procurando…' };
    if (lookup.isError || !lookup.data) return null;

    switch (lookup.data.kind) {
      case 'self':
        return { tone: 'warn' as const, text: 'Esse é o seu e-mail.' };
      case 'tenant_member':
        return {
          tone: 'ok' as const,
          text: `${lookup.data.user.name} é da sua empresa.`,
        };
      case 'doqyn_user':
        return { tone: 'ok' as const, text: `${lookup.data.user.name} usa o DOQYN.` };
      default:
        // Sem conta, ou com conta e o envio entre empresas desligado: a resposta é a mesma de
        // propósito, para que "tem conta aqui" não seja descoberto de graça.
        return { tone: 'warn' as const, text: 'Esse e-mail não tem conta DOQYN.' };
    }
  }, [email, lookup.data, lookup.isError, lookup.isLoading]);

  return (
    <div>
      <Input
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="pessoa@outraempresa.com"
        autoComplete="off"
      />

      {resolution ? (
        <span
          className={cn(
            'mt-1 block text-[11px]',
            resolution.tone === 'ok' && 'text-doqyn-accent-active',
            resolution.tone === 'warn' && 'text-doqyn-warning',
            resolution.tone === 'muted' && 'text-doqyn-subtle',
          )}
        >
          {resolution.text}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-doqyn-subtle">{hint}</span>
      ) : null}

      {/* A lista de parceiras é a mesma do compartilhamento: uma peça, dois formulários. */}
      <div className="mt-3">
        <PartnerContactList onPick={onChange} />
      </div>
    </div>
  );
}
