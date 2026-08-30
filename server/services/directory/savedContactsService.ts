import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoSavedContact, SavedContactStatus } from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import {
  lookupDirectoryUserByEmail,
  searchDirectoryUsersByUsername,
} from '../../integrations/doqynAuthInternalClient.js';
import { ServiceError } from '../../utils/serviceErrors.js';

/**
 * A decisão explícita sobre um contato — salvar, ou tirar da frente.
 *
 * A lista derivada resolve quase tudo, e por isso continua sendo a base: ela não envelhece porque
 * ninguém a mantém. Faltavam as duas pontas que nenhum histórico produz:
 *
 * · **salvar** alguém com quem ainda não se trocou nada — sem isto, achar uma pessoa pelo apelido
 *   servia para um envio só, e no dia seguinte era preciso lembrar o handle de novo;
 * · **ocultar** alguém que o histórico insiste em oferecer — uma troca única com quem não se fala
 *   mais ficava no topo por trinta dias por causa do decaimento.
 *
 * Ocultar **não apaga nada**: o histórico continua lá, e é ele que responde auditoria. O que
 * some é a linha da lista de atalhos, que é uma conveniência e não um registro.
 */
async function getCollection(): Promise<Collection<MongoSavedContact>> {
  const db = await getDb();
  return db.collection<MongoSavedContact>(SHARED_APP_COLLECTIONS.savedContacts);
}

export type SavedContactDecision = {
  contactUserId: string;
  status: SavedContactStatus;
  nameSnapshot?: string;
  usernameSnapshot?: string;
  emailSnapshot?: string;
};

/** As decisões de quem abriu a tela, por id de contato. */
export async function listSavedContactDecisions(
  ownerUserId: string,
): Promise<Map<string, SavedContactDecision>> {
  if (!isMongoNativeConfigured()) return new Map();

  const collection = await getCollection();
  const rows = await collection.find({ ownerUserId }).limit(500).toArray();

  return new Map(
    rows.map((row) => [
      row.contactUserId,
      {
        contactUserId: row.contactUserId,
        status: row.status,
        nameSnapshot: row.nameSnapshot,
        usernameSnapshot: row.usernameSnapshot,
        emailSnapshot: row.emailSnapshot,
      },
    ]),
  );
}

/**
 * Salvar alguém achado pelo apelido.
 *
 * Resolve o handle **no servidor**, e não aceita um id vindo do cliente: aceitar id deixaria
 * salvar qualquer conta cujo identificador se soubesse, incluindo quem se retirou do diretório.
 * Passando pela busca, quem não quer ser achado continua não sendo.
 */
export async function saveContactByUsername(
  ctx: DocumentRequestContext,
  user: AuthUser,
  username: string,
): Promise<SavedContactDecision> {
  const handle = username.trim().toLowerCase().replace(/^@/, '');
  if (handle.length < 2) {
    throw new ServiceError(
      'Informe o nome de usuário completo.',
      'CONTACT_USERNAME_TOO_SHORT',
      400,
    );
  }

  const hits = await searchDirectoryUsersByUsername(handle, 5);
  const match = hits.find((hit) => hit.username === handle);

  if (!match) {
    throw new ServiceError('Nenhum usuário com esse nome de usuário.', 'CONTACT_NOT_FOUND', 404);
  }

  if (match.id === user.id) {
    throw new ServiceError('Esse é você.', 'CONTACT_IS_SELF', 400);
  }

  return upsertDecision(ctx, user, {
    contactUserId: match.id,
    status: 'saved',
    nameSnapshot: match.displayName || handle,
    usernameSnapshot: match.username,
    emailSnapshot: match.email,
  });
}

/**
 * Salvar alguém achado pelo e-mail exato.
 *
 * O outro caminho de descoberta que já existe. Mesma regra: o servidor resolve, e a resposta
 * uniforme do lookup continua valendo — não achar e "não quer ser achado" respondem igual.
 */
export async function saveContactByEmail(
  ctx: DocumentRequestContext,
  user: AuthUser,
  email: string,
): Promise<SavedContactDecision> {
  const normalized = email.trim().toLowerCase();
  const found = await lookupDirectoryUserByEmail(normalized);

  if (!found) {
    throw new ServiceError('Esse e-mail não tem conta DOQYN.', 'CONTACT_NOT_FOUND', 404);
  }

  if (found.id === user.id) {
    throw new ServiceError('Esse é você.', 'CONTACT_IS_SELF', 400);
  }

  return upsertDecision(ctx, user, {
    contactUserId: found.id,
    status: 'saved',
    nameSnapshot: found.displayName || normalized,
    emailSnapshot: normalized,
  });
}

/**
 * Tirar da lista.
 *
 * Guarda uma linha `hidden` em vez de apagar: o contato pode ter vindo do histórico, e apagar a
 * linha faria a próxima leitura derivá-lo de novo — o botão pareceria não ter funcionado.
 */
export async function hideContact(
  ctx: DocumentRequestContext,
  user: AuthUser,
  contactUserId: string,
): Promise<SavedContactDecision> {
  if (!contactUserId.trim()) {
    throw new ServiceError('Contato inválido.', 'CONTACT_INVALID', 400);
  }

  return upsertDecision(ctx, user, { contactUserId: contactUserId.trim(), status: 'hidden' });
}

/** Desfazer a decisão: o contato volta a valer o que o histórico disser sobre ele. */
export async function forgetContactDecision(user: AuthUser, contactUserId: string): Promise<void> {
  if (!isMongoNativeConfigured()) return;
  const collection = await getCollection();
  await collection.deleteOne({ ownerUserId: user.id, contactUserId });
}

async function upsertDecision(
  ctx: DocumentRequestContext,
  user: AuthUser,
  decision: SavedContactDecision,
): Promise<SavedContactDecision> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Banco indisponível.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const collection = await getCollection();
  const now = new Date();

  await collection.updateOne(
    { ownerUserId: user.id, contactUserId: decision.contactUserId },
    {
      $set: {
        status: decision.status,
        // Só sobrescreve o que veio: ocultar não conhece nome nem apelido, e zerar a cópia
        // apagaria o rótulo de reserva de quem tinha sido salvo antes.
        ...(decision.nameSnapshot ? { nameSnapshot: decision.nameSnapshot } : {}),
        ...(decision.usernameSnapshot ? { usernameSnapshot: decision.usernameSnapshot } : {}),
        ...(decision.emailSnapshot ? { emailSnapshot: decision.emailSnapshot } : {}),
        tenantId: ctx.tenantId,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: `contact_${randomUUID()}`,
        ownerUserId: user.id,
        contactUserId: decision.contactUserId,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return decision;
}
