import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

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
  people: RequestDocumentTarget[];
  categories: RequestDocumentCategory[];
  saving?: boolean;
  onSubmit: (input: {
    requestedFromUserId: string;
    title: string;
    description?: string;
    categoryId: string;
    dueAt?: string;
  }) => Promise<void>;
};

/**
 * Pedir um documento a alguém.
 *
 * A categoria é campo obrigatório e fica ao lado da pessoa, não escondida em "avançado": ela é a
 * decisão de governança do pedido — quem envia não escolhe onde o documento cai, e por isso quem
 * pede precisa ver essa escolha enquanto a faz.
 */
export function RequestDocumentModal({
  open,
  onClose,
  people,
  categories,
  saving,
  onSubmit,
}: RequestDocumentModalProps) {
  const [requestedFromUserId, setRequestedFromUserId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const canSubmit = Boolean(requestedFromUserId && title.trim() && categoryId) && !saving;

  const reset = () => {
    setRequestedFromUserId('');
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
      requestedFromUserId,
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId,
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
      title="Pedir um documento"
      subtitle="Quem receber envia pelo fluxo de sempre, e o documento cai na categoria que você escolher."
      size="md"
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {saving ? 'Enviando…' : 'Pedir'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* O `select` nativo desenha a lista com o tema do navegador, e num app escuro isso
            aparece como um retângulo branco no meio do formulário. O primitivo do app monta a
            própria lista. */}
        <Select
          label="De quem"
          value={requestedFromUserId}
          onChange={(event) => setRequestedFromUserId(event.target.value)}
          options={[
            { value: '', label: 'Selecione uma pessoa' },
            ...people.map((person) => ({
              value: person.userId,
              // Sem travessão: o nome já separa do e-mail, e o traço só rouba largura da linha.
              label: person.email ? `${person.name} (${person.email})` : person.name,
            })),
          ]}
        />

        <Input
          label="O que você está pedindo"
          value={title}
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Comprovante de residência atualizado"
        />

        <div>
          <Select
            label="Categoria de destino"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            options={[
              { value: '', label: 'Selecione uma categoria' },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
          />
          <span className="mt-1 block text-[11px] text-doqyn-subtle">
            É aqui que o documento vai cair. Quem enviar não muda essa escolha.
          </span>
        </div>

        <label className="block">
          <span className="type-label mb-1 block text-doqyn-muted">Detalhes (opcional)</span>
          <textarea
            className="min-h-[80px] w-full rounded-[4px] border border-doqyn-border bg-doqyn-bg px-3 py-2 text-sm text-doqyn-text"
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Conta de luz ou água dos últimos 90 dias."
          />
        </label>

        <Input
          label="Prazo (opcional)"
          type="date"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
      </div>
    </Modal>
  );
}
