import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';
import type { PlatformRole } from '../api/usersApi';
import {
  DocumentGroupsSection,
  PlatformRolesSection,
  type DocumentGroupOption,
} from './AccessFormSections';

type InviteResult = {
  inviteLink: string;
  expiresAt: string;
  /** Falso quando o convite nasceu mas nada foi entregue. */
  emailSent: boolean;
  emailSkipReason?: string;
  /** Presente quando o convite vale mas os grupos não puderam ser guardados. */
  groupsWarning?: string;
};

/**
 * Por que o e-mail não saiu, em palavras que o gestor resolve.
 *
 * O código vem do auth-service e nomeia a causa; traduzir aqui evita mostrar `email_disabled`
 * para quem precisa decidir se manda o link pelo WhatsApp ou pede para alguém ligar o envio.
 */
const EMAIL_SKIP_REASON: Record<string, string> = {
  email_disabled: 'O envio de e-mail está desligado neste ambiente.',
  smtp_not_configured: 'Nenhum provedor de e-mail está configurado.',
  send_failed: 'O provedor recusou a entrega.',
};

type InviteMemberDialogProps = {
  documentGroups: DocumentGroupOption[];
  saving: boolean;
  onInvite: (input: {
    email: string;
    firstName: string;
    lastName: string;
    platformRoles: PlatformRole[];
    documentGroupIds: string[];
  }) => Promise<InviteResult>;
  onClose: () => void;
  onInvited: () => void;
};

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Convidar alguém para a empresa.
 *
 * Substitui o pedido de acesso, e a direção se inverteu junto: em vez de a pessoa procurar a
 * empresa pelo CNPJ e esperar aprovação, quem já está dentro convida e o convite é a aprovação.
 * Por isso papéis e grupos são escolhidos aqui — é o único momento em que alguém decide o que o
 * convidado alcança. Sem grupo, a conta nasce ativa e não enxerga documento nenhum.
 *
 * O diálogo tem dois estados, não dois passos: antes de criar é formulário, depois é o link.
 * O link **é** o produto da ação, então ele não pode passar num toast que some sozinho — quem
 * fechou sem copiar perdeu o convite, e o caminho de volta é revogar e convidar de novo.
 */
export function InviteMemberDialog({
  documentGroups,
  saving,
  onInvite,
  onClose,
  onInvited,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>(['user']);
  const [documentGroupIds, setDocumentGroupIds] = useState<string[]>([]);
  const [created, setCreated] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = email.trim().length > 3 && email.includes('@') && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const result = await onInvite({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        platformRoles,
        documentGroupIds,
      });
      setCreated(result);
      onInvited();
    } catch (error) {
      showApiErrorToast(error, 'Não foi possível criar o convite.');
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.inviteLink);
      setCopied(true);
      // O aviso volta ao normal sozinho: um "copiado" permanente vira decoração e deixa de
      // confirmar coisa alguma no segundo uso.
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      showAppToast({
        type: 'error',
        title: 'Não foi possível copiar',
        message: 'Selecione o link e copie manualmente.',
      });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={created ? 'Convite criado' : 'Convidar para a empresa'}
      subtitle={
        created
          ? created.emailSent
            ? 'O convite foi enviado por e-mail. Este link é o mesmo, se quiser mandar por outro canal.'
            : 'Envie este link para a pessoa. Ele funciona uma vez só.'
          : 'A pessoa recebe um link, preenche os próprios dados e entra direto.'
      }
      size="lg"
      // Há dado digitado em jogo antes de criar, e o link depois: clicar fora não pode
      // descartar nenhum dos dois em silêncio.
      dismissOnOverlay={false}
      footer={
        created ? (
          <Button type="button" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
              {saving ? 'Criando…' : 'Criar convite'}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="register-label text-doqyn-subtle">Link do convite</span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[3px] border border-doqyn-border-subtle bg-doqyn-card px-3 py-2 font-mono text-micro text-doqyn-text">
                {created.inviteLink}
              </code>
              <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
                <Icon name={copied ? 'check' : 'content_copy'} size={ICON_SIZE.xs} />
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <p className="type-caption text-doqyn-muted">
            Vale até {formatExpiry(created.expiresAt)}. Depois disso ele para de abrir, e é
            preciso convidar de novo.
          </p>

          {/* O aviso é do tamanho da consequência: o convite existe, mas ninguém foi avisado.
              Sem isto o gestor fecha o diálogo achando que a pessoa recebeu. */}
          {!created.emailSent ? (
            <p className="border-l-2 border-doqyn-warning/50 pl-3 type-caption text-doqyn-muted">
              <span className="font-medium text-doqyn-text">O e-mail não foi enviado.</span>{' '}
              {EMAIL_SKIP_REASON[created.emailSkipReason ?? ''] ??
                'A entrega não foi confirmada.'}{' '}
              Copie o link acima e envie por outro canal.
            </p>
          ) : null}

          {created.groupsWarning ? (
            <p className="border-l-2 border-doqyn-warning/50 pl-3 type-caption text-doqyn-muted">
              {created.groupsWarning}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <Input
            variant="rule"
            type="email"
            label="E-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@exemplo.com"
            autoComplete="off"
            autoFocus
          />

          {/* Nome é opcional porque o convidado confirma o próprio no aceite. Serve para o
              convite chegar com um cumprimento em vez de um endereço de e-mail. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              variant="rule"
              label="Nome (opcional)"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="off"
            />
            <Input
              variant="rule"
              label="Sobrenome (opcional)"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="off"
            />
          </div>

          <PlatformRolesSection value={platformRoles} onChange={setPlatformRoles} />

          <DocumentGroupsSection
            groups={documentGroups}
            value={documentGroupIds}
            onChange={setDocumentGroupIds}
          />

          {/* Sem grupo a conta nasce ativa e vazia, e quem convidou não fica sabendo. Um
              administrador é exceção legítima: ele alcança tudo por papel. */}
          {documentGroupIds.length === 0 && !platformRoles.includes('company_admin') ? (
            <p className="type-caption text-doqyn-muted">
              Sem nenhum grupo, a pessoa entra mas não alcança documento nenhum. O acesso se dá
              ao grupo, nunca à pessoa solta.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
