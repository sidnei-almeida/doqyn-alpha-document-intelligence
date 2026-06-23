import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/StatusPill';
import { Textarea } from '@/components/ui/Textarea';
import { Timeline } from '@/components/ui/Timeline';
import { UploadDropzone } from '@/components/ui/UploadDropzone';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { ACCESS_GROUPS, DOCUMENT_TYPES, PROCESSING_STEPS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/features/auth/useAuth';
import { MOCK_DOCUMENTS } from '@/features/documents/mock-data';
import type { Document } from '@/types/document';

const uploadSchema = z.object({
  documentType: z.string().min(1, 'Selecione o tipo do documento'),
  notes: z.string().optional(),
});

type UploadForm = z.infer<typeof uploadSchema>;

export function UploadPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [accessGroups, setAccessGroups] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [recentUploads, setRecentUploads] = useState<Document[]>(MOCK_DOCUMENTS.slice(0, 3));

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { documentType: '', notes: '' },
  });

  const documentType = watch('documentType');

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadForm) => {
      if (!selectedFile) throw new Error('Selecione um arquivo');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', data.documentType);
      formData.append('accessGroups', JSON.stringify(accessGroups));
      if (data.notes) formData.append('notes', data.notes);
      formData.append('ownerUserId', user?.id ?? '');
      formData.append('ownerName', user?.name ?? '');
      formData.append('tenantId', user?.companyId ?? '');

      try {
        return await api.documents.upload(formData);
      } catch {
        // Simulated upload for alpha when API is unavailable
        await new Promise((r) => setTimeout(r, 1200));
        return {
          document: {
            id: 'doc-' + Date.now(),
            displayName: selectedFile.name.replace(/\.[^.]+$/, ''),
            documentType: data.documentType,
            status: 'analyzing',
            version: 1,
            area: accessGroups[0] ?? 'Geral',
            updatedAt: new Date().toISOString(),
          },
        };
      }
    },
    onSuccess: (result) => {
      setCurrentStep(2);
      toast.success('Documento enviado para análise');
      if (result.document) {
        const doc = result.document as Document;
        setRecentUploads((prev) => [doc, ...prev.slice(0, 4)]);
      }
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setTimeout(() => setCurrentStep(3), 1500);
      setTimeout(() => setCurrentStep(4), 3000);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro no envio');
    },
  });

  const toggleAccessGroup = (group: string) => {
    setAccessGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const onSubmit = (data: UploadForm) => {
    if (!selectedFile) {
      toast.error('Selecione um documento para enviar');
      return;
    }
    setCurrentStep(1);
    uploadMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enviar documento"
        description="Registre um novo documento com rastreabilidade e controle de acesso"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <UploadDropzone
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                onClear={() => setSelectedFile(null)}
              />

              <Select
                id="documentType"
                label="Tipo do documento"
                options={[
                  { value: '', label: 'Selecione o tipo' },
                  ...DOCUMENT_TYPES.map((t) => ({ value: t, label: t })),
                ]}
                error={errors.documentType?.message}
                {...register('documentType')}
              />

              <div>
                <p className="mb-2 text-xs font-medium text-doqyn-muted">Acesso inicial</p>
                <div className="flex flex-wrap gap-2">
                  {ACCESS_GROUPS.map((group) => (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleAccessGroup(group)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        accessGroups.includes(group)
                          ? 'border-doqyn-primary bg-doqyn-primary/10 text-doqyn-primary'
                          : 'border-doqyn-border bg-doqyn-surface text-doqyn-muted hover:border-doqyn-muted'
                      }`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                id="notes"
                label="Observações"
                placeholder="Informações adicionais sobre o documento (opcional)"
                rows={3}
                {...register('notes')}
              />

              <Button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={uploadMutation.isPending || !selectedFile}
                className="w-full sm:w-auto"
              >
                {uploadMutation.isPending ? 'Enviando...' : 'Enviar para análise'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Envios recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={recentUploads}
                keyExtractor={(d) => d.id}
                columns={[
                  {
                    key: 'name',
                    header: 'Documento',
                    render: (d) => (
                      <span className="font-medium text-doqyn-text">{d.displayName}</span>
                    ),
                  },
                  { key: 'type', header: 'Tipo', render: (d) => d.documentType },
                  { key: 'area', header: 'Área', render: (d) => d.area },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (d) => <StatusPill status={d.status} />,
                  },
                  {
                    key: 'version',
                    header: 'Versão',
                    render: (d) => <VersionBadge version={d.version} isCurrent />,
                  },
                  {
                    key: 'updated',
                    header: 'Última atualização',
                    render: (d) => (
                      <span className="text-doqyn-muted">{formatDate(d.updatedAt)}</span>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do envio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-doqyn-muted">Arquivo</span>
                <span className="max-w-[160px] truncate text-doqyn-text">
                  {selectedFile?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-doqyn-muted">Tipo</span>
                <span className="text-doqyn-text">{documentType || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-doqyn-muted">Acesso</span>
                <span className="text-doqyn-text">
                  {accessGroups.length > 0 ? accessGroups.join(', ') : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-doqyn-muted">Responsável</span>
                <span className="text-doqyn-text">{user?.name ?? '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fluxo do documento</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline steps={PROCESSING_STEPS} currentStep={currentStep} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
