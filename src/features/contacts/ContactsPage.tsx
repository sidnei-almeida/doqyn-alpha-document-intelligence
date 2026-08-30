import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFrequentContacts } from '@/features/directory/hooks/useFrequentContacts';
import { ContactCard, type ContactAction } from './ContactCard';
import { AddContactField } from './AddContactField';
import { useContactMutations } from '@/features/directory/hooks/useContactMutations';
import { PickDocumentDialog } from './PickDocumentDialog';
import { ShareDocumentModal } from '@/features/sharing/components/ShareDocumentModal';
import { RequestSignatureModal } from '@/features/signature/RequestSignatureModal';
import type { DocumentListItem } from '@/types/document-library';
import { searchShareableUsers } from '@/features/sharing/api/shareApi';
import { useDocumentCategories } from '@/features/library/hooks/useCategoryFolders';
import { createDocumentRequest } from '@/features/requests/api/documentRequestsApi';
import { RequestDocumentModal } from '@/features/requests/components/RequestDocumentModal';
import type { FrequentContact } from '@/features/directory/api/frequentContactsApi';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { SkeletonList } from '@/components/ui/SkeletonList';

/** Um recorte da grade — "da sua empresa" e "de outras" são regras diferentes, não filtros. */
function ContactSection({
  title,
  hint,
  contacts,
  onAction,
}: {
  title: string;
  hint: string;
  contacts: FrequentContact[];
  onAction: (action: ContactAction, contact: FrequentContact) => void;
}) {
  if (!contacts.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="type-title text-doqyn-text">{title}</h2>
        <p className="type-caption text-doqyn-muted">{hint}</p>
      </div>

      {/* A grade cresce com a tela em vez de deixar metade dela vazia, e os cartões param de
          esticar quando ficariam largos demais para o pouco que carregam. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {contacts.map((contact) => (
          <ContactCard key={contact.userId} contact={contact} onAction={onAction} />
        ))}
      </div>
    </section>
  );
}

/**
 * Com quem você troca documento, e o atalho para a próxima troca.
 *
 * A lista é derivada e cresce sozinha: não existe botão de adicionar porque não há nada a
 * adicionar. Uma agenda mantida à mão envelheceria — quem mudou de time ou saiu da empresa
 * continuaria sendo oferecido — e quase ninguém a manteria.
 *
 * **As três ações começam aqui, mas nem todas começam do mesmo lugar.** Pedir documento nasce de
 * uma pessoa e vai direto. Compartilhar e pedir assinatura começam por um documento, então passam
 * antes por `PickDocumentDialog` — que não é a Biblioteca, e sim uma escolha única, sem pasta,
 * filtro ou ação por linha. Depois disso, o modal de sempre abre já com a pessoa escolhida: ter
 * que achá-la de novo é a metade que faria a ação não valer a pena.
 */
export function ContactsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const contacts = useFrequentContacts('all', { limit: 100 });
  const contactMutations = useContactMutations();
  const categories = useDocumentCategories();

  /**
   * A ação em curso, e a pessoa dela.
   *
   * Compartilhar e pedir assinatura têm dois passos — escolher o documento, depois o modal de
   * sempre. Guardar os dois num estado só é o que impede a tela de abrir dois modais ao mesmo
   * tempo quando alguém clica rápido em cartões diferentes.
   */
  const [pending, setPending] = useState<{
    action: ContactAction;
    contact: FrequentContact;
  } | null>(null);
  const [document, setDocument] = useState<DocumentListItem | null>(null);

  const target = pending?.action === 'request' ? pending.contact : null;

  /**
   * O escolhido, no formato que os modais de documento entendem.
   *
   * Só para quem é de casa: o seletor interno deles resolve membro do tenant, e um contato de
   * outra empresa passa pelo campo de fronteira, que é outro caminho. Nulo aqui significa "abre
   * sem ninguém escolhido", que é o comportamento de sempre.
   */
  const recipient =
    pending && pending.contact.scope === 'internal'
      ? {
          id: pending.contact.userId,
          name: pending.contact.name,
          email: pending.contact.email ?? '',
        }
      : null;

  const handleAction = (action: ContactAction, contact: FrequentContact) => {
    if (action === 'hide') {
      contactMutations.hide.mutate(contact.userId);
      return;
    }
    setDocument(null);
    setPending({ action, contact });
  };

  const closeAll = () => {
    setPending(null);
    setDocument(null);
  };

  const people = useQuery({
    queryKey: ['shareable-users', ''],
    queryFn: () => searchShareableUsers(''),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createDocumentRequest,
    onSuccess: () => {
      toast.success('Pedido enviado.');
      closeAll();
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

      <AddContactField />

      {contacts.isLoading ? (
        <SkeletonList rows={5} media twoLines label="Carregando contatos" />
      ) : todos.length === 0 ? (
        // O aviso de vazio do app é sem moldura: `EmptyState` nasceu para tirar exatamente a
        // caixa preenchida de canto arredondado que eu tinha escrito aqui.
        <EmptyState
          title="Nenhum contato ainda"
          description="A lista cresce sozinha conforme você compartilha, pede assinatura e requisita documentos. Para adiantar, salve alguém pelo nome de usuário no campo acima."
          action={
            <Button type="button" size="sm" onClick={() => navigate('/biblioteca')}>
              Ir para a Biblioteca
            </Button>
          }
        />
      ) : (
        <>
          <ContactSection
            title="Da sua empresa"
            hint="Compartilhar com essas pessoas vale na hora, sem aceite."
            contacts={internos}
            onAction={handleAction}
          />
          <ContactSection
            title="De outras empresas"
            hint="O documento continua no acervo de quem envia, e o acesso depende de aceite."
            contacts={externos}
            onAction={handleAction}
          />
        </>
      )}

      {/* Passo 1 de compartilhar e de pedir assinatura. `Pedir documento` não passa por aqui:
          ele nasce de uma pessoa e não precisa de arquivo nenhum. */}
      <PickDocumentDialog
        open={Boolean(pending) && pending?.action !== 'request' && !document}
        recipientName={pending?.contact.name ?? ''}
        verb={pending?.action === 'signature' ? 'assinatura' : 'compartilhar'}
        onClose={closeAll}
        onPick={setDocument}
      />

      <ShareDocumentModal
        open={pending?.action === 'share' && Boolean(document)}
        document={document}
        initialRecipient={recipient}
        onClose={closeAll}
      />

      <RequestSignatureModal
        open={pending?.action === 'signature' && Boolean(document)}
        document={document}
        initialRecipient={recipient}
        onClose={closeAll}
      />

      <RequestDocumentModal
        open={Boolean(target)}
        onClose={closeAll}
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
