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
 *
 * Quatro cores para quatro origens era decoração: quem carrega a diferença é o glifo, e a cor
 * volta a significar uma coisa só. O acento fica reservado ao compartilhamento — a única origem
 * que se pode conceder e revogar daqui, e portanto a única interativa.
 */
const ORIGIN_LABEL: Record<DocumentAccessOrigin, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  governance: 'Regra da categoria',
  share: 'Compartilhado',
};

const ORIGIN_ICON: Record<DocumentAccessOrigin, string> = {
  owner: 'person',
  admin: 'shield_person',
  governance: 'rule',
  share: 'share',
};

const ORIGIN_INK: Record<DocumentAccessOrigin, string> = {
  owner: 'text-doqyn-text',
  admin: 'text-doqyn-text',
  governance: 'text-doqyn-muted',
  share: 'text-doqyn-primary',
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
  // Linha e coluna acendem juntas: é o dedo percorrendo a grade, e sem isso
  // ninguém acerta qual coluna é qual sete pessoas adiante.
  const [hoverColumn, setHoverColumn] = useState<string | null>(null);

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
      <div className="flex min-h-[12rem] flex-col items-center justify-center px-6 py-12 text-center">
        <Icon name="grid_off" size={ICON_SIZE.md} className="mb-4 text-doqyn-border-strong" />
        <p className="text-label font-medium text-doqyn-text">Nenhum documento nesta seleção</p>
        <p className="mt-1.5 max-w-[42ch] text-caption text-doqyn-muted">
          Ajuste a busca ou a categoria para ver a matriz.
        </p>
      </div>
    );
  }

  return (
    <div className="matrix-grid" onMouseLeave={() => setHoverColumn(null)}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          {/* Sem colgroup a coluna do documento engolia a folga e jogava as
              pessoas todas contra a borda direita. A grade só se lê quando as
              colunas de pessoa têm a mesma largura. */}
          <colgroup>
            <col className="w-[38%] min-w-[18rem]" />
            {matrix.members.map((member) => (
              <col key={member.membershipId} style={{ width: `${62 / matrix.members.length}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-doqyn-border-subtle">
              <th className="matrix-sticky-col matrix-head-label z-20 min-w-[18rem] px-4 py-3 text-left">
                Documento
              </th>
              {matrix.members.map((member) => (
                <th
                  key={member.membershipId}
                  onMouseEnter={() => setHoverColumn(member.membershipId)}
                  className={cn(
                    'min-w-[3.25rem] px-1 py-2.5 text-center align-bottom',
                    hoverColumn === member.membershipId && 'matrix-col-active',
                  )}
                >
                  <Tooltip label={`${member.name} · ${member.email}`}>
                    <span
                      className={cn(
                        'mx-auto flex h-7 w-7 items-center justify-center rounded-[4px] border font-mono text-micro',
                        member.isAdmin
                          ? 'border-doqyn-border-strong text-doqyn-text'
                          : 'border-doqyn-border-subtle text-doqyn-muted',
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
              <tr key={document.documentId} className="matrix-row group">
                <td className="matrix-sticky-col px-4 py-3">
                  <TruncatedText as="p" className="text-label font-medium text-doqyn-text">
                    {document.fileName}
                  </TruncatedText>
                  <p className="mt-1 flex items-center gap-1.5 text-caption text-doqyn-muted">
                    <span>{document.categoryName ?? 'Sem categoria'}</span>
                    {document.ownerName && <span>· {document.ownerName}</span>}
                    {document.externalShareCount > 0 && (
                      <Tooltip label={`${document.externalShareCount} link(s) externo(s) ativo(s)`}>
                        <span className="inline-flex items-center gap-0.5 rounded-[2px] bg-doqyn-warning-bg px-1.5 font-mono text-micro text-doqyn-warning">
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
                    <td
                      key={member.membershipId}
                      onMouseEnter={() => setHoverColumn(member.membershipId)}
                      className={cn(
                        'relative px-1 py-2 text-center',
                        hoverColumn === member.membershipId && 'matrix-col-active',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenCell(isOpen ? null : key)}
                        disabled={isBusy}
                        aria-label={`${member.name} — ${
                          origin ? ORIGIN_LABEL[origin] : 'sem acesso'
                        }`}
                        className={cn(
                          'mx-auto flex h-6 w-6 items-center justify-center rounded-[2px] transition-colors',
                          origin ? ORIGIN_INK[origin] : 'text-doqyn-subtle/60',
                          'hover:bg-doqyn-hover/60',
                          isBusy && 'opacity-50',
                          isOpen && 'bg-doqyn-hover/60',
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
                          <span className="text-caption leading-none">·</span>
                        )}
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-[4px] border border-doqyn-border-subtle bg-doqyn-card p-3 text-left shadow-lg">
                          <p className="text-label font-medium text-doqyn-text">{member.name}</p>
                          <p className="truncate font-mono text-micro text-doqyn-subtle">
                            {member.email}
                          </p>

                          <div className="mt-2.5 space-y-1.5 border-t border-doqyn-border-subtle pt-2.5">
                            {cell?.origins.length ? (
                              cell.origins.map((entry) => (
                                <p
                                  key={entry}
                                  className="flex items-center gap-1.5 text-caption text-doqyn-muted"
                                >
                                  <Icon
                                    name={ORIGIN_ICON[entry]}
                                    size={ICON_SIZE.xs}
                                    className="text-doqyn-subtle"
                                  />
                                  {ORIGIN_LABEL[entry]}
                                  {entry === 'governance' && cell.viaGroupIds.length > 0 && (
                                    <span className="text-doqyn-subtle">
                                      (
                                      {cell.viaGroupIds
                                        .map((groupId) => groupNameById.get(groupId) ?? groupId)
                                        .join(', ')}
                                      )
                                    </span>
                                  )}
                                </p>
                              ))
                            ) : (
                              <p className="text-caption text-doqyn-muted">Sem acesso.</p>
                            )}
                          </div>

                          <div className="mt-2.5 flex flex-col items-start gap-1.5 border-t border-doqyn-border-subtle pt-2.5">
                            {cell?.shareGrantId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCell(null);
                                  onRevoke(
                                    document.documentId,
                                    cell.shareGrantId as string,
                                    member.name,
                                  );
                                }}
                                className="text-caption font-medium text-doqyn-danger hover:underline"
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
                                className="text-caption font-medium text-doqyn-text hover:underline"
                              >
                                Compartilhar com {member.name.split(' ')[0]}
                              </button>
                            )}

                            {cell?.origins.includes('governance') && (
                              <Link to="/rules" className="text-caption text-doqyn-muted hover:underline">
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

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        {ORIGIN_PRIORITY.map((origin) => (
          <span key={origin} className="flex items-center gap-1.5 text-caption text-doqyn-muted">
            <Icon name={ORIGIN_ICON[origin]} size={ICON_SIZE.xs} className={ORIGIN_INK[origin]} />
            {ORIGIN_LABEL[origin]}
          </span>
        ))}
        <span className="font-mono text-micro text-doqyn-subtle">célula vazia = sem acesso</span>
      </div>
    </div>
  );
}
