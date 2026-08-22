import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ExpiryAlertConfigSection,
  type ExpiryAlertConfigValue,
} from './ExpiryAlertConfigSection';
import { DEFAULT_EXPIRY_ALERT_CONFIG } from './expiryAlertDefaults';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
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
  const overlayRef = useRef<HTMLDivElement>(null);
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
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-[var(--z-drawer)] flex justify-end modal-overlay-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extraction-drawer-title"
    >
      <div className="flex h-full w-full max-w-lg flex-col border-l border-doqyn-border bg-doqyn-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-doqyn-border px-6 py-4">
          <div>
            <h2 id="extraction-drawer-title" className="text-lg font-semibold text-doqyn-text">
              Campos da análise
            </h2>
            <p className="text-sm text-doqyn-muted">{category.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-doqyn-muted hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.md} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <Textarea
              id="class-description"
              label="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />

            <Textarea
              id="class-keywords"
              label="Termos que identificam este documento"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={2}
              placeholder="Separe por vírgula"
            />

            <Textarea
              id="class-negative-keywords"
              label="Termos a evitar"
              value={negativeKeywords}
              onChange={(e) => setNegativeKeywords(e.target.value)}
              rows={2}
              placeholder="Separe por vírgula"
            />

            <Input
              id="naming-template"
              label="Nome sugerido"
              placeholder="Use {campo} para variáveis"
              value={namingTemplate}
              onChange={(e) => setNamingTemplate(e.target.value)}
              required
            />

            <Input
              id="min-confidence"
              label="Confiança mínima"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={minimumConfidence}
              onChange={(e) => setMinimumConfidence(e.target.value)}
            />

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-doqyn-border-strong accent-doqyn-action"
              />
              <span className="text-sm text-doqyn-text">Regra ativa para análise</span>
            </label>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-doqyn-text">Campos extraídos</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFields((prev) => [...prev, emptyField()])}
                >
                  <Icon name="add" size={14} />
                  Campo
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-lg border border-doqyn-border bg-doqyn-bg/40 p-3"
                  >
                    <div className="flex gap-2">
                      <Input
                        placeholder="Chave (ex: parte_receptora)"
                        value={field.key}
                        onChange={(e) => updateField(index, { key: e.target.value })}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Rótulo"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        className="flex-1"
                      />
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}
                          className="rounded p-2 text-doqyn-muted hover:text-doqyn-danger"
                          aria-label="Remover campo"
                        >
                          <Icon name="delete" size={ICON_SIZE.xs} />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        value={field.type}
                        onChange={(e) =>
                          updateField(index, { type: e.target.value as FieldType })
                        }
                        options={ALLOWED_FIELD_TYPES.map((t) => ({
                          value: t,
                          label: FIELD_TYPE_LABELS[t],
                        }))}
                        className="min-w-[120px]"
                      />
                      <label className="flex items-center gap-2 text-sm text-doqyn-text">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(index, { required: e.target.checked })}
                          className="h-3.5 w-3.5 accent-doqyn-action"
                        />
                        Obrigatório
                      </label>
                    </div>
                    <Input
                      placeholder="Aliases (separados por vírgula)"
                      value={tagsToString(field.aliases ?? [])}
                      onChange={(e) =>
                        updateField(index, { aliases: tagsFromString(e.target.value) })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <ExpiryAlertConfigSection
              value={expiryAlerts}
              onChange={setExpiryAlerts}
              groups={groups}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-doqyn-border px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !namingTemplate.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
