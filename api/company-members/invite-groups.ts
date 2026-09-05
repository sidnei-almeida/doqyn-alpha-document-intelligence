import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTargetCompanyId } from '../../server/auth/memberAuth.js';
import { storePendingInviteGroups } from '../../server/services/invites/pendingInviteGroupsService.js';
import { withUserManagementApi } from '../../server/utils/userManagementApi.js';

/**
 * Guarda os grupos que o convidado recebe quando aceitar.
 *
 * Fica separado da criação do convite porque os dois vivem em bancos diferentes: o convite e o
 * token são do auth-service, e o grupo que governa é do Mongo. O navegador cria o convite lá e
 * registra a intenção aqui, nessa ordem — se esta chamada falhar, o link já existe e a pessoa
 * entra sem grupo, que a tela de Regras resolve. A ordem inversa deixaria intenção guardada
 * para um convite que nunca foi emitido.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withUserManagementApi(req, res, {
    endpoint: '/api/company-members/invite-groups',
    resolveCompanyId: (ctx) => {
      const body = (req.body ?? {}) as { companyId?: string };
      return resolveTargetCompanyId(ctx.user, body.companyId);
    },
    handler: async ({ user, companyId }) => {
      const body = (req.body ?? {}) as { email?: string; documentGroupIds?: string[] };

      await storePendingInviteGroups({
        tenantId: companyId,
        email: body.email ?? '',
        groupIds: body.documentGroupIds ?? [],
        invitedBy: user.id,
      });

      return { ok: true };
    },
  });
}
