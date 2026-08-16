import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import {
  AUTO_DELAY_SECONDS_MAX,
  AUTO_DELAY_SECONDS_MIN,
  clampAutoDelaySeconds,
} from '../uploadConstants';

interface AutoModeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  delaySeconds: number;
  onDelaySecondsChange: (seconds: number) => void;
  disabled?: boolean;
  className?: string;
}

export function AutoModeToggle({
  enabled,
  onChange,
  delaySeconds,
  onDelaySecondsChange,
  disabled = false,
  className,
}: AutoModeToggleProps) {
  const adjustDelay = (delta: number) => {
    onDelaySecondsChange(clampAutoDelaySeconds(delaySeconds + delta));
  };

  return (
    <Tooltip label="Confirma análises confiáveis automaticamente e prepara o próximo envio.">
      <div
        className={cn(
          'bg-doqyn-bg/40 inline-flex max-w-full items-stretch overflow-hidden rounded-lg border border-doqyn-border-subtle',
          disabled && 'opacity-50',
          className,
        )}
      >
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span className="text-xs font-medium text-doqyn-text">Auto</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Modo automático"
            disabled={disabled}
            onClick={() => onChange(!enabled)}
            className={cn(
              'relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong',
              enabled
                ? 'border-doqyn-primary/50 bg-doqyn-primary/20'
                : 'border-doqyn-border bg-doqyn-bg',
            )}
          >
            <span
              className={cn(
                'absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-doqyn-text transition-transform duration-200',
                enabled && 'translate-x-4 bg-doqyn-primary',
              )}
            />
          </button>
        </div>

        <div
          className={cn(
            'grid transition-[grid-template-columns,opacity] duration-300 ease-out',
            enabled ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0',
          )}
          aria-hidden={!enabled}
        >
          <div className="overflow-hidden border-l border-doqyn-border-subtle">
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 transition-transform duration-300 ease-out',
                enabled ? 'translate-x-0' : '-translate-x-2',
              )}
            >
              <span className="hidden text-micro text-doqyn-muted sm:inline">Aguardar</span>
              <div className="flex items-center rounded-md border border-doqyn-border bg-doqyn-surface">
                <button
                  type="button"
                  disabled={disabled || !enabled || delaySeconds <= AUTO_DELAY_SECONDS_MIN}
                  onClick={() => adjustDelay(-1)}
                  className="flex h-7 w-7 items-center justify-center text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Diminuir segundos"
                >
                  <Icon name="remove" size={12} />
                </button>
                <input
                  type="number"
                  min={AUTO_DELAY_SECONDS_MIN}
                  max={AUTO_DELAY_SECONDS_MAX}
                  value={delaySeconds}
                  disabled={disabled || !enabled}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      onDelaySecondsChange(clampAutoDelaySeconds(parsed));
                    }
                  }}
                  className="h-7 w-9 border-x border-doqyn-border bg-transparent text-center text-xs font-medium text-doqyn-text [appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label="Segundos de espera"
                />
                <button
                  type="button"
                  disabled={disabled || !enabled || delaySeconds >= AUTO_DELAY_SECONDS_MAX}
                  onClick={() => adjustDelay(1)}
                  className="flex h-7 w-7 items-center justify-center text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Aumentar segundos"
                >
                  <Icon name="add" size={12} />
                </button>
              </div>
              <span className="text-micro text-doqyn-muted">seg</span>
            </div>
          </div>
        </div>
      </div>
    </Tooltip>
  );
}
