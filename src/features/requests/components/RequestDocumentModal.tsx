import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { CrossTenantRecipientField } from '@/features/directory/components/CrossTenantRecipientField';
import { cn } from '@/lib/utils';
import { isIndividualTenant } from '@/lib/tenantVocabulary';
import { useAuth } from '@/auth/useAuth';
import { useTranslation } from 'react-i18next';

export type RequestDocumentTarget = {
  userId: string;
  name: string;
  email: string;
};

export type RequestDocumentCategory = {
  id: string;
  name: string;
};

type RequestDocumentModalProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Quem já vem escolhido, quando o pedido nasce de uma linha de contato.
   *
   * Aplicado só na abertura, e não a cada render: reaplicar sobrescreveria a troca de
   * destinatário que a pessoa fizesse dentro do modal.
   */
  initialTarget?: { scope: 'internal' | 'external'; userId?: string; email?: string };
  people: RequestDocumentTarget[];
  categories: RequestDocumentCategory[];
  saving?: boolean;
  onSubmit: (input: {
    requestedFromUserId?: string;
    requestedFromEmail?: string;
    requestedFromUsername?: string;
    title: string;
    description?: string;
    categoryId?: string;
    dueAt?: string;
  }) => Promise<void>;
};

/**
 * Pedir um documento a alguém.
 *
 * Dentro de casa, a categoria é campo obrigatório e fica ao lado da pessoa, não escondida em
 * "avançado": ela é a decisão de governança do pedido, e quem envia não escolhe onde o documento
 * cai.
 *
 * Para fora, ela **desaparece** — e isso não é simplificação de tela. O documento vai nascer e
 * morar no acervo de quem envia, governado por lá; oferecer uma categoria daqui prometeria um
 * destino que ele nunca terá. O que se recebe é leitura pela concessão, não posse.
 */
export function RequestDocumentModal({
  open,
  onClose,
  initialTarget,
  people,
  categories,
  saving,
  onSubmit,
}: RequestDocumentModalProps) {
  const { t } = useTranslation('requests');

  const { tenant } = useAuth();
  /**
   * Em PF não há a quem pedir dentro do próprio tenant — ele tem um usuário só. Sobra a origem
   * externa, e o seletor de duas abas deixa de fazer sentido.
   */
  const hasInternalScope = !isIndividualTenant(tenant?.tenantType);
  const defaultScope: 'internal' | 'external' = hasInternalScope ? 'internal' : 'external';

  const [scope, setScope] = useState<'internal' | 'external'>(defaultScope);
  const [requestedFromUserId, setRequestedFromUserId] = useState('');
  const [requestedFromEmail, setRequestedFromEmail] = useState('');
  const [requestedFromUsername, setRequestedFromUsername] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dueAt, setDueAt] = useState('');

  useEffect(() => {
    if (!open || !initialTarget) return;
    setScope(initialTarget.scope);
    setRequestedFromUserId(initialTarget.userId ?? '');
    setRequestedFromEmail(initialTarget.email ?? '');
    // Só na abertura: `initialTarget` fora das dependências é de propósito, senão trocar de
    // destinatário dentro do modal seria desfeito no render seguinte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const external = scope === 'external' || !hasInternalScope;
  const hasTarget = external
    ? requestedFromEmail.trim().includes('@') || Boolean(requestedFromUsername)
    : Boolean(requestedFromUserId);

  const canSubmit = Boolean(hasTarget && title.trim() && (external || categoryId)) && !saving;

  const reset = () => {
    setScope(defaultScope);
    setRequestedFromUserId('');
    setRequestedFromEmail('');
    setRequestedFromUsername('');
    setTitle('');
    setDescription('');
    setCategoryId('');
    setDueAt('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      requestedFromUserId: external ? undefined : requestedFromUserId,
      requestedFromEmail: external ? requestedFromEmail.trim() || undefined : undefined,
      requestedFromUsername: external ? requestedFromUsername.trim() || undefined : undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId: external ? undefined : categoryId,
      /**
       * Fim do dia **em UTC**, não no fuso de quem digita.
       *
       * O campo devolve `YYYY-MM-DD` e "até 01/09" quer dizer o dia inteiro. Ancorar no fuso local
       * empurrava o instante para o dia seguinte em UTC (em UTC-3, `01T23:59:59` vira
       * `02T02:59:59Z`), e aí a notificação — que formata em UTC — anunciava um dia a mais do que
       * a tabela mostrava.
       */
      dueAt: dueAt ? new Date(`${dueAt}T23:59:59Z`).toISOString() : undefined,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('requestDocumentModal.pedirUmDocumento')}
      subtitle={t(
        external
          ? 'requestDocumentModal.subtitleExternal'
          : 'requestDocumentModal.subtitleInternal',
      )}
      size="md"
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>
            {t('requestDocumentModal.cancelar')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {t(saving ? 'requestDocumentModal.sending' : 'requestDocumentModal.send')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Duas origens, não duas telas: pedir é o mesmo gesto, muda só quem atende. Em PF só
            existe uma origem, e um seletor de uma aba só é ruído. */}
        {hasInternalScope ? (
          <div className="flex gap-1 border-b border-doqyn-border-subtle">
            {(
              [
                ['internal', 'requestDocumentModal.scope.internal'],
                ['external', 'requestDocumentModal.scope.external'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={cn(
                  'px-3 pb-2 text-caption transition-colors',
                  scope === value
                    ? 'border-b-2 border-doqyn-accent-active text-doqyn-text'
                    : 'text-doqyn-muted hover:text-doqyn-text',
                )}
              >
                {t(label)}
              </button>
            ))}
          </div>
        ) : null}

        {external ? (
          <div className="flex flex-col gap-2">
            <CrossTenantRecipientField
              initialEmail={initialTarget?.scope === 'external' ? initialTarget.email : undefined}
              label={t('requestDocumentModal.nomeDeUsuarioDe')}
              idleHint={t('requestDocumentModal.externalIdleHint')}
              /* Sem caminho de link aqui: pedir um documento exige uma conta que possa enviá-lo, e
                 o link com token serve para receber, não para mandar. */
              onPick={(recipient) => {
                // Apelido e e-mail viajam em campos diferentes: o servidor resolve cada um pelo seu
                // caminho, e o do apelido nunca expõe endereço a quem só buscou.
                setRequestedFromEmail(recipient.email ?? '');
                setRequestedFromUsername(recipient.username ?? '');
              }}
            />
            {requestedFromEmail || requestedFromUsername ? (
              <p className="text-caption text-doqyn-accent-active">
                {t('requestDocumentModal.pedidoPara')}{' '}
                {requestedFromEmail || `@${requestedFromUsername}`}
              </p>
            ) : null}
          </div>
        ) : (
          /* O `select` nativo desenha a lista com o tema do navegador, e num app escuro isso
             aparece como um retângulo branco no meio do formulário. O primitivo do app monta a
             própria lista. */
          <Select
            label={t('requestDocumentModal.deQuem')}
            value={requestedFromUserId}
            onChange={(event) => setRequestedFromUserId(event.target.value)}
            options={[
              { value: '', label: t('requestDocumentModal.selectPerson') },
              ...people.map((person) => ({
                value: person.userId,
                // Sem travessão: o nome já separa do e-mail, e o traço só rouba largura da linha.
                label: person.email ? `${person.name} (${person.email})` : person.name,
              })),
            ]}
          />
        )}

        <Input
          label={t('requestDocumentModal.oQueVoceEsta')}
          value={title}
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('requestDocumentModal.comprovanteDeResidenciaAtualizado')}
        />

        {external ? null : (
          <div>
            <Select
              label={t('requestDocumentModal.categoriaDeDestino')}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              options={[
                { value: '', label: t('requestDocumentModal.selectCategory') },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
            />
            <span className="mt-1 block text-[11px] text-doqyn-subtle">
              {t('requestDocumentModal.eAquiQueO')}
            </span>
          </div>
        )}

        <label className="block">
          <span className="type-label mb-1 block text-doqyn-muted">
            {t('requestDocumentModal.detalhesOpcional')}
          </span>
          <textarea
            className="min-h-[80px] w-full rounded-[4px] border border-doqyn-border bg-doqyn-bg px-3 py-2 text-sm text-doqyn-text"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('requestDocumentModal.contaDeLuzOu')}
          />
        </label>

        <Input
          label={t('requestDocumentModal.prazoOpcional')}
          type="date"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
      </div>
    </Modal>
  );
}
