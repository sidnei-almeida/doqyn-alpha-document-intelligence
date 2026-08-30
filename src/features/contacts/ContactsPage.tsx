import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatContactMeta } from '@/features/directory/components/ContactRow';
import { useFrequentContacts } from '@/features/directory/hooks/useFrequentContacts';
import { searchShareableUsers } from '@/features/sharing/api/shareApi';
import { useDocumentCategories } from '@/features/library/hooks/useCategoryFolders';
import { createDocumentRequest } from '@/features/requests/api/documentRequestsApi';
import { RequestDocumentModal } from '@/features/requests/components/RequestDocumentModal';
import type { FrequentContact } from '@/features/directory/api/frequentContactsApi';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';

/**
 * Com quem você troca documento, e o atalho para a próxima troca.
 *
 * A lista é derivada e cresce sozinha: não existe botão de adicionar porque não há nada a
 * adicionar. Uma agenda mantida à mão envelheceria — quem mudou de time ou saiu da empresa
 * continuaria sendo oferecido — e quase ninguém a manteria.
 *
 * **Só "pedir documento" mora aqui.** Compartilhar e pedir assinatura começam por um documento,
 * não por uma pessoa: oferecê-los daqui exigiria escolher o arquivo primeiro, e um seletor de
 * documento dentro da tela de contatos seria a Biblioteca de novo, pior. Para esses dois, o
 * caminho continua sendo a Biblioteca — e o seletor de destinatário de lá já ordena por esta
 * mesma afinidade.
 */
function ContactSection({
  title,
  hint,
  contacts,
  onRequest,
}: {
  title: string;
  hint: string;
  contacts: FrequentContact[];
  onRequest: (contact: FrequentContact) => void;
}) {
  if (!contacts.length) return null;

  return (
    // Largura travada: numa tela larga a linha esticaria até a borda e a ação ficaria a meio metro
    // do nome a que pertence. É uma lista de pessoas, não uma tabela.
    <section className="max-w-3xl space-y-2">
      <div>
        <h2 className="type-title text-doqyn-text">{title}</h2>
        <p className="type-caption text-doqyn-muted">{hint}</p>
      </div>

      <ul className="border-t border-doqyn-border-subtle">
        {contacts.map((contact) => (
          <li
            key={contact.userId}
            className="flex items-center gap-3 border-b border-doqyn-border-subtle py-3"
          >
            <UserAvatar name={contact.name} email={contact.email} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body text-doqyn-text">{contact.name}</p>
              <p className="truncate text-micro text-doqyn-muted">
                {contact.email ?? 'sem e-mail registrado nesta troca'}
              </p>
              <p className="truncate text-micro text-doqyn-subtle">
                {formatContactMeta(contact.interactions, contact.lastInteractionAt)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              // Sem e-mail não há para onde mandar o pedido de fora, e prometer a ação seria
              // oferecer um caminho que falha no envio.
              disabled={contact.scope === 'external' && !contact.email}
              onClick={() => onRequest(contact)}
            >
              Pedir documento
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ContactsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const contacts = useFrequentContacts('all', { limit: 100 });
  const categories = useDocumentCategories();

  const [target, setTarget] = useState<FrequentContact | null>(null);

  const people = useQuery({
    queryKey: ['shareable-users', ''],
    queryFn: () => searchShareableUsers(''),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createDocumentRequest,
    onSuccess: () => {
      toast.success('Pedido enviado.');
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['document-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['frequent-contacts'] });
    },
    onError: (error) => showApiErrorToast(error, 'Não foi possível enviar o pedido.'),
  });

  // `?? []` cria um array novo a cada render, e um `useMemo` que depende dele nunca reaproveita
  // nada. Estabilizar aqui é o que faz os dois recortes abaixo valerem a pena.
  const todos = useMemo(() => contacts.data ?? [], [contacts.data]);
  const internos = useMemo(() => todos.filter((c) => c.scope === 'internal'), [todos]);
  const externos = useMemo(() => todos.filter((c) => c.scope === 'external'), [todos]);

  return (
    <div className="space-y-5">
      <header>
        <p className="register-label text-doqyn-subtle">BIBLIOTECA</p>
        <h1 className="type-display text-doqyn-text">Contatos</h1>
        <p className="type-body text-doqyn-muted">
          Com quem você troca documento, do mais acionado para o menos.
        </p>
      </header>

      {contacts.isLoading ? (
        <p className="type-caption text-doqyn-muted">Carregando…</p>
      ) : todos.length === 0 ? (
        <div className="max-w-3xl rounded-lg border border-doqyn-border-subtle p-6">
          <p className="type-body text-doqyn-text">Nada aqui ainda.</p>
          {/* O vazio explica o mecanismo em vez de oferecer um botão: não há o que adicionar, e
              sugerir que houvesse faria a pessoa procurar um controle que não existe. */}
          <p className="type-caption mt-1 text-doqyn-muted">
            A lista cresce sozinha conforme você compartilha, pede assinatura e requisita
            documentos. Não há nada para cadastrar.
          </p>
          <Button type="button" size="sm" className="mt-3" onClick={() => navigate('/biblioteca')}>
            Ir para a Biblioteca
          </Button>
        </div>
      ) : (
        <>
          <ContactSection
            title="Da sua empresa"
            hint="Compartilhar com essas pessoas vale na hora, sem aceite."
            contacts={internos}
            onRequest={setTarget}
          />
          <ContactSection
            title="De outras empresas"
            hint="O documento continua no acervo de quem envia, e o acesso depende de aceite."
            contacts={externos}
            onRequest={setTarget}
          />
        </>
      )}

      <RequestDocumentModal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        initialTarget={
          target
            ? {
                scope: target.scope,
                userId: target.scope === 'internal' ? target.userId : undefined,
                email: target.scope === 'external' ? target.email : undefined,
              }
            : undefined
        }
        people={(people.data ?? []).map((user) => ({
          userId: user.userId,
          name: user.name,
          email: user.email ?? '',
        }))}
        categories={(categories.data ?? []).map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        saving={createMutation.isPending}
        onSubmit={async (input) => {
          await createMutation.mutateAsync(input);
        }}
      />
    </div>
  );
}

export default ContactsPage;
