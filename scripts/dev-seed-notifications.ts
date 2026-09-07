/**
 * Semeia notificações de todos os tipos na caixa de uma pessoa, para inspeção visual.
 * Usa o motor real (`emitNotifications`), então passa por preferência, dedupe e outbox.
 */
import 'dotenv/config';
import { getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { emitNotifications } from '../server/services/notifications/notificationService.js';
import { getTenantCollections } from '../server/tenancy/getTenantCollections.js';

const TARGET_EMAIL = process.argv[2] ?? 'rafael.mendes@doqyn.dev';

async function main() {
  if (!isMongoNativeConfigured()) throw new Error('MongoDB não configurado.');

  const db = await getDb();
  const member = await db
    .collection(REGISTRY_COLLECTIONS.tenantMembers)
    .findOne({ emailNormalized: TARGET_EMAIL.toLowerCase() } as Record<string, unknown>);

  if (!member) throw new Error(`Membro não encontrado: ${TARGET_EMAIL}`);

  const tenantId = member.tenantId as string;
  const userId = (member.authUserId ?? member._id) as string;
  console.log('alvo', { email: TARGET_EMAIL, tenantId, userId, memberId: member._id });

  const collections = await getTenantCollections(tenantId);
  const docs = await collections.documents
    .find({ status: 'active' } as Record<string, unknown>)
    .limit(4)
    .toArray();

  console.log('documentos disponíveis:', docs.length);
  const pick = (index: number) =>
    (docs[index % Math.max(docs.length, 1)] ?? null) as Record<string, unknown> | null;

  const nameOf = (doc: Record<string, unknown> | null, fallback: string) =>
    (doc?.title as string) || (doc?.currentFileName as string) || fallback;

  const stamp = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const events = [
    {
      type: 'document_created' as const,
      eventKey: `seed:${stamp}:created`,
      title: `${nameOf(pick(0), 'Contrato de prestação')} entrou em Contratos`,
      body: 'Enviado por Camila Oliveira.',
      documentId: pick(0)?._id as string | undefined,
      documentName: nameOf(pick(0), 'Contrato de prestação'),
      categoryName: 'Contratos',
      actorName: 'Camila Oliveira',
    },
    {
      type: 'document_updated' as const,
      eventKey: `seed:${stamp}:updated`,
      title: `${nameOf(pick(1), 'NDA Cristiano')} ganhou uma versão nova`,
      body: 'Atualizado por Thiago Barros.',
      documentId: pick(1)?._id as string | undefined,
      documentName: nameOf(pick(1), 'NDA Cristiano'),
      categoryName: 'Jurídico',
      actorName: 'Thiago Barros',
    },
    {
      type: 'signature_required' as const,
      eventKey: `seed:${stamp}:signature`,
      title: `Renata Alves pediu sua assinatura em ${nameOf(pick(2), 'Aditivo contratual')} até ${new Date(Date.now() + 5 * day).toLocaleDateString('pt-BR')}`,
      documentId: pick(2)?._id as string | undefined,
      documentName: nameOf(pick(2), 'Aditivo contratual'),
      actorName: 'Renata Alves',
    },
    {
      type: 'document_shared' as const,
      eventKey: `seed:${stamp}:shared`,
      title: `Camila Oliveira compartilhou ${nameOf(pick(3), 'Invoice BXZYLFIE')} com você`,
      body: 'Você pode ver, sem baixar.',
      documentId: pick(3)?._id as string | undefined,
      documentName: nameOf(pick(3), 'Invoice BXZYLFIE'),
      actorName: 'Camila Oliveira',
    },
    {
      type: 'document_expiring' as const,
      eventKey: `seed:${stamp}:expiring-7`,
      title: `${nameOf(pick(0), 'Contrato de prestação')} vence em 7 dias`,
      documentId: pick(0)?._id as string | undefined,
      documentName: nameOf(pick(0), 'Contrato de prestação'),
      categoryName: 'Contratos',
      expiry: {
        offsetDays: 7,
        validityDate: new Date(Date.now() + 7 * day),
        daysRemaining: 7,
      },
    },
    {
      type: 'document_expiring' as const,
      eventKey: `seed:${stamp}:expiring-late`,
      title: `${nameOf(pick(1), 'Apólice de seguro')} venceu há 3 dias`,
      documentId: pick(1)?._id as string | undefined,
      documentName: nameOf(pick(1), 'Apólice de seguro'),
      categoryName: 'Financeiro',
      expiry: {
        offsetDays: -3,
        validityDate: new Date(Date.now() - 3 * day),
        daysRemaining: -3,
      },
    },
    {
      type: 'access_approved' as const,
      eventKey: `seed:${stamp}:approved`,
      title: 'Seu acesso a DOQYN Dev foi aprovado',
      actorName: 'Sidnei Dev',
    },
    {
      type: 'access_rejected' as const,
      eventKey: `seed:${stamp}:rejected`,
      title: 'Seu acesso a Contratos Jurídico foi recusado',
      body: 'Solicite pelo gestor da área antes de repetir o pedido.',
      actorName: 'Sidnei Dev',
    },
  ];

  for (const event of events) {
    const result = await emitNotifications({
      tenantId,
      recipients: [userId],
      ...event,
    });
    console.log(event.type.padEnd(20), result);
  }

  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
