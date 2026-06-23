import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { MetadataField } from '../types';

interface MetadataCardProps {
  fields: MetadataField[];
  isVisible?: boolean;
  className?: string;
}

export function MetadataCard({ fields, isVisible = true, className }: MetadataCardProps) {
  return (
    <Card className={cn('flex h-full min-h-0 flex-col border-doqyn-border bg-doqyn-surface', className)}>
      <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle>Metadados extraídos</CardTitle>
        <span className="rounded-md border border-doqyn-border bg-doqyn-bg/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
          Em teste
        </span>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            'flex-1 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 transition-opacity duration-300',
            !isVisible && 'opacity-40',
          )}
        >
          <table className="w-full text-sm">
            <tbody>
              {fields.map((field) => (
                <tr
                  key={field.label}
                  className="border-b border-doqyn-border-subtle last:border-0"
                >
                  <td className="px-4 py-2.5 text-xs text-doqyn-muted">{field.label}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-medium text-doqyn-text">
                    {isVisible ? field.value : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto shrink-0 pt-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full border-doqyn-border bg-transparent hover:bg-doqyn-hover"
            disabled={!isVisible}
          >
            Confirmar metadados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
