import { useDroppable } from '@dnd-kit/core';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { dropdownMenuItemClass } from '@/components/ui/dropdownMenuStyles';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { useRef, useState, type ReactNode } from 'react';
import type { DocumentCategory } from '@/types/rules';
import { CategoryGlyph } from '../access/CategoryGlyph';
import type { SimulationResult } from '../access/accessModel';
import { reachLabel, type CategoryReach } from './governanceProgress';

export type CategoryLaneProps = {
  category: DocumentCategory;
  /** Quantas pessoas alcançam a categoria hoje. */
  peopleCount: number;
  /** Quantas passariam a alcançar se a ficha na mão fosse solta aqui. */
  previewCount?: number | null;
  /** Estado e proporção de alcance da categoria — o selo e a régua do cabeçalho. */
  reach: CategoryReach;
  simulation?: SimulationResult | null;
  isAdmin: boolean;
  onOpenDetails: () => void;
  onConfigureExtraction?: () => void;
  children: ReactNode;
  emptyLabel: string;
};

function LaneMenu({
  categoryName,
  onOpenDetails,
  onConfigureExtraction,
}: {
  categoryName: string;
  onOpenDetails: () => void;
  onConfigureExtraction?: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        ref={anchorRef}
        label={`Opções de ${categoryName}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon name="more_vert" size={ICON_SIZE.sm} aria-hidden />
      </IconButton>
      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-end"
      >
        <button
          type="button"
          className={dropdownMenuItemClass}
          onClick={() => {
            setOpen(false);
            onOpenDetails();
          }}
        >
          <Icon name="info" size={ICON_SIZE.xs} aria-hidden />
          Detalhes da categoria
        </button>
        {onConfigureExtraction ? (
          <button
            type="button"
            className={dropdownMenuItemClass}
            onClick={() => {
              setOpen(false);
              onConfigureExtraction();
            }}
          >
            <Icon name="tune" size={ICON_SIZE.xs} aria-hidden />
            Campos da análise
          </button>
        ) : null}
      </AnchoredPopover>
    </>
  );
}

/**
 * Faixa de uma categoria: onde as fichas de grupo pousam.
 *
 * O placar do cabeçalho é o que dá sentido ao arrasto — enquanto a ficha está no ar, ele mostra
 * para quanto o número vai, e não só onde está. Sem isso, conceder acesso é um gesto sem resposta.
 */
export function CategoryLane({
  category,
  peopleCount,
  previewCount,
  reach,
  simulation,
  isAdmin,
  onOpenDetails,
  onConfigureExtraction,
  children,
  emptyLabel,
}: CategoryLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane:${category.id}`,
    data: { categoryId: category.id },
  });

  const delta = previewCount != null ? previewCount - peopleCount : 0;
  const outOfReach = simulation ? !simulation.sees : false;

  return (
    <section
      ref={setNodeRef}
      className={cn('access-lane', isOver && 'access-lane--over', outOfReach && 'access-lane--dim')}
      aria-label={category.name}
    >
      <header className="access-lane__header">
        <CategoryGlyph category={category} />
        <div className="min-w-0 flex-1">
          <p className="access-lane__name">{category.name}</p>
          <p className="access-lane__score" aria-live="polite">
            {previewCount != null && delta !== 0 ? (
              <>
                <span className="access-lane__score-from">{peopleCount}</span>
                <span aria-hidden> → </span>
                <span className="access-lane__score-to">{previewCount} pessoas veem</span>
                <span className="access-lane__score-delta">
                  {delta > 0 ? `+${delta}` : String(delta)}
                </span>
              </>
            ) : (
              <>
                <span className="access-lane__score-to">{peopleCount}</span>
                {peopleCount === 1 ? ' pessoa alcança' : ' pessoas alcançam'}
                <span className="access-lane__score-sep" aria-hidden>
                  ·
                </span>
                <span className="access-lane__score-to">{reach.groupCount}</span>
                {reach.groupCount === 1 ? ' grupo conectado' : ' grupos conectados'}
              </>
            )}
          </p>
          <div
            className="access-lane__meter"
            data-state={reach.state}
            role="img"
            aria-label={`${Math.round(reach.coverage * 100)}% das pessoas da empresa alcançam esta categoria`}
          >
            <span
              className="access-lane__meter-fill"
              style={{ width: `${Math.round(reach.coverage * 100)}%` }}
            />
          </div>
        </div>
        {outOfReach ? (
          <span className="access-lane__flag">fora do alcance</span>
        ) : (
          <span className="access-lane__seal" data-state={reach.state}>
            {reachLabel(reach.state)}
          </span>
        )}
        {isAdmin ? (
          <LaneMenu
            categoryName={category.name}
            onOpenDetails={onOpenDetails}
            onConfigureExtraction={onConfigureExtraction}
          />
        ) : null}
      </header>

      <div className="access-lane__tokens">
        {children}
        <span className="access-lane__empty">{emptyLabel}</span>
      </div>
    </section>
  );
}
