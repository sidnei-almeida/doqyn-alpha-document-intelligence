import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { EMPTY_CONNECTION_PERMISSIONS } from '../../utils/governanceConnections';
import { CategoryIcon } from '../categoryIcons';
import { getCategoryGroupPermissions, hasAnyPermission } from './accessModel';
import { PermissionPopover } from './PermissionPopover';

const DEFAULT_CATEGORY_COLOR = 'var(--folder-accent-default)';

type MatrixCellProps = {
  category: DocumentCategory;
  group: Group;
  memberCount: number;
  disabled: boolean;
  onChange: (permissions: DocumentAccessPermissions) => Promise<void>;
};

function MatrixCell({ category, group, memberCount, disabled, onChange }: MatrixCellProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const permissions = getCategoryGroupPermissions(category, group.id);
  const connected = hasAnyPermission(permissions);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Permissões de ${group.name} em ${category.name}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1.5 transition-colors',
          disabled ? 'cursor-default' : 'hover:border-doqyn-border',
        )}
      >
        {connected ? (
          <>
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                permissions.view ? 'bg-doqyn-success-dot' : 'bg-doqyn-panelSoft',
              )}
            />
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                permissions.download ? 'bg-doqyn-success-dot' : 'bg-doqyn-panelSoft',
              )}
            />
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                permissions.upload ? 'bg-doqyn-success-dot' : 'bg-doqyn-panelSoft',
              )}
            />
          </>
        ) : (
          <span className="type-caption text-doqyn-subtle">—</span>
        )}
      </button>
      <PermissionPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        group={group}
        memberCount={memberCount}
        categoryName={category.name}
        permissions={permissions}
        onChange={onChange}
        onRemove={() => onChange(EMPTY_CONNECTION_PERMISSIONS)}
      />
    </>
  );
}

type AccessMatrixViewProps = {
  categories: DocumentCategory[];
  groups: Group[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  onPermissionChange: (
    groupId: string,
    categoryId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
};

/** Matriz categoria × grupo — auditoria de todas as regras de uma vez. */
export function AccessMatrixView({
  categories,
  groups,
  groupMemberCounts,
  isAdmin,
  onPermissionChange,
}: AccessMatrixViewProps) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-doqyn-border-subtle">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-doqyn-card">
              <th className="type-label px-4 py-3 text-left text-doqyn-muted">Categoria</th>
              {groups.map((group) => (
                <th
                  key={group.id}
                  className="type-label whitespace-nowrap px-4 py-3 text-center text-doqyn-muted"
                >
                  {group.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const color = category.color || DEFAULT_CATEGORY_COLOR;
              return (
                <tr key={category.id} className="border-t border-doqyn-border-subtle">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                        style={{
                          background: `color-mix(in srgb, ${color} 16%, var(--bg-surface-2))`,
                        }}
                      >
                        <CategoryIcon icon={category.icon} color={color} filled size={15} />
                      </span>
                      <span className="type-label text-doqyn-text">{category.name}</span>
                    </span>
                  </td>
                  {groups.map((group) => (
                    <td key={group.id} className="px-4 py-3 text-center">
                      <MatrixCell
                        category={category}
                        group={group}
                        memberCount={groupMemberCounts[group.id] ?? group.memberCount ?? 0}
                        disabled={!isAdmin}
                        onChange={(permissions) =>
                          onPermissionChange(group.id, category.id, permissions)
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        <span className="type-caption inline-flex items-center gap-1.5 text-doqyn-muted">
          <span className="h-2 w-2 rounded-full bg-doqyn-success-dot" /> permissão ativa
        </span>
        <span className="type-caption inline-flex items-center gap-1.5 text-doqyn-muted">
          <span className="h-2 w-2 rounded-full bg-doqyn-panelSoft" /> sem permissão
        </span>
        <span className="type-caption text-doqyn-muted">
          Ordem dos pontos: Ver · Baixar · Enviar
        </span>
        {isAdmin && (
          <span className="type-caption text-doqyn-muted">Clique numa célula para editar</span>
        )}
      </div>
    </div>
  );
}
