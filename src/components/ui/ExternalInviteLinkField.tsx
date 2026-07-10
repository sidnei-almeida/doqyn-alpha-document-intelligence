import { CopyableTextField } from './CopyableTextField';
import { cn } from '@/lib/utils';

export const EXTERNAL_INVITE_LINK_LABEL = 'Link do convite';

export type ExternalInviteLinkFieldProps = {
  value: string;
  /** Mensagem curta acima do campo — ex.: confirmação de criação do convite. */
  intro?: string;
  testId: string;
  className?: string;
};

/** Apresentação padronizada de links externos copiáveis (assinatura e compartilhamento). */
export function ExternalInviteLinkField({
  value,
  intro,
  testId,
  className,
}: ExternalInviteLinkFieldProps) {
  return (
    <div className={cn('space-y-2', className)} data-testid={testId}>
      {intro ? <p className="text-sm leading-relaxed text-doqyn-subtle">{intro}</p> : null}
      <CopyableTextField
        value={value}
        label={EXTERNAL_INVITE_LINK_LABEL}
        testId={`${testId}-copyable`}
      />
    </div>
  );
}
