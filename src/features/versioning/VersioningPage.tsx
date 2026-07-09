import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { UploadDropzone } from '@/components/ui/UploadDropzone';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { formatDate } from '@/lib/utils';
import { MOCK_DOCUMENTS } from '@/features/documents/mock-data';
import type { DocumentVersion } from '@/types/document';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { toast } from 'sonner';

const MOCK_VERSIONS: DocumentVersion[] = [
  {
    id: 'ver-001',
    documentId: 'doc-001',
    version: 1,
    originalFileName: 'contrato-fornecedor-2024-v1.pdf',
    displayName: 'Contrato Fornecedor 2024',
    fileSize: 245000,
    mimeType: 'application/pdf',
    hash: 'a3f8c2...',
    uploadedBy: 'Administrador DOQYN',
    uploadedAt: '2025-06-15T10:30:00Z',
    changeNotes: 'Versão inicial',
    status: 'processed',
    metadata: {},
  },
  {
    id: 'ver-002',
    documentId: 'doc-001',
    version: 2,
    originalFileName: 'contrato-fornecedor-2024.pdf',
    displayName: 'Contrato Fornecedor 2024',
    fileSize: 251000,
    mimeType: 'application/pdf',
    hash: 'b7e1d9...',
    uploadedBy: 'Administrador DOQYN',
    uploadedAt: '2025-06-18T14:22:00Z',
    changeNotes: 'Atualização de cláusulas contratuais',
    status: 'update_processed',
    metadata: {},
  },
];

export function VersioningPage() {
  const location = useLocation();
  const documentId = (location.state as { documentId?: string })?.documentId ?? 'doc-001';
  const document = MOCK_DOCUMENTS.find((d) => d.id === documentId) ?? MOCK_DOCUMENTS[0];
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [versions] = useState(MOCK_VERSIONS);

  const handleUploadVersion = () => {
    if (!selectedFile) {
      toast.error('Selecione o arquivo da nova versão');
      return;
    }
    toast.success('Nova versão registrada — versões anteriores preservadas');
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Histórico"
        title="Versionamento"
        description="Cada atualização cria uma nova versão preservada no histórico do documento."
      />

      <div className="flex items-start gap-3 rounded-lg border border-doqyn-border bg-doqyn-surface p-4">
        <Icon name="shield" size={ICON_SIZE.md} className="mt-0.5 shrink-0 text-doqyn-primary" />
        <div>
          <p className="text-sm font-medium text-doqyn-text">Rastreabilidade garantida</p>
          <p className="mt-1 text-xs text-doqyn-muted">
            Todas as versões anteriores permanecem disponíveis para auditoria e consulta. Nenhum
            documento é removido do histórico.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enviar nova versão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-doqyn-border bg-doqyn-bg p-3 text-sm">
              <p className="text-xs text-doqyn-muted">Documento selecionado</p>
              <p className="font-medium text-doqyn-text">{document.displayName}</p>
              <div className="mt-2 flex items-center gap-2">
                <VersionBadge version={document.version} isCurrent />
                <StatusPill status={document.status} />
              </div>
            </div>

            <UploadDropzone
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
              onClear={() => setSelectedFile(null)}
            />

            <Button onClick={handleUploadVersion} disabled={!selectedFile}>
              <Icon name="account_tree" size={ICON_SIZE.xs} />
              Registrar nova versão
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparação de versões</CardTitle>
          </CardHeader>
          <CardContent>
            {versions.length >= 2 ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md border border-doqyn-border p-3">
                    <p className="text-xs text-doqyn-muted">Versão anterior</p>
                    <VersionBadge version={versions[0].version} />
                    <p className="mt-2 text-doqyn-text">{versions[0].changeNotes}</p>
                    <p className="mt-1 text-xs text-doqyn-muted">
                      {formatDate(versions[0].uploadedAt)}
                    </p>
                  </div>
                  <div className="rounded-md border border-doqyn-primary/30 bg-doqyn-primary/5 p-3">
                    <p className="text-xs text-doqyn-muted">Versão atual</p>
                    <VersionBadge version={versions[1].version} isCurrent />
                    <p className="mt-2 text-doqyn-text">{versions[1].changeNotes}</p>
                    <p className="mt-1 text-xs text-doqyn-muted">
                      {formatDate(versions[1].uploadedAt)}
                    </p>
                  </div>
                </div>
                <Badge variant="warning">Alterações detectadas — revisão recomendada</Badge>
              </div>
            ) : (
              <p className="text-sm text-doqyn-muted">Apenas uma versão disponível</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de versões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...versions].reverse().map((ver) => (
              <div
                key={ver.id}
                className="flex items-center justify-between rounded-md border border-doqyn-border bg-doqyn-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <VersionBadge version={ver.version} isCurrent={ver.version === document.version} />
                  <div>
                    <p className="text-sm font-medium text-doqyn-text">{ver.changeNotes}</p>
                    <p className="text-xs text-doqyn-muted">
                      {ver.uploadedBy} · {formatDate(ver.uploadedAt)}
                    </p>
                  </div>
                </div>
                <StatusPill status={ver.status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
