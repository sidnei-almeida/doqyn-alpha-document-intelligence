import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { AccessMatrix, AccessMatrixCell, DocumentAccessOrigin } from '../api/matrixApi';
import { ORIGIN_PRIORITY, primaryOrigin } from './accessOrigin';

/**
 * Documentos nas linhas, pessoas nas colunas.
 *
 * A célula não diz só "tem acesso": diz **por quê**. É a diferença entre uma tabela bonita e uma
 * tabela em que dá para agir — quem vê "regra" sabe que revogar ali não resolve, porque o acesso
 * vem da categoria e vale para todos os documentos dela.
 */
const ORIGIN_LABEL: Record<DocumentAccessOrigin, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  governance: 'Regra da categoria',
  share: 'Compartilhado',
};

const ORIGIN_STYLE: Record<DocumentAccessOrigin, string> = {
  owner: 'bg-doqyn-primary/15 text-doqyn-primary border-doqyn-primary/30',
  admin: 'bg-doqyn-info/15 text-doqyn-info border-doqyn-info/30',
  governance: 'bg-doqyn-accent/15 text-doqyn-accent border-doqyn-accent/30',
  share: 'bg-doqyn-success/15 text-doqyn-success border-doqyn-success/30',
};

const ORIGIN_ICON: Record<DocumentAccessOrigin, string> = {
  owner: 'person',
  admin: 'shield_person',
  governance: 'rule',
  share: 'share',
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AccessMatrixTable({
  matrix,
  onShare,
  onRevoke,
  busyCellKey,
}: {
  matrix: AccessMatrix;
  onShare: (documentId: string, member: { userId: string; name: string }) => void;
  onRevoke: (documentId: string, shareGrantId: string, memberName: string) => void;
  busyCellKey: string | null;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);

  const cellIndex = useMemo(() => {
    const index = new Map<string, AccessMatrixCell>();
    for (const cell of matrix.cells) {
      index.set(`${cell.documentId}:${cell.membershipId}`, cell);
    }
    return index;
  }, [matrix.cells]);

  const groupNameById = useMemo(
    () => new Map(matrix.groups.map((group) => [group.groupId, group.name])),
    [matrix.groups],
  );

  if (matrix.documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-doqyn-border-subtle px-6 py-12 text-center">
        <Icon name="grid_off" size={28} className="mx-auto text-doqyn-subtle" />
        <p className="mt-2 text-sm text-doqyn-text">Nenhum documento nesta seleção.</p>
        <p className="mt-1 text-xs text-doqyn-muted">
          Ajuste a busca ou a categoria para ver a matriz.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-doqyn-border-subtle">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-doqyn-border-subtle bg-doqyn-card/60">
              <th className="sticky left-0 z-20 min-w-[260px] bg-doqyn-card/95 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-doqyn-muted backdrop-blur">
                Documento
              </th>
              {matrix.members.map((member) => (
                <th
                  key={member.membershipId}
                  className="min-w-[54px] px-1 py-2.5 text-center align-bottom"
                >
                  <Tooltip label={`${member.name} · ${member.email}`}>
                    <span
                      className={cn(
                        'mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold',
                        member.isAdmin
                          ? 'border-doqyn-info/40 bg-doqyn-info/10 text-doqyn-info'
                          : 'border-doqyn-border-subtle bg-doqyn-bg text-doqyn-muted',
                      )}
                    >
                      {initialsOf(member.name)}
                    </span>
                  </Tooltip>
                </th>
              ))}
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
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-doqyn-muted">
                    <span>{document.categoryName ?? 'Sem categoria'}</span>
                    {document.ownerName && <span>· {document.ownerName}</span>}
                    {document.externalShareCount > 0 && (
                      <Tooltip label={`${document.externalShareCount} link(s) externo(s) ativo(s)`}>
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-doqyn-warning-border bg-doqyn-warning-bg px-1.5 text-[10px] text-doqyn-warning">
                          <Icon name="link" size={ICON_SIZE.xs} />
                          {document.externalShareCount}
                        </span>
                      </Tooltip>
                    )}
                  </p>
                </td>

                {matrix.members.map((member) => {
                  const key = `${document.documentId}:${member.membershipId}`;
                  const cell = cellIndex.get(key);
                  const origin = cell ? primaryOrigin(cell.origins) : null;
                  const isBusy = busyCellKey === key;
                  const isOpen = openCell === key;

                  return (
                    <td key={member.membershipId} className="relative px-1 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setOpenCell(isOpen ? null : key)}
                        disabled={isBusy}
                        aria-label={`${member.name} — ${
                          origin ? ORIGIN_LABEL[origin] : 'sem acesso'
                        }`}
                        className={cn(
                          'mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition-colors',
                          origin
                            ? ORIGIN_STYLE[origin]
                            : 'border-transparent text-doqyn-subtle hover:border-doqyn-border-subtle',
                          isBusy && 'opacity-50',
                        )}
                        data-testid={`access-cell-${key}`}
                      >
                        {isBusy ? (
                          <Icon
                            name="progress_activity"
                            size={ICON_SIZE.xs}
                            className="animate-spin"
                          />
                        ) : origin ? (
                          <Icon name={ORIGIN_ICON[origin]} size={ICON_SIZE.xs} />
                        ) : (
                          <span className="text-[13px] leading-none">·</span>
                        )}
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 top-full z-30 mt-1 w-60 rounded-lg border border-doqyn-border-subtle bg-doqyn-card p-3 text-left shadow-lg">
                          <p className="text-[12px] font-medium text-doqyn-text">{member.name}</p>
                          <p className="truncate text-[11px] text-doqyn-muted">{member.email}</p>

                          <div className="mt-2 space-y-1">
                            {cell?.origins.length ? (
                              cell.origins.map((entry) => (
                                <p
                                  key={entry}
                                  className="flex items-center gap-1.5 text-[11px] text-doqyn-muted"
                                >
                                  <Icon
                                    name={ORIGIN_ICON[entry]}
                                    size={ICON_SIZE.xs}
                                    className="text-doqyn-subtle"
                                  />
                                  {ORIGIN_LABEL[entry]}
                                  {entry === 'governance' && cell.viaGroupIds.length > 0 && (
                                    <span className="text-doqyn-subtle">
                                      ({cell.viaGroupIds
                                        .map((groupId) => groupNameById.get(groupId) ?? groupId)
                                        .join(', ')})
                                    </span>
                                  )}
                                </p>
                              ))
                            ) : (
                              <p className="text-[11px] text-doqyn-muted">Sem acesso.</p>
                            )}
                          </div>

                          <div className="mt-2.5 flex flex-col gap-1.5">
                            {cell?.shareGrantId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCell(null);
                                  onRevoke(document.documentId, cell.shareGrantId as string, member.name);
                                }}
                                className="rounded-md border border-doqyn-border-subtle px-2 py-1 text-[12px] text-doqyn-danger hover:bg-doqyn-surface-hover"
                              >
                                Revogar compartilhamento
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCell(null);
                                  onShare(document.documentId, {
                                    userId: member.userId,
                                    name: member.name,
                                  });
                                }}
                                className="rounded-md border border-doqyn-border-subtle px-2 py-1 text-[12px] text-doqyn-text hover:bg-doqyn-surface-hover"
                              >
                                Compartilhar com {member.name.split(' ')[0]}
                              </button>
                            )}

                            {cell?.origins.includes('governance') && (
                              <Link
                                to="/rules"
                                className="rounded-md px-2 py-1 text-[11px] text-doqyn-info hover:bg-doqyn-surface-hover"
                              >
                                Este acesso vem da regra — abrir Regras
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-doqyn-border-subtle bg-doqyn-card/40 px-4 py-2">
        {ORIGIN_PRIORITY.map((origin) => (
          <span key={origin} className="flex items-center gap-1.5 text-[11px] text-doqyn-muted">
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border',
                ORIGIN_STYLE[origin],
              )}
            >
              <Icon name={ORIGIN_ICON[origin]} size={10} />
            </span>
            {ORIGIN_LABEL[origin]}
          </span>
        ))}
        <span className="text-[11px] text-doqyn-subtle">· célula vazia = sem acesso</span>
      </div>
    </div>
  );
}
