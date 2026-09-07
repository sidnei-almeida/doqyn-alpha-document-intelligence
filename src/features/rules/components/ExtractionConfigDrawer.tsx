import { useEffect, useState, type FormEvent } from 'react';
import { ExpiryAlertConfigSection, type ExpiryAlertConfigValue } from './ExpiryAlertConfigSection';
import { DEFAULT_EXPIRY_ALERT_CONFIG } from './expiryAlertDefaults';
import { WorkspaceSideDrawer } from '@/components/layout/WorkspaceSideDrawer';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DrawerSection } from '@/components/ui/DrawerSection';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type {
  DocumentCategory,
  DocumentExtractionRule,
  ExtractionField,
  FieldType,
} from '@/types/rules';
import { ALLOWED_FIELD_TYPES } from '../api/rulesApi';

interface ExtractionConfigDrawerProps {
  open: boolean;
  category: DocumentCategory | null;
  rule: DocumentExtractionRule | null;
  onClose: () => void;
  onSave: (
    classId: string,
    payload: {
      description?: string;
      keywords: string[];
      negativeKeywords: string[];
      fields: ExtractionField[];
      namingTemplate: string;
      minimumConfidence: number;
      active: boolean;
      expiryAlerts: ExpiryAlertConfigValue;
    },
  ) => Promise<DocumentExtractionRule | null>;
  groups?: Array<{ id: string; name: string }>;
}

const FORM_ID = 'campos-da-analise';

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: 'Texto',
  date: 'Data',
  number: 'Número',
  currency: 'Moeda',
  boolean: 'Sim/Não',
};

function tagsFromString(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tagsToString(tags: string[]): string {
  return tags.join(', ');
}

function emptyField(): ExtractionField {
  return { key: '', label: '', type: 'string', required: false, aliases: [] };
}

export function ExtractionConfigDrawer({
  open,
  category,
  rule,
  onClose,
  onSave,
  groups = [],
}: ExtractionConfigDrawerProps) {
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [negativeKeywords, setNegativeKeywords] = useState('');
  const [namingTemplate, setNamingTemplate] = useState('');
  const [minimumConfidence, setMinimumConfidence] = useState('0.7');
  const [active, setActive] = useState(true);
  const [fields, setFields] = useState<ExtractionField[]>([emptyField()]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertConfigValue>(
    DEFAULT_EXPIRY_ALERT_CONFIG,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !category) return;
    setDescription(category.description ?? '');
    setKeywords(tagsToString(category.keywords));
    setNegativeKeywords(tagsToString(category.negativeKeywords));
    setNamingTemplate(rule?.namingTemplate ?? `${category.name.replace(/\s+/g, '_')}_{data}`);
    setMinimumConfidence(String(rule?.minimumConfidence ?? 0.7));
    setActive(rule?.active ?? true);
    setFields(rule?.fields?.length ? rule.fields.map((f) => ({ ...f })) : [emptyField()]);
    setExpiryAlerts(rule?.expiryAlerts ?? DEFAULT_EXPIRY_ALERT_CONFIG);
  }, [open, category, rule]);

  if (!open || !category) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const validFields = fields.filter((f) => f.key.trim() && f.label.trim());
      await onSave(category.id, {
        description: description.trim() || undefined,
        keywords: tagsFromString(keywords),
        negativeKeywords: tagsFromString(negativeKeywords),
        fields: validFields,
        namingTemplate: namingTemplate.trim(),
        minimumConfidence: Number(minimumConfidence) || 0.7,
        active,
        expiryAlerts,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const updateField = (index: number, patch: Partial<ExtractionField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  return (
    <WorkspaceSideDrawer
      onClose={onClose}
      title="Campos da análise"
      subtitle={category.name}
      testId="extraction-drawer"
      closeTestId="extraction-drawer-close"
      zIndexClass="z-[var(--z-drawer)]"
      maxWidthClass="max-w-xl"
      bodyClassName="space-y-5"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving || !namingTemplate.trim()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void handleSubmit(e)} className="space-y-7">
        <DrawerSection label="Reconhecimento" bodyClassName="space-y-4">
          <p className="text-caption text-doqyn-subtle">
            É por estes termos que a análise reconhece um documento como desta categoria.
          </p>

          <Textarea
            id="class-description"
            variant="rule"
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <Textarea
            id="class-keywords"
            variant="rule"
            label="Termos que identificam este documento"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={2}
            placeholder="Separe por vírgula"
          />

          <Textarea
            id="class-negative-keywords"
            variant="rule"
            label="Termos a evitar"
            value={negativeKeywords}
            onChange={(e) => setNegativeKeywords(e.target.value)}
            rows={2}
            placeholder="Separe por vírgula"
          />
        </DrawerSection>

        <DrawerSection
          label="Análise"
          bodyClassName="space-y-4"
          aside={
            <span className="flex items-center gap-2 text-caption text-doqyn-muted">
              Ativa
              <Switch
                checked={active}
                onCheckedChange={setActive}
                aria-label="Regra ativa para análise"
              />
            </span>
          }
        >
          <p className="text-caption text-doqyn-subtle">
            Como o documento é nomeado ao entrar, e a partir de que confiança a extração vale sem
            revisão.
          </p>

          <Input
            id="naming-template"
            variant="rule"
            label="Nome sugerido"
            placeholder="Use {campo} para variáveis"
            value={namingTemplate}
            onChange={(e) => setNamingTemplate(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <Input
              id="min-confidence"
              variant="rule"
              label="Confiança mínima"
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="font-mono tabular-nums"
              value={minimumConfidence}
              onChange={(e) => setMinimumConfidence(e.target.value)}
            />
            <p className="text-micro text-doqyn-muted">
              Abaixo disso a extração vai para revisão em vez de valer sozinha.
            </p>
          </div>
        </DrawerSection>

        <DrawerSection
          label="Campos extraídos"
          bodyClassName="divide-y divide-doqyn-border-subtle"
          aside={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFields((prev) => [...prev, emptyField()])}
            >
              <Icon name="add" size={ICON_SIZE.xs} />
              Campo
            </Button>
          }
        >
          {fields.map((field, index) => (
            <div key={index} className="flex items-start gap-3 py-3 first:pt-0">
              <span className="mt-2 shrink-0 font-mono text-micro tabular-nums text-doqyn-subtle">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex gap-3">
                  <Input
                    variant="rule"
                    placeholder="Chave (ex: parte_receptora)"
                    value={field.key}
                    onChange={(e) => updateField(index, { key: e.target.value })}
                    className="font-mono text-micro"
                  />
                  <Input
                    variant="rule"
                    placeholder="Rótulo"
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Select
                    variant="rule"
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value as FieldType })}
                    options={ALLOWED_FIELD_TYPES.map((t) => ({
                      value: t,
                      label: FIELD_TYPE_LABELS[t],
                    }))}
                    className="min-w-[7.5rem] flex-1"
                  />
                  <label className="flex items-center gap-2 text-caption text-doqyn-text">
                    <Checkbox
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    Obrigatório
                  </label>
                </div>
                <Input
                  variant="rule"
                  placeholder="Aliases (separados por vírgula)"
                  value={tagsToString(field.aliases ?? [])}
                  onChange={(e) => updateField(index, { aliases: tagsFromString(e.target.value) })}
                />
              </div>

              {fields.length > 1 && (
                <IconButton
                  label="Remover campo"
                  className="mt-1"
                  onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Icon name="delete" size={ICON_SIZE.xs} />
                </IconButton>
              )}
            </div>
          ))}
        </DrawerSection>

        <ExpiryAlertConfigSection value={expiryAlerts} onChange={setExpiryAlerts} groups={groups} />
      </form>
    </WorkspaceSideDrawer>
  );
}
