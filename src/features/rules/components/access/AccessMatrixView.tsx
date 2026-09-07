import { useRef, useState } from 'react';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { EMPTY_CONNECTION_PERMISSIONS } from '../../utils/governanceConnections';
import { getCategoryGroupPermissions, hasAnyPermission } from './accessModel';
import { CategoryGlyph } from './CategoryGlyph';
import { PermissionVerbs } from './PermissionVerbs';
import { PermissionPopover } from './PermissionPopover';

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
        className="matrix-cell"
        data-connected={connected}
      >
        {connected ? (
          <PermissionVerbs permissions={permissions} variant="grid" />
        ) : (
          <span aria-hidden>—</span>
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
  const [hover, setHover] = useState<{ row: string; col: string } | null>(null);

  return (
    <div className="access-matrix">
      <div className="access-matrix__scroll">
        <table className="access-matrix__table">
          <thead>
            <tr>
              <th className="access-matrix__corner">
                <span className="register-label text-doqyn-subtle">Categoria</span>
              </th>
              {groups.map((group) => (
                <th
                  key={group.id}
                  className="access-matrix__col"
                  data-lit={hover?.col === group.id}
                >
                  <span className="register-label">{group.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} data-lit={hover?.row === category.id}>
                <th scope="row" className="access-matrix__row-head">
                  <CategoryGlyph category={category} size="sm" />
                  <span className="type-body text-doqyn-text">{category.name}</span>
                </th>
                {groups.map((group) => (
                  <td
                    key={group.id}
                    className="access-matrix__cell"
                    data-lit={hover?.col === group.id || hover?.row === category.id}
                    onMouseEnter={() => setHover({ row: category.id, col: group.id })}
                    onMouseLeave={() => setHover(null)}
                  >
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
            ))}
          </tbody>
        </table>
      </div>

      <p className="access-matrix__legend">
        <span className="register-label text-doqyn-subtle">Ordem dos pontos</span> ver · baixar ·
        enviar{isAdmin ? '. Clique numa célula para editar' : ''}
      </p>
    </div>
  );
}
