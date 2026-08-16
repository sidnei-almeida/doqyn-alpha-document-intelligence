import { useMemo } from 'react';
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

export function GroupAccessMatrixTable({ matrix }: { matrix: AccessMatrix }) {
  const cellIndex = useMemo(() => {
    const index = new Map<string, AccessMatrixGroupCell>();
    for (const cell of matrix.groupCells) {
      index.set(`${cell.documentId}:${cell.groupId}`, cell);
    }
    return index;
  }, [matrix.groupCells]);

  if (matrix.groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-doqyn-border-subtle px-6 py-12 text-center">
        <Icon name="groups" size={28} className="mx-auto text-doqyn-subtle" />
        <p className="mt-2 text-sm text-doqyn-text">Nenhum grupo configurado.</p>
        <p className="mt-1 text-xs text-doqyn-muted">
          Crie grupos em Regras para governar o acesso por equipe em vez de pessoa a pessoa.
        </p>
      </div>
    );
  }

  if (matrix.documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-doqyn-border-subtle px-6 py-12 text-center">
        <Icon name="grid_off" size={28} className="mx-auto text-doqyn-subtle" />
        <p className="mt-2 text-sm text-doqyn-text">Nenhum documento nesta seleção.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-doqyn-border-subtle">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-doqyn-border-subtle bg-doqyn-card/60">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 min-w-[260px] bg-doqyn-card/95 px-4 py-2.5 align-bottom text-[11px] font-medium uppercase tracking-wide text-doqyn-muted backdrop-blur"
              >
                Documento
              </th>
              {matrix.groups.map((group) => (
                <th
                  key={group.groupId}
                  colSpan={PERMISSION_COLUMNS.length}
                  className="border-l border-doqyn-border-subtle px-2 py-2 text-center"
                >
                  <span className="block truncate text-[12px] font-medium text-doqyn-text">
                    {group.name}
                  </span>
                  <span className="block text-[10px] text-doqyn-subtle">
                    {group.memberCount} pessoa{group.memberCount === 1 ? '' : 's'}
                  </span>
                </th>
              ))}
            </tr>
            <tr className="border-b border-doqyn-border-subtle bg-doqyn-card/40">
              {matrix.groups.map((group) =>
                PERMISSION_COLUMNS.map((column, index) => (
                  <th
                    key={`${group.groupId}:${column.key}`}
                    className={cn(
                      'min-w-[38px] px-1 pb-1.5 text-center',
                      index === 0 && 'border-l border-doqyn-border-subtle',
                    )}
                  >
                    <Tooltip label={`${column.label} — ${group.name}`}>
                      <span className="flex justify-center text-doqyn-subtle">
                        <Icon name={column.icon} size={ICON_SIZE.xs} />
                      </span>
                    </Tooltip>
                  </th>
                )),
              )}
            </tr>
          </thead>

          <tbody>
            {matrix.documents.map((document) => (
              <tr
                key={document.documentId}
                className="group border-b border-doqyn-border-subtle last:border-b-0 hover:bg-doqyn-surface-hover/40"
              >
                <td className="sticky left-0 z-10 bg-doqyn-bg/95 px-4 py-2.5 backdrop-blur group-hover:bg-doqyn-surface-hover/60">
                  <TruncatedText as="p" className="text-[13px] font-medium text-doqyn-text">
                    {document.fileName}
                  </TruncatedText>
                  <p className="mt-0.5 text-[11px] text-doqyn-muted">
                    {document.categoryName ?? 'Sem categoria'}
                    {document.ownerName && ` · ${document.ownerName}`}
                  </p>
                </td>

                {matrix.groups.map((group) => {
                  const cell = cellIndex.get(`${document.documentId}:${group.groupId}`);

                  return PERMISSION_COLUMNS.map((column, index) => {
                    const granted = Boolean(cell?.[column.key]);

                    return (
                      <td
                        key={`${group.groupId}:${column.key}`}
                        className={cn(
                          'px-1 py-2 text-center',
                          index === 0 && 'border-l border-doqyn-border-subtle',
                        )}
                      >
                        <span
                          className={cn(
                            'mx-auto flex h-5 w-5 items-center justify-center rounded',
                            granted
                              ? 'bg-doqyn-accent/15 text-doqyn-accent'
                              : 'text-doqyn-subtle/50',
                          )}
                          aria-label={`${column.label}: ${granted ? 'permitido' : 'não permitido'}`}
                        >
                          {granted ? (
                            <Icon name="check" size={ICON_SIZE.xs} />
                          ) : (
                            <span className="text-[12px] leading-none">·</span>
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-doqyn-border-subtle bg-doqyn-card/40 px-4 py-2 text-[11px] text-doqyn-muted">
        <span className="flex flex-wrap items-center gap-3">
          {PERMISSION_COLUMNS.map((column) => (
            <span key={column.key} className="flex items-center gap-1">
              <Icon name={column.icon} size={ICON_SIZE.xs} className="text-doqyn-subtle" />
              {column.label}
            </span>
          ))}
        </span>
        <Link to="/rules" className="text-doqyn-info hover:underline">
          Conceder ou remover em Regras
        </Link>
      </div>
    </div>
  );
}
