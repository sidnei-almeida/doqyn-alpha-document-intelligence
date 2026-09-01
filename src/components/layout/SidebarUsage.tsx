import { SidebarTooltip } from './SidebarTooltip';
import { useTenantUsage } from '@/features/tenant/hooks/useTenantUsage';
import { cn } from '@/lib/utils';

type SidebarUsageProps = {
  collapsed: boolean;
};

/** Acima disto a régua troca de tinta: o número deixa de ser informação e vira aviso. */
const WARN_RATIO = 0.8;
const DANGER_RATIO = 0.95;

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
  const { data, isPending, isError } = useTenantUsage();

  // O erro não vira mensagem: isto é contexto de canto de olho, e uma falha
  // aqui não muda o que a pessoa está fazendo. Melhor não existir do que gritar.
  if (isError || isPending) return null;

  const { totalBytes, quotaBytes } = data.storage;
  const ratio = quotaBytes && quotaBytes > 0 ? Math.min(totalBytes / quotaBytes, 1) : null;
  const level = ratio === null ? 'none' : ratio >= DANGER_RATIO ? 'danger' : ratio >= WARN_RATIO ? 'warn' : 'ok';

  const usedLabel = formatStorageSize(totalBytes);
  const quotaLabel = quotaBytes ? formatStorageSize(quotaBytes) : null;
  const percentLabel = ratio === null ? null : formatPercent(ratio);

  const fullLabel = quotaLabel
    ? `Armazenamento · ${usedLabel} de ${quotaLabel} (${percentLabel})`
    : `Armazenamento · ${usedLabel}`;

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
      <p className="type-eyebrow text-doqyn-subtle">Armazenamento</p>

      {ratio === null ? null : <UsageRule ratio={ratio} level={level} />}

      <p className="sidebar-usage__figure">
        <span className="sidebar-usage__used">{usedLabel}</span>
        {quotaLabel ? <span className="sidebar-usage__quota"> de {quotaLabel}</span> : null}
      </p>

      <p className="sidebar-usage__meta">
        {formatCount(data.documents, 'documento', 'documentos')}
        {percentLabel ? ` · ${percentLabel} usado` : ''}
      </p>
    </div>
  );
}

function UsageRule({ ratio, level }: { ratio: number; level: string }) {
  return (
    <div
      className="sidebar-usage__rule"
      data-level={level}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-label="Armazenamento usado"
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

function formatCount(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString('pt-BR')} ${value === 1 ? singular : plural}`;
}

function formatPercent(ratio: number): string {
  const percent = ratio * 100;
  // Abaixo de 1% arredondar para zero apagaria o dado; uma casa mantém o sinal.
  const digits = percent > 0 && percent < 1 ? 1 : 0;
  return `${formatNumber(percent, digits)}%`;
}

/**
 * O `formatFileSize` de upload não serve aqui: ele para em MB porque mede um
 * arquivo por vez, e o acervo de um espaço passa de mil megabytes sem esforço.
 * A precisão também cai conforme a unidade sobe — 940 KB e 1,2 GB pedem casas
 * diferentes para caber no mesmo espaço sem virar ruído.
 */
function formatStorageSize(bytes: number): string {
  if (bytes <= 0) return '0 KB';

  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(kb, kb < 10 ? 1 : 0)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${formatNumber(mb, mb < 10 ? 1 : 0)} MB`;

  // Em GB as casas são teto, não piso: o teto do plano é redondo ("10 GB"), e
  // escrevê-lo como "10,00 GB" faz um número exato parecer medição.
  return `${formatNumber(mb / 1024, 2, 0)} GB`;
}

function formatNumber(value: number, digits: number, minDigits = digits): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: digits,
  });
}
