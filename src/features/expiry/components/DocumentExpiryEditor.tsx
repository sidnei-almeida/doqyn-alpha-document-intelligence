import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Input } from '@/components/ui/Input';
import {
  getDocumentMetadataSheet,
  updateDocumentMetadata,
  type DocumentMetadataSheet,
  type MetadataFieldPatch,
  type MetadataSheetRow,
} from '../api/expiryApi';

/**
 * Chave canônica de vencimento usada quando a categoria não declara nenhum campo de validade.
 * Manter em sincronia com `VALIDITY_SOURCE_KEYS` em `server/services/confirm/projectSearchMeta.ts`:
 * gravar outra chave preencheria o metadado sem nunca disparar alerta.
 */
const VALIDITY_KEY = 'data_vencimento';

export type DocumentExpiryEditorProps = {
  documentId: string;
  /** Vencimento conhecido pelo painel; a ficha do servidor prevalece quando carrega. */
  currentValidityDate?: string | null;
  canEdit: boolean;
  onSaved?: () => void;
};

/** Aceita ISO, `yyyy-mm-dd` e o `dd/mm/aaaa` que a extração costuma devolver. */
function toDateInputValue(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const text = String(raw).trim();
  if (!text) return '';

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function toInputValue(row: MetadataSheetRow): string {
  if (row.type === 'date') return toDateInputValue(row.value);
  return row.value === null || row.value === undefined ? '' : String(row.value);
}

function sourceLabel(row: MetadataSheetRow): {
  label: string;
  variant: 'success' | 'info' | 'warning' | 'neutral';
} {
  if (!row.filled) return { label: 'Faltando', variant: row.required ? 'warning' : 'neutral' };
  if (row.source === 'manual') return { label: 'Manual', variant: 'success' };
  return { label: 'Extraído', variant: 'info' };
}

/**
 * Urgência exibida vem dos dias restantes, não do marco configurado: o marco diz quando avisar,
 * os dias restantes dizem o quanto isso é grave hoje.
 */
function expiryNotice(
  sheet: DocumentMetadataSheet,
): { variant: 'danger' | 'warning' | 'info'; text: string } | null {
  if (sheet.daysRemaining === null) {
    if (!sheet.expiryAlerts?.enabled) return null;
    return {
      variant: 'warning',
      text: 'Sem data de vencimento gravada. Enquanto o campo estiver vazio, nenhum alerta desta categoria dispara para este documento.',
    };
  }

  const days = sheet.daysRemaining;
  if (days < 0) return { variant: 'danger', text: `Vencido há ${Math.abs(days)} dia(s).` };
  if (days === 0) return { variant: 'danger', text: 'Vence hoje.' };
  if (days <= 30) return { variant: 'warning', text: `Vence em ${days} dia(s).` };
  return { variant: 'info', text: `Vence em ${days} dia(s).` };
}

const NOTICE_CLASS: Record<'danger' | 'warning' | 'info', string> = {
  danger: 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
  warning: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
  info: 'border-doqyn-info-border bg-doqyn-info-bg text-doqyn-info',
};

/**
 * Ficha de metadados do documento, em tabela.
 *
 * Lista o que a categoria (regra do tenant) espera, o que a extração encontrou e o que ficou em
 * branco — a extração automática falha em documento escaneado ruim ou em layout desconhecido, e
 * sem vencimento gravado nenhum alerta dispara. Aqui o usuário completa o que faltou.
 */
export function DocumentExpiryEditor({
  documentId,
  currentValidityDate,
  canEdit,
  onSaved,
}: DocumentExpiryEditorProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extraFields, setExtraFields] = useState<
    Array<{ key: string; label: string; value: string }>
  >([]);

  const {
    data: sheet,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['document-metadata-sheet', documentId],
    queryFn: () => getDocumentMetadataSheet(documentId),
    enabled: Boolean(documentId),
  });

  const rows = useMemo(() => {
    if (!sheet) return [] as MetadataSheetRow[];
    // Sem nenhum campo de validade na regra, a linha canônica é acrescentada: é ela que alimenta
    // `searchMeta.validityDate`, e sem ela não haveria onde digitar o vencimento.
    if (sheet.rows.some((row) => row.isValidity)) return sheet.rows;

    const validityRow: MetadataSheetRow = {
      key: VALIDITY_KEY,
      label: 'Data de vencimento',
      type: 'date',
      required: false,
      value: sheet.validityDate ?? currentValidityDate ?? null,
      fromRule: false,
      filled: Boolean(sheet.validityDate ?? currentValidityDate),
      isValidity: true,
    };
    return [validityRow, ...sheet.rows];
  }, [sheet, currentValidityDate]);

  const initialValues = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = toInputValue(row);
    return map;
  }, [rows]);

  const dirtyKeys = Object.keys(drafts).filter((key) => drafts[key] !== (initialValues[key] ?? ''));
  const hasExtras = extraFields.some((field) => field.key.trim());
  const isDirty = dirtyKeys.length > 0 || hasExtras;

  const editable = canEdit && (sheet?.canEdit ?? true);

  const save = useMutation({
    mutationFn: async () => {
      const fields: MetadataFieldPatch[] = [];

      for (const key of dirtyKeys) {
        const row = rows.find((item) => item.key === key);
        const raw = drafts[key].trim();
        fields.push({
          key,
          label: row?.label,
          // Valor vazio apaga o campo no servidor — é como o usuário remove um dado errado.
          value: raw ? raw : null,
        });
      }

      for (const field of extraFields) {
        const key = field.key.trim();
        if (!key) continue;
        fields.push({
          key,
          label: field.label.trim() || key,
          value: field.value.trim() ? field.value.trim() : null,
        });
      }

      if (fields.length === 0) throw new Error('Nenhuma alteração para salvar.');
      return updateDocumentMetadata(documentId, fields);
    },
    onSuccess: (result) => {
      toast.success(
        result.validityDate
          ? 'Metadados salvos. Os alertas da categoria passam a valer para este documento.'
          : 'Metadados salvos.',
      );
      setDrafts({});
      setExtraFields([]);
      // A chave real do detalhe é ['document-detail', tenantId, documentId] — invalidar
      // ['document', ...] não casa por prefixo e o painel continuaria com a data antiga,
      // deixando o botão Salvar habilitado para sempre.
      void queryClient.invalidateQueries({ queryKey: ['document-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['expiry-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['document-metadata-sheet', documentId] });
      onSaved?.();
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error
          ? mutationError.message
          : 'Não foi possível salvar os metadados.',
      );
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando ficha de metadados…</p>;
  }

  if (error || !sheet) {
    return (
      <p className="text-muted-foreground text-sm">
        Não foi possível carregar os metadados deste documento.
      </p>
    );
  }

  const notice = expiryNotice(sheet);
  const missingRequired = rows.filter((row) => row.required && !row.filled).length;

  return (
    <div className="space-y-3">
      {notice && (
        <p className={`rounded-md border px-3 py-2 text-xs ${NOTICE_CLASS[notice.variant]}`}>
          {notice.text}
        </p>
      )}

      {missingRequired > 0 && (
        <p className="text-muted-foreground text-xs">
          {missingRequired} campo(s) obrigatório(s) da categoria
          {sheet.categoryName ? ` "${sheet.categoryName}"` : ''} sem preenchimento.
        </p>
      )}

      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground bg-doqyn-neutral-bg text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Campo</th>
              <th className="px-3 py-2 text-left font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">Origem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = sourceLabel(row);
              const value = drafts[row.key] ?? initialValues[row.key] ?? '';

              return (
                <tr key={row.key} className="border-border border-t align-middle">
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.label}</span>
                    {row.required && <span className="ml-1 text-doqyn-danger">*</span>}
                    <span className="text-muted-foreground block text-xs">{row.key}</span>
                  </td>
                  <td className="px-3 py-2">
                    {editable ? (
                      row.type === 'date' ? (
                        <DateInput
                          aria-label={row.label}
                          value={value}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [row.key]: event.target.value }))
                          }
                        />
                      ) : (
                        <Input
                          aria-label={row.label}
                          type={row.type === 'number' ? 'number' : 'text'}
                          placeholder={row.description ?? 'Não informado'}
                          value={value}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [row.key]: event.target.value }))
                          }
                        />
                      )
                    ) : (
                      <span className={value ? '' : 'text-muted-foreground'}>{value || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant={status.variant} size="xs">
                      {status.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!editable && (
        <p className="text-muted-foreground text-sm">
          Você não tem permissão para editar os metadados deste documento.
        </p>
      )}

      {editable && (
        <>
          {extraFields.length > 0 && (
            <div className="space-y-2">
              {extraFields.map((field, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    aria-label="Chave do campo"
                    placeholder="chave (ex.: numero_apolice)"
                    value={field.key}
                    onChange={(event) =>
                      setExtraFields((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, key: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label="Rótulo do campo"
                    placeholder="rótulo exibido"
                    value={field.label}
                    onChange={(event) =>
                      setExtraFields((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, label: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label="Valor do campo"
                    placeholder="valor"
                    value={field.value}
                    onChange={(event) =>
                      setExtraFields((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, value: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExtraFields((prev) => [...prev, { key: '', label: '', value: '' }])}
            >
              Adicionar campo fora da regra
            </Button>

            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={!isDirty || save.isPending}
            >
              {save.isPending ? 'Salvando…' : 'Salvar metadados'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
