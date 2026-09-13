import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type {
  AccessMatrix,
  AccessMatrixCell,
  AccessMatrixDocument,
  AccessMatrixMember,
  DocumentAccessOrigin,
} from '../api/matrixApi';
import { ORIGIN_PRIORITY, primaryOrigin } from './accessOrigin';
import { useTranslation } from 'react-i18next';

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
const ORIGIN_LABEL_KEY: Record<DocumentAccessOrigin, string> = {
  owner: 'origin.owner',
  admin: 'origin.admin',
  governance: 'origin.governance',
  share: 'origin.share',
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

const VERB_ROWS: Array<{
  key: 'canView' | 'canDownload' | 'canUpdate' | 'canAudit' | 'canShare';
  /** Chave do namespace `matrix`. */
  labelKey: string;
}> = [
  { key: 'canView', labelKey: 'verb.canView' },
  { key: 'canDownload', labelKey: 'verb.canDownload' },
  { key: 'canUpdate', labelKey: 'verb.canUpdate' },
  { key: 'canAudit', labelKey: 'verb.canAudit' },
  { key: 'canShare', labelKey: 'verb.canShare' },
];

/**
 * Célula da grade — o cartão abre no hover e vive em portal.
 *
 * Antes ele era filho da célula: nascia dentro do contêiner rolável e a grade criava uma barra de
 * rolagem para caber um cartão que deveria flutuar por cima dela. Em portal, a grade só rola
 * quando os documentos passam do limite, que é quando rolar significa alguma coisa.
 *
 * Abre no hover porque a célula é para ler, não para acionar: pedir um clique para descobrir o que
 * uma marca significa é cobrar pedágio em cada célula da matriz. O clique continua valendo (é o
 * caminho do toque) e o foco pelo teclado abre igual.
 */
function AccessCell({
  document: doc,
  member,
  cell,
  origin,
  isBusy,
  groupNameById,
  onShare,
  onRevoke,
}: {
  document: AccessMatrixDocument;
  member: AccessMatrixMember;
  cell?: AccessMatrixCell;
  origin: DocumentAccessOrigin | null;
  isBusy: boolean;
  groupNameById: Map<string, string>;
  onShare: (documentId: string, member: { userId: string; name: string }) => void;
  onRevoke: (documentId: string, shareGrantId: string, memberName: string) => void;
}) {
  const { t } = useTranslation('matrix');

  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // A folga na saída é o que permite atravessar o vão entre a célula e o cartão
  // sem que ele feche no meio do caminho.
  const scheduleOpen = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => setOpen(true), 90);
  }, [clearTimer]);

  const scheduleClose = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => setOpen(false), 160);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const permissions = cell?.permissions;
  const key = `${doc.documentId}:${member.membershipId}`;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
        disabled={isBusy}
        aria-label={`${member.name}: ${origin ? t(ORIGIN_LABEL_KEY[origin]) : t('noAccess')}`}
        aria-expanded={open}
        className={cn(
          'mx-auto flex h-6 w-6 items-center justify-center rounded-[2px] transition-colors',
          origin ? ORIGIN_INK[origin] : 'text-doqyn-subtle/60',
          'hover:bg-doqyn-hover/60 focus-visible:bg-doqyn-hover/60 focus-visible:outline-none',
          isBusy && 'opacity-50',
          open && 'bg-doqyn-hover/60',
        )}
        data-testid={`access-cell-${key}`}
      >
        {isBusy ? (
          <Icon name="progress_activity" size={ICON_SIZE.xs} className="animate-spin" />
        ) : origin ? (
          <Icon name={ORIGIN_ICON[origin]} size={ICON_SIZE.xs} />
        ) : (
          <span className="text-caption leading-none">·</span>
        )}
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        className="w-64"
        aria-label={t('accessMatrixTable.accessOf', { name: member.name })}
      >
        <div className="p-3" onMouseEnter={clearTimer} onMouseLeave={scheduleClose}>
          <p className="text-label font-medium text-doqyn-text">{member.name}</p>
          <p className="truncate font-mono text-micro text-doqyn-subtle">{member.email}</p>

          <div className="mt-3 border-t border-doqyn-border-subtle pt-2.5">
            <p className="matrix-head-label">{t('accessMatrixTable.origem')}</p>
            <div className="mt-1.5 space-y-1">
              {cell?.origins.length ? (
                cell.origins.map((entry) => (
                  <p
                    key={entry}
                    className="flex items-center gap-1.5 text-caption text-doqyn-muted"
                  >
                    <Icon
                      name={ORIGIN_ICON[entry]}
                      size={ICON_SIZE.xs}
                      className="shrink-0 text-doqyn-subtle"
                    />
                    {t(ORIGIN_LABEL_KEY[entry])}
                    {entry === 'governance' && cell.viaGroupIds.length > 0 && (
                      <span className="truncate text-doqyn-subtle">
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
                <p className="text-caption text-doqyn-muted">
                  {t('accessMatrixTable.semAcessoAEste')}
                </p>
              )}
            </div>
          </div>

          {permissions && (
            <div className="mt-3 border-t border-doqyn-border-subtle pt-2.5">
              <p className="matrix-head-label">{t('accessMatrixTable.pode')}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                {VERB_ROWS.map((verb) => {
                  const granted = permissions[verb.key];
                  return (
                    <p
                      key={verb.key}
                      className={cn(
                        'flex items-center gap-1.5 text-caption',
                        granted ? 'text-doqyn-text' : 'text-doqyn-subtle/60',
                      )}
                    >
                      {granted ? (
                        <Icon name="check" size={ICON_SIZE.xs} className="shrink-0" />
                      ) : (
                        <span className="w-4 shrink-0 text-center leading-none">·</span>
                      )}
                      {t(verb.labelKey)}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-col items-start gap-1.5 border-t border-doqyn-border-subtle pt-2.5">
            {cell?.shareGrantId ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRevoke(doc.documentId, cell.shareGrantId as string, member.name);
                }}
                className="text-caption font-medium text-doqyn-danger hover:underline"
              >
                {t('accessMatrixTable.revogarCompartilhamento')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onShare(doc.documentId, { userId: member.userId, name: member.name });
                }}
                className="text-caption font-medium text-doqyn-text hover:underline"
              >
                {t('accessMatrixTable.compartilharCom')} {member.name.split(' ')[0]}
              </button>
            )}

            {cell?.origins.includes('governance') && (
              <Link to="/rules" className="text-caption text-doqyn-muted hover:underline">
                {t('accessMatrixTable.esteAcessoVemDa')}
              </Link>
            )}
          </div>
        </div>
      </AnchoredPopover>
    </>
  );
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
  const { t } = useTranslation('matrix');

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
        <p className="text-label font-medium text-doqyn-text">
          {t('accessMatrixTable.nenhumDocumentoNestaSelecao')}
        </p>
        <p className="mt-1.5 max-w-[42ch] text-caption text-doqyn-muted">
          {t('accessMatrixTable.ajusteABuscaOu')}
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
                {t('accessMatrixTable.documento')}
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
                    <span>{document.categoryName ?? t('noCategory')}</span>
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

                  return (
                    <td
                      key={member.membershipId}
                      onMouseEnter={() => setHoverColumn(member.membershipId)}
                      className={cn(
                        'px-1 py-2 text-center',
                        hoverColumn === member.membershipId && 'matrix-col-active',
                      )}
                    >
                      <AccessCell
                        document={document}
                        member={member}
                        cell={cell}
                        origin={origin}
                        isBusy={busyCellKey === key}
                        groupNameById={groupNameById}
                        onShare={onShare}
                        onRevoke={onRevoke}
                      />
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
            {t(ORIGIN_LABEL_KEY[origin])}
          </span>
        ))}
        <span className="font-mono text-micro text-doqyn-subtle">
          {t('accessMatrixTable.celulaVaziaSemAcesso')}
        </span>
      </div>
    </div>
  );
}
