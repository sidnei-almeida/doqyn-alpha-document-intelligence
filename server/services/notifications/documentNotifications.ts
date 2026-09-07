import { logger } from '../../utils/logger.js';
import { emitNotifications } from './notificationService.js';
import { resolveCategoryAudience } from './notificationRecipients.js';

/**
 * Notificar nunca derruba a ação que a originou.
 *
 * O documento já foi salvo, o convite de assinatura já existe, o acesso já foi decidido — falhar o
 * request por causa do aviso trocaria um problema pequeno e recuperável por um grande e visível.
 * O erro fica no log para não sumir calado.
 */
async function safely(what: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.warn('notification not emitted', {
      what,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function formatDate(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

type DocumentEventInput = {
  tenantId: string;
  documentId: string;
  documentName: string;
  categoryId?: string;
  categoryName?: string;
  ownerUserId?: string;
  actorUserId?: string;
  actorName?: string;
  /** Identidade do fato: id da versão criada, para que uma nova versão avise de novo. */
  eventKey: string;
};

export async function notifyDocumentCreated(input: DocumentEventInput): Promise<void> {
  await safely('document_created', async () => {
    const recipients = await resolveCategoryAudience({
      tenantId: input.tenantId,
      categoryId: input.categoryId,
      ownerUserId: input.ownerUserId,
      excludeUserId: input.actorUserId,
    });

    return emitNotifications({
      tenantId: input.tenantId,
      type: 'document_created',
      recipients,
      eventKey: input.eventKey,
      title: `${input.documentName} entrou em ${input.categoryName ?? 'Sem categoria'}`,
      body: input.actorName ? `Enviado por ${input.actorName}.` : undefined,
      documentId: input.documentId,
      documentName: input.documentName,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
    });
  });
}

export async function notifyDocumentUpdated(input: DocumentEventInput): Promise<void> {
  await safely('document_updated', async () => {
    const recipients = await resolveCategoryAudience({
      tenantId: input.tenantId,
      categoryId: input.categoryId,
      ownerUserId: input.ownerUserId,
      excludeUserId: input.actorUserId,
    });

    return emitNotifications({
      tenantId: input.tenantId,
      type: 'document_updated',
      recipients,
      eventKey: input.eventKey,
      title: `${input.documentName} ganhou uma versão nova`,
      body: input.actorName ? `Atualizado por ${input.actorName}.` : undefined,
      documentId: input.documentId,
      documentName: input.documentName,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
    });
  });
}

/**
 * Só signatário interno é notificado aqui.
 *
 * Convidado externo não tem conta nem caixa de notificação — ele recebe o link do portal, que é o
 * canal dele. Notificar um `userId` que não existe encheria a coleção de linha órfã.
 */
export async function notifySignatureRequested(input: {
  tenantId: string;
  signerUserId: string | null;
  signatureRequestId: string;
  documentId: string;
  documentName: string;
  actorUserId?: string;
  actorName?: string;
  expiresAt?: Date | string;
}): Promise<void> {
  if (!input.signerUserId) return;

  await safely('signature_required', async () => {
    const deadline = formatDate(input.expiresAt);

    return emitNotifications({
      tenantId: input.tenantId,
      type: 'signature_required',
      recipients: [input.signerUserId as string],
      eventKey: input.signatureRequestId,
      // O prazo entra no título porque é o que decide a ordem de quem tem várias pendências.
      title: deadline
        ? `${input.actorName ?? 'Alguém'} pediu sua assinatura em ${input.documentName} até ${deadline}`
        : `${input.actorName ?? 'Alguém'} pediu sua assinatura em ${input.documentName}`,
      documentId: input.documentId,
      documentName: input.documentName,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
    });
  });
}

export async function notifyDocumentShared(input: {
  tenantId: string;
  recipientUserId: string;
  shareId: string;
  documentId: string;
  documentName: string;
  actorUserId?: string;
  actorName?: string;
  canDownload?: boolean;
  message?: string | null;
}): Promise<void> {
  await safely('document_shared', async () => {
    return emitNotifications({
      tenantId: input.tenantId,
      type: 'document_shared',
      recipients: [input.recipientUserId],
      eventKey: input.shareId,
      title: `${input.actorName ?? 'Alguém'} compartilhou ${input.documentName} com você`,
      // O que a pessoa pode fazer é parte do aviso: "compartilhou" sem isso não diz se ela pode
      // baixar ou só ler na tela.
      body:
        input.message?.trim() ||
        (input.canDownload ? 'Você pode ver e baixar.' : 'Você pode ver, sem baixar.'),
      documentId: input.documentId,
      documentName: input.documentName,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
    });
  });
}

export async function notifyAccessDecision(input: {
  tenantId: string;
  memberUserId: string | null | undefined;
  memberId: string;
  approved: boolean;
  reason?: string | null;
  actorUserId?: string;
  actorName?: string;
  tenantName?: string;
}): Promise<void> {
  if (!input.memberUserId) return;

  await safely(input.approved ? 'access_approved' : 'access_rejected', async () =>
    emitNotifications({
      tenantId: input.tenantId,
      type: input.approved ? 'access_approved' : 'access_rejected',
      recipients: [input.memberUserId as string],
      // A decisão entra na chave: aprovar depois de rejeitar precisa avisar de novo.
      eventKey: `${input.memberId}:${input.approved ? 'approved' : 'rejected'}`,
      title: input.approved
        ? `Seu acesso a ${input.tenantName ?? 'esta organização'} foi aprovado`
        : `Seu acesso a ${input.tenantName ?? 'esta organização'} foi recusado`,
      body: input.approved ? undefined : input.reason?.trim() || undefined,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
    }),
  );
}
