import type { IndexDescription } from 'mongodb';
import { ANALYSIS_JOB_INDEXES } from './analysisJobIndexes.js';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { DOCUMENT_REQUEST_INDEXES } from './documentRequestIndexes.js';
import { DOCUMENT_SHARE_GRANTS_INDEXES } from './documentShareGrantsIndexes.js';
import {
  DOCUMENT_SIGNATURE_REQUESTS_INDEXES,
  DOCUMENT_SIGNATURES_INDEXES,
} from './documentSignatureIndexes.js';
import { DOCUMENT_UPLOAD_APPROVAL_INDEXES } from './documentUploadApprovalIndexes.js';
import { EXTERNAL_DOCUMENT_SHARE_GRANTS_INDEXES } from './externalDocumentShareGrantsIndexes.js';
import { NOTIFICATION_DELIVERY_INDEXES, NOTIFICATION_INDEXES } from './notificationIndexes.js';
import { SAVED_CONTACTS_INDEXES } from './savedContactsIndexes.js';
import { USER_DOCUMENT_FAVORITES_INDEXES } from './userDocumentFavoritesIndexes.js';

/**
 * Índices das coleções globais do app, numa lista só.
 *
 * O job que o Compose roda em produção (`scripts/ensure-mongodb-indexes.ts`) mantinha a própria
 * lista, e seis coleções só existiam no `setupMongo` de desenvolvimento: favoritos, links externos,
 * pedidos de assinatura, assinaturas, aprovações de upload e contatos subiam em produção sem os
 * índices únicos que impedem duplicidade. A lista agora é esta, e um teste confere que ninguém ficou
 * de fora.
 *
 * `approval_requests` fica fora de propósito: tem caminho próprio, que remove índices substituídos
 * antes de garantir os novos.
 */
export function sharedAppIndexSpecs(): Array<{ collection: string; indexes: IndexDescription[] }> {
  return [
    { collection: SHARED_APP_COLLECTIONS.analysisJobs, indexes: ANALYSIS_JOB_INDEXES },
    { collection: SHARED_APP_COLLECTIONS.notifications, indexes: NOTIFICATION_INDEXES },
    {
      collection: SHARED_APP_COLLECTIONS.notificationDeliveries,
      indexes: NOTIFICATION_DELIVERY_INDEXES,
    },
    { collection: SHARED_APP_COLLECTIONS.documentRequests, indexes: DOCUMENT_REQUEST_INDEXES },
    {
      collection: SHARED_APP_COLLECTIONS.documentShareGrants,
      indexes: DOCUMENT_SHARE_GRANTS_INDEXES,
    },
    {
      collection: SHARED_APP_COLLECTIONS.userDocumentFavorites,
      indexes: USER_DOCUMENT_FAVORITES_INDEXES,
    },
    {
      collection: SHARED_APP_COLLECTIONS.externalDocumentShareGrants,
      indexes: EXTERNAL_DOCUMENT_SHARE_GRANTS_INDEXES,
    },
    {
      collection: SHARED_APP_COLLECTIONS.documentSignatureRequests,
      indexes: DOCUMENT_SIGNATURE_REQUESTS_INDEXES,
    },
    { collection: SHARED_APP_COLLECTIONS.documentSignatures, indexes: DOCUMENT_SIGNATURES_INDEXES },
    {
      collection: SHARED_APP_COLLECTIONS.documentUploadApprovals,
      indexes: DOCUMENT_UPLOAD_APPROVAL_INDEXES,
    },
    { collection: SHARED_APP_COLLECTIONS.savedContacts, indexes: SAVED_CONTACTS_INDEXES },
  ];
}
