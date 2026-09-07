import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const SAVED_CONTACTS_INDEXES: IndexDescription[] = [
  /**
   * Uma decisão por pessoa, por dono.
   *
   * O único garante que salvar duas vezes não crie duas linhas, e que salvar quem estava oculto
   * seja uma troca de estado e não uma segunda entrada contradizendo a primeira.
   */
  {
    key: { ownerUserId: 1, contactUserId: 1 },
    unique: true,
    name: 'ownerUserId_contactUserId_unique',
  },
  /** A leitura de sempre: a lista de quem abriu a tela, já separada por decisão. */
  { key: { ownerUserId: 1, status: 1, createdAt: -1 } },
];

export async function ensureSavedContactsIndexes() {
  return ensureIndexesForCollection(SHARED_APP_COLLECTIONS.savedContacts, SAVED_CONTACTS_INDEXES);
}
