import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { AccessMatrix, AccessMatrixGroupCell } from '../api/matrixApi';

/**
 * Permissão por grupo — a leitura que serve para governar.
 *
 * Pessoa entra e sai de grupo o tempo todo; a regra da categoria é o que permanece. Aqui cada
 * coluna é um verbo (ver, baixar, alterar, auditar, compartilhar) e o que a célula mostra é o que a
 * regra concede àquele grupo na categoria do documento — a mesma fonte que o servidor consulta na
 * hora de autorizar, não uma cópia.
 */
const PERMISSION_COLUMNS: Array<{
  key: keyof Pick<
    AccessMatrixGroupCell,
    'canView' | 'canDownload' | 'canUpdate' | 'canAudit' | 'canShare'
  >;
  label: string;
  icon: string;
}> = [
  { key: 'canView', label: 'Ver', icon: 'visibility' },
  { key: 'canDownload', label: 'Baixar', icon: 'download' },
  { key: 'canUpdate', label: 'Alterar', icon: 'edit' },
  { key: 'canAudit', label: 'Auditar', icon: 'fact_check' },
  { key: 'canShare', label: 'Compartilhar', icon: 'share' },
];

function EmptyNotice({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center px-6 py-12 text-center">
      <Icon name={icon} size={ICON_SIZE.md} className="mb-4 text-doqyn-border-strong" />
      <p className="text-label font-medium text-doqyn-text">{title}</p>
      {hint && <p className="mt-1.5 max-w-[42ch] text-caption text-doqyn-muted">{hint}</p>}
    </div>
  );
}

export function GroupAccessMatrixTable({ matrix }: { matrix: AccessMatrix }) {
  const [hoverColumn, setHoverColumn] = useState<string | null>(null);

  const cellIndex = useMemo(() => {
    const index = new Map<string, AccessMatrixGroupCell>();
    // Campo opcional de propósito: durante um deploy a aba pode estar aberta contra uma API que
    // ainda não devolve `groupCells`, e derrubar a tela inteira por isso é pior que uma tabela vazia.
    for (const cell of matrix.groupCells ?? []) {
      index.set(`${cell.documentId}:${cell.groupId}`, cell);
    }
    return index;
  }, [matrix.groupCells]);

  if ((matrix.groups ?? []).length === 0) {
    return (
      <EmptyNotice
        icon="groups"
        title="Nenhum grupo configurado"
        hint="Crie grupos em Regras para governar o acesso por equipe em vez de pessoa a pessoa."
      />
    );
  }

  if ((matrix.documents ?? []).length === 0) {
    return (
      <EmptyNotice
        icon="grid_off"
        title="Nenhum documento nesta seleção"
        hint="Ajuste a busca ou a categoria para ver a matriz."
      />
    );
  }

  return (
    <div className="matrix-grid" onMouseLeave={() => setHoverColumn(null)}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[32%] min-w-[18rem]" />
            {matrix.groups.map((group) =>
              PERMISSION_COLUMNS.map((column) => (
                <col
                  key={`${group.groupId}:${column.key}`}
                  style={{ width: `${68 / (matrix.groups.length * PERMISSION_COLUMNS.length)}%` }}
                />
              )),
            )}
          </colgroup>
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="matrix-sticky-col matrix-head-label z-20 min-w-[18rem] px-4 py-3 text-left align-bottom"
              >
                Documento
              </th>
              {matrix.groups.map((group) => (
                <th
                  key={group.groupId}
                  colSpan={PERMISSION_COLUMNS.length}
                  className="border-l border-doqyn-border-subtle px-2 pb-2 pt-3 text-center"
                >
                  <span className="block truncate text-label font-medium text-doqyn-text">
                    {group.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-micro tabular-nums text-doqyn-subtle">
                    {group.memberCount} pessoa{group.memberCount === 1 ? '' : 's'}
                  </span>
                </th>
              ))}
            </tr>
            <tr className="border-b border-doqyn-border-subtle">
              {matrix.groups.map((group) =>
                PERMISSION_COLUMNS.map((column, index) => {
                  const columnKey = `${group.groupId}:${column.key}`;
                  return (
                    <th
                      key={columnKey}
                      onMouseEnter={() => setHoverColumn(columnKey)}
                      className={cn(
                        'min-w-[2.5rem] px-1 pb-2 text-center',
                        index === 0 && 'border-l border-doqyn-border-subtle',
                        hoverColumn === columnKey && 'matrix-col-active',
                      )}
                    >
                      <Tooltip label={`${column.label} — ${group.name}`}>
                        <span className="flex justify-center text-doqyn-subtle">
                          <Icon name={column.icon} size={ICON_SIZE.xs} />
                        </span>
                      </Tooltip>
                    </th>
                  );
                }),
              )}
            </tr>
          </thead>

          <tbody>
            {matrix.documents.map((document) => (
              <tr key={document.documentId} className="matrix-row group">
                <td className="matrix-sticky-col px-4 py-3">
                  <TruncatedText as="p" className="text-label font-medium text-doqyn-text">
                    {document.fileName}
                  </TruncatedText>
                  <p className="mt-1 text-caption text-doqyn-muted">
                    {document.categoryName ?? 'Sem categoria'}
                    {document.ownerName && ` · ${document.ownerName}`}
                  </p>
                </td>

                {matrix.groups.map((group) => {
                  const cell = cellIndex.get(`${document.documentId}:${group.groupId}`);

                  return PERMISSION_COLUMNS.map((column, index) => {
                    const granted = Boolean(cell?.[column.key]);
                    const columnKey = `${group.groupId}:${column.key}`;

                    return (
                      <td
                        key={columnKey}
                        onMouseEnter={() => setHoverColumn(columnKey)}
                        className={cn(
                          'px-1 py-2 text-center',
                          index === 0 && 'border-l border-doqyn-border-subtle',
                          hoverColumn === columnKey && 'matrix-col-active',
                        )}
                      >
                        <span
                          className={cn(
                            'mx-auto flex h-5 w-5 items-center justify-center',
                            granted ? 'text-doqyn-text' : 'text-doqyn-subtle/60',
                          )}
                          aria-label={`${column.label}: ${granted ? 'permitido' : 'não permitido'}`}
                        >
                          {granted ? (
                            <Icon name="check" size={ICON_SIZE.xs} />
                          ) : (
                            <span className="text-caption leading-none">·</span>
                          )}
                        </span>
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {PERMISSION_COLUMNS.map((column) => (
            <span key={column.key} className="flex items-center gap-1.5 text-caption text-doqyn-muted">
              <Icon name={column.icon} size={ICON_SIZE.xs} className="text-doqyn-subtle" />
              {column.label}
            </span>
          ))}
        </span>
        <Link to="/rules" className="text-caption font-medium text-doqyn-muted hover:text-doqyn-text">
          Conceder ou remover em Regras
        </Link>
      </div>
    </div>
  );
}
