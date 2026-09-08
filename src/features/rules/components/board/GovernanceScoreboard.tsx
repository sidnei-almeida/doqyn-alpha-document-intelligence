import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { GovernanceProgress, GovernanceStepId } from './governanceProgress';
import { Trans, useTranslation } from 'react-i18next';

export type GovernanceScoreboardProps = {
  progress: GovernanceProgress;
  isAdmin: boolean;
  onCreateGroup?: () => void;
};

/**
 * O placar do quadro — trilha enquanto a governança está incompleta, cobertura depois.
 *
 * Enquanto falta um passo, a régua de porcentagem seria sempre zero e não ensinaria nada: o que
 * o admin precisa saber é qual das três perguntas ainda está aberta. Fechados os três passos,
 * a trilha some e o espaço vira a única medida que importa daí em diante — quanta gente a
 * governança alcança.
 */
export function GovernanceScoreboard({
  progress,
  isAdmin,
  onCreateGroup,
}: GovernanceScoreboardProps) {
  const { t } = useTranslation('rules');

  if (progress.complete) {
    const percent = Math.round(progress.coverage * 100);
    return (
      <section className="gov-board" aria-label={t('governanceScoreboard.coberturaDaGovernanca')}>
        <div className="gov-board__head">
          <p className="register-label text-doqyn-subtle">{t('governanceScoreboard.cobertura')}</p>
          <p className="gov-board__percent">{percent}%</p>
        </div>
        <div
          className="gov-meter"
          role="img"
          aria-label={`${percent}% das pessoas alcançam alguma categoria`}
        >
          <span className="gov-meter__fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="type-caption text-doqyn-muted">
          <Trans
            i18nKey="rules:governanceScoreboard.peopleReached"
            values={{ reached: progress.peopleReached, total: progress.totalPeople }}
            components={{ count: <span className="gov-board__count" /> }}
          />
        </p>
      </section>
    );
  }

  const doneCount = progress.steps.filter((step) => step.done).length;
  const firstOpenId = progress.steps.find((step) => !step.done)?.id ?? null;

  return (
    <section className="gov-board" aria-label={t('governanceScoreboard.trilhaDaGovernanca')}>
      <div className="gov-board__head">
        <p className="register-label text-doqyn-subtle">
          {t('governanceScoreboard.governancaIncompleta')}
        </p>
        <p className="gov-board__percent gov-board__percent--steps">
          {t('governanceScoreboard.stepsDone', {
            done: doneCount,
            total: progress.steps.length,
          })}
        </p>
      </div>

      <ol className="gov-trail">
        {progress.steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              'gov-trail__step',
              step.done && 'gov-trail__step--done',
              step.id === firstOpenId && 'gov-trail__step--live',
            )}
          >
            <span className="gov-trail__mark" aria-hidden>
              {step.done ? <Icon name="check" size={ICON_SIZE.xs} /> : null}
            </span>
            <span className="gov-trail__label">{step.label}</span>
            {step.hint ? <span className="gov-trail__hint">{step.hint}</span> : null}
            {step.id === firstOpenId && isAdmin ? (
              <StepAction id={step.id} onCreateGroup={onCreateGroup} />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepAction({ id, onCreateGroup }: { id: GovernanceStepId; onCreateGroup?: () => void }) {
  const { t } = useTranslation('rules');

  if (id === 'groups' && onCreateGroup) {
    return (
      <button type="button" className="gov-trail__action" onClick={onCreateGroup}>
        {t('governanceScoreboard.criarGrupo')}
        <Icon name="arrow_forward" size={ICON_SIZE.xs} />
      </button>
    );
  }

  if (id === 'people') {
    return (
      <Link to="/users" className="gov-trail__action">
        {t('governanceScoreboard.colocarPessoas')}
        <Icon name="arrow_forward" size={ICON_SIZE.xs} />
      </Link>
    );
  }

  return null;
}
