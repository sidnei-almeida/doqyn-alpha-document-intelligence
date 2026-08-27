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
 * `doqyn_user` só chega aqui quando o envio entre empresas está ligado. Desligado, o servidor
 * devolve `external` para quem tem conta e para quem não tem — contar a diferença sem ter o que
 * oferecer entregaria de graça quem tem conta no DOQYN.
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
  onUseDoqynUser,
  intent = 'share',
}: {
  query: string;
  onUseExternal: (email: string) => void;
  /**
   * O caminho entre empresas. Ausente quando o fluxo ainda não o suporta — e aí o usuário DOQYN de
   * fora cai no link externo como qualquer outro, que é a verdade útil naquele fluxo.
   */
  onUseDoqynUser?: (email: string, name: string) => void;
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

  if (lookup.data.kind === 'doqyn_user') {
    if (!onUseDoqynUser) return null;
    const { name } = lookup.data.user;

    return (
      <div className="flex flex-col items-start gap-2">
        <p className="type-caption text-doqyn-muted">
          {name} usa o DOQYN em outra empresa. O documento continua sendo seu — ela precisa aceitar
          antes de ver.
        </p>
        <Button type="button" size="sm" onClick={() => onUseDoqynUser(email, name)}>
          Enviar para {name}
        </Button>
      </div>
    );
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
