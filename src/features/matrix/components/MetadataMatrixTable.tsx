import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { MetadataMatrix, MetadataMatrixColumn } from '../api/matrixApi';

/**
 * Os mesmos campos, em coluna, para o acervo de uma categoria.
 *
 * A edição é na própria célula: clicou, digitou, saiu do campo — grava. Corrigir uma data de
 * vencimento errada em dez contratos não pode custar dez telas.
 */
function inputTypeFor(type: string): string {
  if (type === 'date') return 'date';
  if (type === 'number' || type === 'currency') return 'number';
  return 'text';
}

function MetadataCell({
  value,
  column,
  source,
  isMissing,
  canEdit,
  isSaving,
  onCommit,
}: {
  value: string | number | null;
  column: MetadataMatrixColumn;
  source?: string;
  isMissing: boolean;
  canEdit: boolean;
  isSaving: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value === null || value === undefined ? '' : String(value));

  // O valor pode mudar por fora (outra edição, recarga da lista); o rascunho acompanha.
  useEffect(() => {
    setDraft(value === null || value === undefined ? '' : String(value));
  }, [value]);

  if (!canEdit) {
    return (
      <span className={cn('text-[12px]', isMissing ? 'text-doqyn-warning' : 'text-doqyn-text')}>
        {draft || '—'}
      </span>
    );
  }

  return (
    <span className="relative flex items-center">
      <input
        type={inputTypeFor(column.type)}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const normalized = draft.trim();
          const original = value === null || value === undefined ? '' : String(value);
          if (normalized === original) return;
          onCommit(normalized);
        }}
        placeholder={isMissing ? 'Preencher' : '—'}
        disabled={isSaving}
        className={cn(
          'w-full rounded-md border bg-transparent px-2 py-1 text-[12px] text-doqyn-text transition-colors placeholder:text-doqyn-subtle',
          'border-transparent hover:border-doqyn-border-subtle focus:border-doqyn-primary focus:bg-doqyn-bg',
          isMissing && 'border-doqyn-warning-border/60',
          isSaving && 'opacity-60',
        )}
        data-testid={`metadata-cell-${column.key}`}
      />
      {isSaving && (
        <Icon
          name="progress_activity"
          size={ICON_SIZE.xs}
          className="absolute right-1.5 animate-spin text-doqyn-muted"
        />
      )}
      {!isSaving && source === 'manual' && (
        <Tooltip label="Preenchido manualmente">
          <span className="absolute right-1.5 text-[9px] uppercase text-doqyn-subtle">m</span>
        </Tooltip>
      )}
    </span>
  );
}

export function MetadataMatrixTable({
  matrix,
  savingKey,
  onCommitField,
}: {
  matrix: MetadataMatrix;
  savingKey: string | null;
  onCommitField: (input: {
    documentId: string;
    column: MetadataMatrixColumn;
    value: string;
  }) => void;
}) {
  if (matrix.columns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-doqyn-border-subtle px-6 py-12 text-center">
        <Icon name="rule" size={28} className="mx-auto text-doqyn-subtle" />
        <p className="mt-2 text-sm text-doqyn-text">
          Esta categoria não tem campos configurados.
        </p>
        <p className="mt-1 text-xs text-doqyn-muted">
          Configure os campos em Regras para que eles apareçam aqui.
        </p>
      </div>
    );
  }

  if (matrix.rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-doqyn-border-subtle px-6 py-12 text-center">
        <Icon name="folder_open" size={28} className="mx-auto text-doqyn-subtle" />
        <p className="mt-2 text-sm text-doqyn-text">Nenhum documento nesta categoria.</p>
      </div>
    );
  }

  const pendingRows = matrix.rows.filter((row) => row.missingRequired.length > 0).length;

  return (
    <div className="overflow-hidden rounded-xl border border-doqyn-border-subtle">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-doqyn-border-subtle bg-doqyn-card/60">
              <th className="sticky left-0 z-20 min-w-[260px] bg-doqyn-card/95 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-doqyn-muted backdrop-blur">
                Documento
              </th>
              {matrix.columns.map((column) => (
                <th
                  key={column.key}
                  className="min-w-[150px] px-2 py-2.5 text-[11px] font-medium uppercase tracking-wide text-doqyn-muted"
                >
                  <span className="flex items-center gap-1">
                    {column.label}
                    {column.required && <span className="text-doqyn-warning">*</span>}
                    {column.isValidity && (
                      <Tooltip label="Esta coluna alimenta os alertas de vencimento">
                        <Icon name="notifications" size={ICON_SIZE.xs} className="text-doqyn-accent" />
                      </Tooltip>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {matrix.rows.map((row) => (
              <tr
                key={row.documentId}
                className="group border-b border-doqyn-border-subtle last:border-b-0 hover:bg-doqyn-surface-hover/40"
              >
                <td className="sticky left-0 z-10 bg-doqyn-bg/95 px-4 py-2 backdrop-blur group-hover:bg-doqyn-surface-hover/60">
                  <TruncatedText as="p" className="text-[13px] font-medium text-doqyn-text">
                    {row.fileName}
                  </TruncatedText>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-doqyn-muted">
                    {row.ownerName ?? '—'}
                    {row.missingRequired.length > 0 && (
                      <span className="rounded-full border border-doqyn-warning-border bg-doqyn-warning-bg px-1.5 text-[10px] text-doqyn-warning">
                        {row.missingRequired.length} em branco
                      </span>
                    )}
                    {!row.canEdit && (
                      <Tooltip label="Você não tem permissão para editar os metadados deste documento">
                        <Icon name="lock" size={ICON_SIZE.xs} className="text-doqyn-subtle" />
                      </Tooltip>
                    )}
                  </p>
                </td>

                {matrix.columns.map((column) => (
                  <td key={column.key} className="px-2 py-1.5">
                    <MetadataCell
                      value={row.values[column.key] ?? null}
                      column={column}
                      source={row.sources[column.key]}
                      isMissing={row.missingRequired.includes(column.key)}
                      canEdit={row.canEdit}
                      isSaving={savingKey === `${row.documentId}:${column.key}`}
                      onCommit={(value) =>
                        onCommitField({ documentId: row.documentId, column, value })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-doqyn-border-subtle bg-doqyn-card/40 px-4 py-2 text-[11px] text-doqyn-muted">
        <span>
          {matrix.rows.length} documento{matrix.rows.length > 1 ? 's' : ''}
          {pendingRows > 0 && ` · ${pendingRows} com campo obrigatório em branco`}
        </span>
        <span className="text-doqyn-subtle">A edição grava ao sair do campo</span>
      </div>
    </div>
  );
}
