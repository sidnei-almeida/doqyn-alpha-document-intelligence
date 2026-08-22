import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { fetchCategoryFields } from '@/features/documents/api/documentsApi';
import type { ExtractedMetadata } from '@/features/document-send/types';
import { buildQuickFieldRows } from './quickFieldRows';

/**
 * Campos do documento, prontos para conferir e corrigir antes de salvar.
 *
 * A revisão mostrava o que a IA extraiu como texto — para consertar uma data errada era preciso
 * salvar e depois abrir a ficha do documento. Aqui cada campo é uma linha com input: clicou,
 * digitou, acabou. O que a categoria exige e ninguém preencheu aparece marcado, porque é o que
 * segura o documento na revisão manual.
 */
function inputTypeFor(fieldType: string): string {
  if (fieldType === 'date') return 'date';
  if (fieldType === 'number' || fieldType === 'currency') return 'number';
  return 'text';
}

export function QuickFieldsEditor({
  categoryId,
  metadata,
  overrides,
  onChange,
}: {
  categoryId: string | null;
  metadata: ExtractedMetadata;
  overrides: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const { data: categoryFields = [], isLoading } = useQuery({
    queryKey: ['category-fields', categoryId],
    queryFn: () => fetchCategoryFields(categoryId as string),
    enabled: Boolean(categoryId),
    staleTime: 5 * 60_000,
  });

  const rows = useMemo(
    () => buildQuickFieldRows({ categoryFields, metadata, overrides }),
    [categoryFields, metadata, overrides],
  );

  if (isLoading && rows.length === 0) {
    return <p className="text-[11px] text-doqyn-muted">Carregando campos da categoria…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-doqyn-muted">
        Esta categoria não tem campos configurados. O documento salva assim mesmo.
      </p>
    );
  }

  const missingRequired = rows.filter((row) => row.required && !row.value.trim()).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
          Campos do documento
        </p>
        {missingRequired > 0 && (
          <p className="text-[11px] text-doqyn-warning">
            {missingRequired} obrigatório{missingRequired > 1 ? 's' : ''} em branco
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {rows.map((row) => {
          const isMissing = row.required && !row.value.trim();

          return (
            <label key={row.key} className="flex items-center gap-2">
              <span
                className={cn(
                  'w-[38%] shrink-0 truncate text-[11px]',
                  isMissing ? 'text-doqyn-warning' : 'text-doqyn-muted',
                )}
                title={row.description ?? row.label}
              >
                {row.label}
                {row.required && <span aria-hidden> *</span>}
              </span>

              <span className="relative flex-1">
                <input
                  type={inputTypeFor(row.type)}
                  value={row.value}
                  onChange={(event) => onChange(row.key, event.target.value)}
                  placeholder={isMissing ? 'Preencher' : '—'}
                  className={cn(
                    'w-full rounded-md border bg-doqyn-bg px-2 py-1 text-[12px] text-doqyn-text placeholder:text-doqyn-subtle',
                    isMissing ? 'border-doqyn-warning-border' : 'border-doqyn-border-subtle',
                  )}
                  data-testid={`quick-field-${row.key}`}
                />
                {row.fromAi && (
                  <span
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-doqyn-subtle"
                    title="Valor extraído pela IA"
                  >
                    IA
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <p className="mt-2 flex items-center gap-1 text-[10px] text-doqyn-subtle">
        <Icon name="info" size={ICON_SIZE.xs} />O que você digitar entra como preenchimento manual na
        auditoria.
      </p>
    </div>
  );
}
