import type { AuthUser } from '../auth/types.js';
import type { MongoDocument } from '../db/types.js';
import {
  assertCanUpdateDocument,
  loadDocumentAccessContext,
  resolveDocumentPermissions,
} from '../tenancy/documentAccess.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type RenameDocumentResult = {
  documentId: string;
  previousFileName: string;
  fileName: string;
  versionId: string;
};

const MAX_FILE_NAME_LENGTH = 180;

/** Extensão do nome, em minúsculas e sem o ponto. Vazio quando não há. */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/**
 * O nome é rótulo, não caminho: separador de diretório e caractere de controle
 * ficam de fora para que o valor nunca escape para o storage nem para um
 * cabeçalho `Content-Disposition`.
 */
function sanitizeFileName(rawName: string, currentName: string): string {
  // eslint-disable-next-line no-control-regex -- é exatamente o que se remove
  const name = rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim();

  if (!name) {
    throw new ServiceError('Informe um nome para o documento.', 'INVALID_FILE_NAME', 400);
  }
  if (name.length > MAX_FILE_NAME_LENGTH) {
    throw new ServiceError(
      `O nome do documento deve ter no máximo ${MAX_FILE_NAME_LENGTH} caracteres.`,
      'INVALID_FILE_NAME',
      400,
    );
  }
  if (/[\\/]/.test(name) || name === '.' || name === '..') {
    throw new ServiceError('O nome do documento não pode conter barras.', 'INVALID_FILE_NAME', 400);
  }

  // Trocar a extensão faria o arquivo mentir sobre o próprio formato: o objeto
  // no storage continua sendo o mesmo PDF ou a mesma imagem.
  const currentExtension = fileExtension(currentName);
  if (currentExtension && fileExtension(name) !== currentExtension) {
    throw new ServiceError(
      `O nome deve terminar em .${currentExtension}.`,
      'INVALID_FILE_EXTENSION',
      400,
    );
  }

  return name;
}

/**
 * Renomeia o documento — o rótulo, não o arquivo.
 *
 * O nome vive em dois lugares com propósitos diferentes: `documents.currentFileName`
 * é como o documento se chama hoje, e `document_versions.finalFileName` é o nome
 * com que cada versão entrou. Renomear mexe só no primeiro.
 *
 * É isso que mantém a história de pé quando existem versões anteriores: a
 * identidade do documento é o `_id`, nunca o nome. A v1 continua registrada com
 * o nome que tinha, a nova versão entra com o nome novo, e a trilha guarda o
 * antes e o depois do rótulo. O objeto no storage (`storageFileName`) também
 * não é tocado — renomear um arquivo já gravado é caro, é arriscado e não muda
 * nada do que a pessoa vê.
 */
export async function renameDocument(input: {
  tenantId: string;
  documentId: string;
  fileName: string;
  user: AuthUser;
  userId: string;
  membershipId?: string;
}): Promise<RenameDocumentResult> {
  const collections = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });
  const scope = tenantScopeFilterFromContext(collections.storage);

  const document = (await collections.documents.findOne({
    _id: input.documentId,
    ...scope,
  } as Record<string, unknown>)) as MongoDocument | null;

  if (!document) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: input.tenantId,
    userId: input.userId,
    membershipId: input.membershipId,
  });

  // Renomear é alterar o documento: mesma permissão de atualização.
  assertCanUpdateDocument(
    resolveDocumentPermissions(input.user, document, memberGroupIds, governanceIndex),
  );

  const previousFileName = document.currentFileName;
  const fileName = sanitizeFileName(input.fileName, previousFileName);

  if (fileName === previousFileName) {
    return {
      documentId: document._id,
      previousFileName,
      fileName,
      versionId: document.currentVersionId,
    };
  }

  await collections.documents.updateOne(
    { _id: document._id, ...scope } as Record<string, unknown>,
    {
      $set: {
        currentFileName: fileName,
        // `title` é o que a busca e as listagens leem quando não há nome de
        // arquivo; deixá-lo para trás faria o documento aparecer com dois nomes.
        title: fileName,
        updatedAt: new Date(),
      },
    },
  );

  return {
    documentId: document._id,
    previousFileName,
    fileName,
    versionId: document.currentVersionId,
  };
}
