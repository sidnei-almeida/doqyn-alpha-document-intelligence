import 'dotenv/config';
import { join } from 'node:path';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveSharedCollections } from '../server/tenancy/tenantResolver.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';
import { normalizeVersionLabel } from '../server/utils/versionLabelUtils.js';

const REPORT_PATH = join(process.cwd(), 'reports/DOCUMENT_VERSION_AUDIT.txt');

type AuditIssue = {
  tenantId: string;
  collection: string;
  documentId?: string;
  versionId?: string;
  issue: string;
};

function getTenantId(doc: Record<string, unknown>): string | undefined {
  const id = doc.tenantId ?? doc.companyId;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = isApplyFlag('DOCUMENT_VERSION_BACKFILL_APPLY');
  const report = createReportWriter();
  report.section('AUDITORIA DE VERSIONAMENTO DE DOCUMENTOS');
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Modo: ${apply ? 'APPLY (grava alterações)' : 'dry-run'}`);
  report.line(`Data: ${new Date().toISOString()}`);

  const db = await getDb();
  const tenants = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .toArray();

  let docsScanned = 0;
  let versionsScanned = 0;
  let issuesFound = 0;
  let backfillApplied = 0;
  const issues: AuditIssue[] = [];

  for (const tenant of tenants) {
    const names = resolveSharedCollections();
    const documents = db.collection(names.documents);
    const documentVersions = db.collection(names.documentVersions);

    const docs = await documents
      .find({ deletedAt: { $in: [null, undefined] } })
      .project({ _id: 1, currentVersionId: 1, currentVersionLabel: 1, versionCount: 1 })
      .toArray();

    for (const doc of docs) {
      docsScanned += 1;
      const record = doc as Record<string, unknown>;
      const documentId = String(record._id);
      const tenantId = getTenantId(record) ?? tenant.tenantId;

      const versions = await documentVersions
        .find({ documentId })
        .project({ _id: 1, versionLabel: 1, previousVersionId: 1, createdAt: 1 })
        .sort({ createdAt: 1 })
        .toArray();

      versionsScanned += versions.length;

      const versionCount = versions.length;
      const storedCount = record.versionCount as number | undefined;
      const currentVersionId = record.currentVersionId as string | undefined;

      if (!currentVersionId) {
        issuesFound += 1;
        issues.push({
          tenantId,
          collection: names.documents,
          documentId,
          issue: 'currentVersionId ausente',
        });
      }

      if (storedCount !== versionCount) {
        issuesFound += 1;
        issues.push({
          tenantId,
          collection: names.documents,
          documentId,
          issue: `versionCount divergente (doc=${storedCount ?? 'null'}, real=${versionCount})`,
        });

        if (apply) {
          await documents.updateOne(
            { _id: documentId },
            { $set: { versionCount, updatedAt: new Date() } },
          );
          backfillApplied += 1;
        }
      }

      const currentVersion = versions.find((v) => String(v._id) === currentVersionId);
      const currentLabel = normalizeVersionLabel(
        (record.currentVersionLabel as string | undefined) ??
          (currentVersion as Record<string, unknown> | undefined)?.versionLabel as string,
      );

      if (
        currentVersion &&
        normalizeVersionLabel((currentVersion as Record<string, unknown>).versionLabel as string) !==
          currentLabel
      ) {
        issuesFound += 1;
        issues.push({
          tenantId,
          collection: names.documents,
          documentId,
          issue: 'currentVersionLabel divergente da versão atual',
        });
      }

      if (apply && (!record.currentVersionLabel || record.currentVersionLabel !== currentLabel)) {
        await documents.updateOne(
          { _id: documentId },
          { $set: { currentVersionLabel: currentLabel, updatedAt: new Date() } },
        );
        backfillApplied += 1;
      }

      for (const version of versions) {
        const v = version as Record<string, unknown>;
        const versionId = String(v._id);
        const label = v.versionLabel as string | undefined;

        if (!label?.trim()) {
          issuesFound += 1;
          issues.push({
            tenantId,
            collection: names.documentVersions,
            documentId,
            versionId,
            issue: 'versionLabel ausente',
          });

          if (apply) {
            const index = versions.indexOf(version);
            const fallbackLabel = normalizeVersionLabel(`v${index + 1}`);
            await documentVersions.updateOne(
              { _id: versionId },
              {
                $set: {
                  versionLabel: fallbackLabel,
                  versionNumber: index + 1,
                  updatedAt: new Date(),
                },
              },
            );
            backfillApplied += 1;
          }
        } else if (label !== normalizeVersionLabel(label)) {
          issuesFound += 1;
          issues.push({
            tenantId,
            collection: names.documentVersions,
            documentId,
            versionId,
            issue: `versionLabel legado "${label}" -> "${normalizeVersionLabel(label)}"`,
          });

          if (apply) {
            await documentVersions.updateOne(
              { _id: versionId },
              {
                $set: {
                  versionLabel: normalizeVersionLabel(label),
                  updatedAt: new Date(),
                },
              },
            );
            backfillApplied += 1;
          }
        }
      }
    }
  }

  report.section('RESUMO');
  report.line(`Tenants auditados: ${tenants.length}`);
  report.line(`Documentos escaneados: ${docsScanned}`);
  report.line(`Versões escaneadas: ${versionsScanned}`);
  report.line(`Problemas encontrados: ${issuesFound}`);
  report.line(`Correções aplicadas: ${apply ? backfillApplied : 0}`);

  if (issues.length) {
    report.section('DETALHES (primeiros 100)');
    for (const issue of issues.slice(0, 100)) {
      report.line(
        `${issue.tenantId} | ${issue.collection} | doc=${issue.documentId ?? '—'} | ver=${issue.versionId ?? '—'} | ${issue.issue}`,
      );
    }
  } else {
    report.line('Nenhum problema encontrado.');
  }

  report.write(REPORT_PATH);
  console.log(`Relatório salvo em ${REPORT_PATH}`);
  console.log(
    `Documentos: ${docsScanned}, versões: ${versionsScanned}, problemas: ${issuesFound}, aplicados: ${apply ? backfillApplied : 0}`,
  );

  await closeMongoConnection();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
