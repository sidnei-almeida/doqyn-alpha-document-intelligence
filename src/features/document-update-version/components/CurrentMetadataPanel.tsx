import { DrawerField, DrawerSection } from '@/components/ui/DrawerSection';
import type { MetadataDisplayField } from '../types';
import { useTranslation } from 'react-i18next';

type CurrentMetadataPanelProps = {
  fields: MetadataDisplayField[];
  compact?: boolean;
};

export function CurrentMetadataPanel({ fields, compact = false }: CurrentMetadataPanelProps) {
  const { t } = useTranslation('documentVersion');

  if (fields.length === 0) return null;

  const visibleFields = compact ? fields.slice(0, 4) : fields;
  const hiddenCount = fields.length - visibleFields.length;

  return (
    <DrawerSection
      label={t('currentMetadataPanel.metadadosAtuais')}
      aside={
        hiddenCount > 0 ? (
          <span className="font-mono text-micro tabular-nums text-doqyn-subtle">
            +{hiddenCount}
          </span>
        ) : undefined
      }
      data-testid="update-version-current-metadata"
    >
      <dl>
        {visibleFields.map((field) => (
          <DrawerField key={field.key} label={field.label} value={field.value} />
        ))}
      </dl>
    </DrawerSection>
  );
}
