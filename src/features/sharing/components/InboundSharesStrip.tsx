import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useInboundShareDecision, useInboundShares } from '../hooks/useInboundShares';

function formatReceivedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * O que chegou de outra empresa e ainda não entrou no acervo.
 *
 * Mora no topo de "Compartilhados comigo", e não numa tela própria, porque é aqui que a pessoa já
 * procura o que os outros mandaram. Uma entrada de navegação que aparece e some conforme a fila
 * enche seria mais barulho que caminho.
 *
 * A decisão é de quem recebe. Um administrador que pudesse aceitar no lugar dele liberaria para si
 * o documento que só o destinatário foi convidado a ver — a aprovação de saída protege quem envia,
 * não quem recebe.
 */
export function InboundSharesStrip() {
  const { data } = useInboundShares();
  const decision = useInboundShareDecision();

  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <section
      className="mb-6"
      aria-label="Documentos de outras empresas aguardando decisão"
      data-testid="inbound-shares-strip"
    >
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-eyebrow uppercase text-doqyn-primary">Aguardando seu aceite</h2>
        <span className="text-micro text-doqyn-muted">
          {items.length} {items.length === 1 ? 'documento' : 'documentos'} de fora da sua empresa
        </span>
      </div>

      <ul className="border-t border-doqyn-border-subtle">
        {items.map((item) => (
          <li
            key={item.grantId}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-doqyn-border-subtle py-3"
          >
            <Icon
              name="inbox"
              size={ICON_SIZE.sm}
              className="text-doqyn-accent shrink-0"
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-body text-doqyn-text">{item.documentName}</p>
              <p className="mt-0.5 truncate text-micro text-doqyn-muted">
                {item.originTenantName} · {item.sharedByName} · {formatReceivedAt(item.receivedAt)}
                {item.permissions.canDownload ? ' · pode baixar' : ' · somente leitura'}
              </p>
              {item.message ? (
                <p className="mt-1 truncate text-caption text-doqyn-muted">“{item.message}”</p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={decision.isPending}
                onClick={() => decision.mutate({ grantId: item.grantId, decision: 'decline' })}
              >
                Recusar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={decision.isPending}
                onClick={() => decision.mutate({ grantId: item.grantId, decision: 'accept' })}
              >
                Aceitar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
