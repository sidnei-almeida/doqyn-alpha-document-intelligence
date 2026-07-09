import type { MetadataDisplayField } from '../types';
import { cn } from '@/lib/utils';

type CurrentMetadataPanelProps = {
  fields: MetadataDisplayField[];
  compact?: boolean;
};

export function CurrentMetadataPanel({ fields, compact = false }: CurrentMetadataPanelProps) {
  if (fields.length === 0) return null;

  const visibleFields = compact ? fields.slice(0, 4) : fields;

  return (
    <section
      className={cn(
        'rounded-xl border border-doqyn-border-subtle bg-doqyn-surface/50',
        compact ? 'px-3 py-2.5' : 'p-4',
      )}
      data-testid="update-version-current-metadata"
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
        Metadados atuais
      </p>
      <dl className="divide-y divide-doqyn-border-subtle/60">
        {visibleFields.map((field) => (
          <div
            key={field.key}
            className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
          >
            <dt className="shrink-0 text-[11px] text-doqyn-muted">{field.label}</dt>
            <dd className="min-w-0 truncate text-right text-[11px] text-doqyn-text">{field.value}</dd>
          </div>
        ))}
      </dl>
      {compact && fields.length > visibleFields.length && (
        <p className="mt-1 text-[10px] text-doqyn-muted">
          +{fields.length - visibleFields.length} campos
        </p>
      )}
    </section>
  );
}
