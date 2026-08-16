import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export type CopyableTextFieldProps = {
  value: string;
  label?: string;
  description?: string;
  className?: string;
  copyLabel?: string;
  copiedLabel?: string;
  testId?: string;
};

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text.trim()) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

export function CopyableTextField({
  value,
  label,
  description,
  className,
  copyLabel = 'Copiar link',
  copiedLabel = 'Copiado',
  testId,
}: CopyableTextFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyTextToClipboard(value);
    if (!success) {
      toast.error('Não foi possível copiar o link.');
      return;
    }

    setCopied(true);
    toast.success('Link copiado para a área de transferência.');
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('space-y-1', className)} data-testid={testId}>
      {label ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-doqyn-subtle">{label}</p>
      ) : null}
      {description ? <p className="text-sm text-doqyn-text">{description}</p> : null}
      <div className="flex items-start gap-2 rounded-lg border border-doqyn-border-subtle bg-doqyn-card px-3 py-2.5">
        <code
          className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-doqyn-text"
          data-testid={testId ? `${testId}-value` : undefined}
        >
          {value}
        </code>
        <IconButton
          label={copied ? copiedLabel : copyLabel}
          onClick={() => void handleCopy()}
          className="mt-0.5 shrink-0"
          data-testid={testId ? `${testId}-copy` : 'copyable-text-copy'}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={ICON_SIZE.xs} />
        </IconButton>
      </div>
    </div>
  );
}
