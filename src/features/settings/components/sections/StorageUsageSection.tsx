import { useTenantUsage } from '@/features/tenant/hooks/useTenantUsage';
import {
  formatStoragePercent,
  formatStorageSize,
  storageLevel,
  storageRatio,
} from '@/lib/storageFormat';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { useTranslation } from 'react-i18next';

/**
 * Quanto do espaço já foi ocupado.
 *
 * Bloco de leitura: não há nada a configurar aqui. A cota sai do servidor
 * (`TENANT_STORAGE_QUOTA_BYTES`, com padrão de 10 GB) e nenhuma tela concede espaço —
 * quando existir plano pago, o teto passa a sair do registro do tenant, e é lá que ele
 * será alterado, não aqui.
 *
 * A mesma régua já vive no pé da barra lateral, e é de propósito: lá ela é canto de olho,
 * um número que envelhece um minuto em silêncio; aqui é a resposta à pergunta que fez a
 * pessoa abrir Configurações. Os dois leem `useTenantUsage`, então nunca discordam.
 *
 * Sem contagem de documentos: `/api/tenant/usage` conta o que **este usuário** enxerga,
 * enquanto os bytes somam o espaço inteiro. Lado a lado num bloco sobre o acervo os dois
 * números se contradiriam em PJ com governança apertada. Quantos documentos existem é
 * pergunta da Biblioteca.
 */
export function StorageUsageSection() {
  const { t } = useTranslation('settings');

  const { data, isPending, isError } = useTenantUsage();

  if (isPending) {
    return (
      <SettingsSectionBody>
        <p className="type-caption text-doqyn-muted">
          {t('storageUsageSection.carregandoUsoDoArmazenamento')}
        </p>
      </SettingsSectionBody>
    );
  }

  // Diferente da barra lateral, onde a falha some: aqui a pessoa veio ver este número, e
  // um bloco vazio pareceria acervo zerado.
  if (isError) {
    return (
      <SettingsSectionBody>
        <p className="type-caption text-doqyn-muted">
          {t('storageUsageSection.naoFoiPossivelCarregar')}
        </p>
      </SettingsSectionBody>
    );
  }

  const { totalBytes, originalBytes, previewBytes, quotaBytes } = data.storage;
  const ratio = storageRatio(totalBytes, quotaBytes);
  const level = storageLevel(ratio);

  const usedLabel = formatStorageSize(totalBytes);
  const quotaLabel = quotaBytes ? formatStorageSize(quotaBytes) : null;
  const percentLabel = ratio === null ? null : formatStoragePercent(ratio);

  return (
    <SettingsSectionBody className="settings-storage">
      <p className="settings-storage__figure">
        <span className="settings-storage__used">{usedLabel}</span>
        {quotaLabel ? (
          <span className="settings-storage__quota">
            {' '}
            {t('storageUsageSection.ofQuota', { quota: quotaLabel })}
          </span>
        ) : null}
      </p>

      {ratio === null ? null : (
        <div
          className="settings-storage__rule"
          data-level={level}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          aria-label={t('storageUsageSection.armazenamentoUsado')}
        >
          {/* Um fio sempre visível mesmo quando o uso é quase nada: zero de largura faz a
              régua sumir e o bloco parecer quebrado. */}
          <span
            className="settings-storage__fill"
            style={{ width: `${Math.max(ratio * 100, 1.5)}%` }}
          />
        </div>
      )}

      <p className="settings-storage__meta">
        {percentLabel
          ? t('storageUsageSection.percentUsed', { percent: percentLabel })
          : t('storageUsageSection.noQuota')}
      </p>

      {/* Originais e previews separados porque a pergunta seguinte é sempre a mesma: por que
          o total é maior do que a soma do que eu enviei. O preview é gerado pelo sistema. */}
      <dl className="settings-register-facts">
        <div>
          <dt className="register-label text-doqyn-subtle">
            {t('storageUsageSection.arquivosOriginais')}
          </dt>
          <dd className="type-body mt-0.5 text-doqyn-text">{formatStorageSize(originalBytes)}</dd>
        </div>
        <div>
          <dt className="register-label text-doqyn-subtle">
            {t('storageUsageSection.preVisualizacoes')}
          </dt>
          <dd className="type-body mt-0.5 text-doqyn-text">{formatStorageSize(previewBytes)}</dd>
        </div>
      </dl>
    </SettingsSectionBody>
  );
}
