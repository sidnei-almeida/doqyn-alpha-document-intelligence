/** objectKey fake seguro para ambiente dev — sem URL real nem PII. */
export function buildDevStorageObjectKey(
  tenantId: string,
  documentId: string,
  versionNumber: number,
): string {
  return `dev/${tenantId}/documents/${documentId}/v${versionNumber}.pdf`;
}
