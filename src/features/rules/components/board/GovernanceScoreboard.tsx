import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { GovernanceProgress, GovernanceStepId } from './governanceProgress';

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
  if (progress.complete) {
    const percent = Math.round(progress.coverage * 100);
    return (
      <section className="gov-board" aria-label="Cobertura da governança">
        <div className="gov-board__head">
          <p className="register-label text-doqyn-subtle">Cobertura</p>
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
          <span className="gov-board__count">{progress.peopleReached}</span> de{' '}
          {progress.totalPeople} pessoas alcançam ao menos uma categoria por grupo. Administradores
          veem tudo.
        </p>
      </section>
    );
  }

  const doneCount = progress.steps.filter((step) => step.done).length;
  const firstOpenId = progress.steps.find((step) => !step.done)?.id ?? null;

  return (
    <section className="gov-board" aria-label="Trilha da governança">
      <div className="gov-board__head">
        <p className="register-label text-doqyn-subtle">Governança incompleta</p>
        <p className="gov-board__percent gov-board__percent--steps">
          {doneCount} de {progress.steps.length}
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
  if (id === 'groups' && onCreateGroup) {
    return (
      <button type="button" className="gov-trail__action" onClick={onCreateGroup}>
        Criar grupo
        <Icon name="arrow_forward" size={ICON_SIZE.xs} />
      </button>
    );
  }

  if (id === 'people') {
    return (
      <Link to="/users" className="gov-trail__action">
        Colocar pessoas
        <Icon name="arrow_forward" size={ICON_SIZE.xs} />
      </Link>
    );
  }

  return null;
}
