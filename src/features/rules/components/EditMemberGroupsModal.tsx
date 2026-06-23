import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { CompanyMember, Group } from '@/types/rules';
import { GROUP_COLOR_STYLES } from '@/utils/rulesHelpers';

interface EditMemberGroupsModalProps {
  open: boolean;
  member: CompanyMember | null;
  groups: Group[];
  onClose: () => void;
  onSave: (memberId: string, groupIds: string[]) => void;
}

export function EditMemberGroupsModal({
  open,
  member,
  groups,
  onClose,
  onSave,
}: EditMemberGroupsModalProps) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && member) {
      setSelectedGroupIds([...member.groupIds]);
    }
  }, [open, member]);

  if (!open || !member) return null;

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(member.id, selectedGroupIds);
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-groups-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-doqyn-border bg-doqyn-surface p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="edit-groups-modal-title" className="text-lg font-semibold text-doqyn-text">
            Editar grupos do membro
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-doqyn-muted hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-doqyn-text">{member.name}</p>
            <p className="text-xs text-doqyn-muted">{member.email}</p>
          </div>

          <div>
            <span className="mb-2 block text-xs font-medium text-doqyn-muted">Grupos atuais</span>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => {
                const selected = selectedGroupIds.includes(group.id);
                const styles = GROUP_COLOR_STYLES[group.color];
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      selected ? styles.badge : 'border-doqyn-border text-doqyn-muted hover:text-doqyn-text',
                    )}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-doqyn-muted">
            Alterar grupos afeta automaticamente as categorias de documentos acessíveis.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Salvar alterações</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
