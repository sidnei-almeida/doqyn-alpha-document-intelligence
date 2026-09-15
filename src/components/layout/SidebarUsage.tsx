import { SidebarTooltip } from './SidebarTooltip';
import { useTenantUsage } from '@/features/tenant/hooks/useTenantUsage';
import {
  formatStoragePercent,
  formatStorageSize,
  storageLevel,
  storageRatio,
} from '@/lib/storageFormat';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type SidebarUsageProps = {
  collapsed: boolean;
};

/**
 * Armazenamento do espaço, no pé da lista.
 *
 * Fica logo abaixo de "Configurações", dentro da mesma coluna que rola — é a
 * última linha do índice, não um rodapé grudado na base da janela. Colada lá
 * embaixo ela virava um bloco solto, longe de tudo com que se relaciona.
 *
 * A régua é fio, não pílula: 3px de altura e canto reto, a mesma forma que o
 * campo em foco e o item ativo da barra usam. Cheia, ela não fica teal — o
 * acento continua reservado ao que está acontecendo agora. O preenchimento é
 * neutro até 80%, âmbar a partir daí e vermelho aos 95%: a cor só aparece
 * quando passa a significar alguma coisa.
 *
 * Recolhida, sobra o percentual e um traço de 20px. Não é o mesmo bloco
 * espremido: é o mesmo dado no menor tamanho em que ainda se lê, com o texto
 * inteiro no tooltip.
 */
export function SidebarUsage({ collapsed }: SidebarUsageProps) {
  const { t } = useTranslation('components');

  const { data, isPending, isError } = useTenantUsage();

  // O erro não vira mensagem: isto é contexto de canto de olho, e uma falha
  // aqui não muda o que a pessoa está fazendo. Melhor não existir do que gritar.
  if (isError || isPending) return null;

  const { totalBytes, quotaBytes } = data.storage;
  const ratio = storageRatio(totalBytes, quotaBytes);
  const level = storageLevel(ratio);

  const usedLabel = formatStorageSize(totalBytes);
  const quotaLabel = quotaBytes ? formatStorageSize(quotaBytes) : null;
  const percentLabel = ratio === null ? null : formatStoragePercent(ratio);

  const fullLabel = quotaLabel
    ? t('sidebarUsage.tooltipWithQuota', {
        used: usedLabel,
        quota: quotaLabel,
        percent: percentLabel,
      })
    : t('sidebarUsage.tooltip', { used: usedLabel });

  if (collapsed) {
    return (
      <SidebarTooltip label={fullLabel} collapsed>
        <div className="sidebar-usage sidebar-usage--collapsed" data-testid="sidebar-usage">
          <span className="sidebar-usage__percent">{percentLabel ?? usedLabel}</span>
          {ratio === null ? null : <UsageRule ratio={ratio} level={level} />}
        </div>
      </SidebarTooltip>
    );
  }

  return (
    <div className="sidebar-usage" data-testid="sidebar-usage">
      <p className="type-eyebrow text-doqyn-subtle">{t('sidebarUsage.armazenamento')}</p>

      {ratio === null ? null : <UsageRule ratio={ratio} level={level} />}

      <p className="sidebar-usage__figure">
        <span className="sidebar-usage__used">{usedLabel}</span>
        {quotaLabel ? (
          <span className="sidebar-usage__quota">
            {' '}
            {t('sidebarUsage.ofQuota', { quota: quotaLabel })}
          </span>
        ) : null}
      </p>

      <p className="sidebar-usage__meta">
        {t('sidebarUsage.documentCount', { count: data.documents })}
        {percentLabel ? ` · ${t('sidebarUsage.percentUsed', { percent: percentLabel })}` : ''}
      </p>
    </div>
  );
}

function UsageRule({ ratio, level }: { ratio: number; level: string }) {
  const { t } = useTranslation('components');

  return (
    <div
      className="sidebar-usage__rule"
      data-level={level}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-label={t('sidebarUsage.armazenamentoUsado')}
    >
      {/* Um fio sempre visível mesmo quando o uso é quase nada: zero de largura
          faz a régua sumir e o bloco parecer quebrado. */}
      <span
        className={cn('sidebar-usage__fill')}
        style={{ width: `${Math.max(ratio * 100, 1.5)}%` }}
      />
    </div>
  );
}
