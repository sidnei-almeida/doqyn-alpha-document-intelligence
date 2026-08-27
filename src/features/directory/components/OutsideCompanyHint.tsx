import { Button } from '@/components/ui/Button';
import { useDirectoryLookup, looksLikeEmail } from '../hooks/useDirectoryLookup';

/**
 * O que fazer quando a busca dentro da empresa não achou ninguém.
 *
 * Hoje quem digita o e-mail de alguém de fora recebe "Ninguém encontrado" e nada mais — e o link
 * externo, que resolveria, fica numa aba que a pessoa não tem motivo para abrir, já que ela não
 * sabia de antemão que o destinatário está fora. Este é o ponto onde as duas metades da mesma
 * intenção se encontram.
 *
 * `doqyn_user` não aparece aqui de propósito: enquanto o envio entre empresas não existe, o
 * servidor devolve `external` para quem tem conta e para quem não tem. Contar a diferença sem ter
 * o que oferecer só entregaria de graça quem tem conta no DOQYN.
 */
const COPY = {
  share: {
    hint: 'Esse e-mail não é de ninguém da sua empresa. Dá para enviar por link.',
    action: (email: string) => `Enviar por link para ${email}`,
    alreadyThere: 'Essa pessoa já tem acesso.',
  },
  signature: {
    hint: 'Esse e-mail não é de ninguém da sua empresa. Dá para pedir a assinatura por link.',
    action: (email: string) => `Pedir assinatura por link para ${email}`,
    alreadyThere: 'Essa pessoa já foi convidada a assinar.',
  },
} as const;

export function OutsideCompanyHint({
  query,
  onUseExternal,
  intent = 'share',
}: {
  query: string;
  onUseExternal: (email: string) => void;
  intent?: keyof typeof COPY;
}) {
  const copy = COPY[intent];
  const email = query.trim().toLowerCase();
  const lookup = useDirectoryLookup(email, looksLikeEmail(email));

  if (!looksLikeEmail(email)) return null;
  if (lookup.isLoading || lookup.isError || !lookup.data) return null;

  if (lookup.data.kind === 'self') {
    return <p className="type-caption text-doqyn-muted">Esse é o seu e-mail.</p>;
  }

  // Membro da empresa que não apareceu na lista já tem acesso — a lista esconde quem já recebeu.
  if (lookup.data.kind === 'tenant_member') {
    return <p className="type-caption text-doqyn-muted">{copy.alreadyThere}</p>;
  }

  if (lookup.data.kind !== 'external') return null;

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="type-caption text-doqyn-muted">{copy.hint}</p>
      <Button type="button" variant="ghost" size="sm" onClick={() => onUseExternal(email)}>
        {copy.action(email)}
      </Button>
    </div>
  );
}
