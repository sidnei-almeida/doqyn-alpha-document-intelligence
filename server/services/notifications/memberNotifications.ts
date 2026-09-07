import type { MongoTenantMember } from '../../db/types.js';
import { logger } from '../../utils/logger.js';
import { listTenantMembers } from '../tenantMemberRepository.js';
import { emitNotifications } from './notificationService.js';

/**
 * Notificar nunca derruba a ação que a originou.
 *
 * A pessoa já entrou, a membership já existe — falhar a sincronização por causa do aviso trocaria
 * um problema pequeno e recuperável por um grande e invisível. Mesma regra de
 * `approvalNotifications.ts`.
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

function displayName(member: Pick<MongoTenantMember, 'firstName' | 'lastName' | 'email'>): string {
  const parts = [member.firstName, member.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : member.email;
}

/**
 * Quem precisa saber que alguém entrou.
 *
 * Quem convidou, primeiro: foi ele que começou a conversa, e este aviso é o fim dela. Os
 * administradores da empresa vão junto porque a entrada de uma pessoa é fato de governança —
 * quem responde pelo ambiente precisa saber quem passou a alcançá-lo, mesmo que o convite tenha
 * saído da mão de outro administrador.
 *
 * `invitedBy` vem do auth como **membershipId**, não como id de usuário; a tradução acontece na
 * mesma lista que já foi carregada para achar os administradores, sem uma segunda ida ao banco.
 */
function resolveRecipients(
  members: MongoTenantMember[],
  invitedByMembershipId?: string,
): string[] {
  const recipients = new Set<string>();

  if (invitedByMembershipId) {
    const inviter = members.find((member) => member._id === invitedByMembershipId);
    if (inviter?.authUserId) recipients.add(inviter.authUserId);
  }

  for (const member of members) {
    if (member.status !== 'active') continue;
    if (!member.tenantRoles?.includes('company_admin')) continue;
    if (member.authUserId) recipients.add(member.authUserId);
  }

  return [...recipients];
}

/**
 * O convidado aceitou, preencheu os próprios dados e a conta passou a existir.
 *
 * É o instante em que a linha "Convidado" da tela de Usuários deixa de ser um convite e vira uma
 * pessoa. Sem este aviso, quem convidou só descobre olhando a lista de novo.
 */
export async function notifyMemberJoined(input: {
  tenantId: string;
  member: MongoTenantMember;
}): Promise<void> {
  await safely('member_joined', async () => {
    const members = await listTenantMembers(input.tenantId);
    const recipients = resolveRecipients(members, input.member.invitedBy);
    if (recipients.length === 0) return;

    const nome = displayName(input.member);
    const cargo = input.member.requestedAccess?.jobTitle;

    await emitNotifications({
      tenantId: input.tenantId,
      companyId: input.member.companyId ?? input.tenantId,
      type: 'member_joined',
      recipients,
      // Uma entrada, um aviso. A membership é única e não se repete, então reprocessar o sync não
      // enche a caixa de quem administra.
      eventKey: `member_joined:${input.member._id}`,
      title: `${nome} entrou na empresa`,
      body: cargo ? `${input.member.email} · ${cargo}` : input.member.email,
      // O próprio recém-chegado não recebe: `emitNotifications` descarta o ator da lista, e é
      // dele que o fato fala.
      actorUserId: input.member.authUserId,
      actorName: nome,
    });
  });
}
