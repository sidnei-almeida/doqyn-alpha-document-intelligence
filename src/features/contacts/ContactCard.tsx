import { Badge } from '@/components/ui/Badge';
import { TableRowActionsMenu } from '@/components/ui/TableRowActionsMenu';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatContactMeta } from '@/features/directory/components/ContactRow';
import type { FrequentContact } from '@/features/directory/api/frequentContactsApi';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export type ContactAction = 'share' | 'signature' | 'request' | 'hide';

/**
 * Uma pessoa, num cartão — e o cartão segue o kit, não o hábito.
 *
 * Linha de tabela é o formato de quem compara valores entre registros, e ninguém compara
 * contatos. Aqui a unidade é a pessoa.
 *
 * As regras de forma vêm do kit de marca e não são decoração:
 *
 * · **Fio, não caixa.** Sem preenchimento próprio — o cartão existe para agrupar o que é de uma
 *   pessoa só, e um bloco preenchido a cada rosto empilharia seis retângulos sólidos na tela.
 * · **Canto de 4px.** Canto redondo demais lê como produto de consumo, e quem compra isto compra
 *   previsibilidade de auditoria.
 * · **Régua de acento no hover**, à esquerda, em vez de trocar a cor da borda inteira. É a mesma
 *   reação do item de menu, do item da sidebar e da régua do campo em foco.
 * · **Monoespaçado no rótulo de registro** — a contagem de trocas é registro, não frase.
 */
export function ContactCard({
  contact,
  onAction,
}: {
  contact: FrequentContact;
  onAction: (action: ContactAction, contact: FrequentContact) => void;
}) {
  const { t } = useTranslation('contacts');

  // Nem toda origem registra o e-mail. Sem ele não há para onde mandar o que quer que seja, e uma
  // ação ativa ofereceria um caminho que falha no envio.
  const semEndereco = contact.scope === 'external' && !contact.email;

  return (
    <article
      className={cn(
        'group relative flex flex-col items-center gap-2 rounded-[4px] border border-doqyn-border-subtle p-5 text-center',
        'transition-colors duration-[var(--transition-duration-fast)] hover:bg-doqyn-hover/40',
        // A régua mora num pseudo-elemento para não somar 2px à largura no hover e empurrar a
        // grade inteira meio pixel para o lado.
        'before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent',
        'hover:before:bg-doqyn-accent-active',
      )}
    >
      {/* Visível sempre, e não só no hover: é o padrão das linhas da Biblioteca, e hover não
          existe em toque — escondê-lo faria as ações sumirem no celular. Recuado em opacidade
          para não competir com o rosto, e inteiro quando a mão chega perto. */}
      <div className="absolute right-1.5 top-1.5 opacity-45 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <TableRowActionsMenu
          actions={[
            {
              label: 'Compartilhar documento…',
              onClick: () => onAction('share', contact),
              hidden: semEndereco,
            },
            {
              label: 'Solicitar assinatura…',
              onClick: () => onAction('signature', contact),
              hidden: semEndereco,
            },
            {
              label: 'Pedir documento…',
              onClick: () => onAction('request', contact),
              hidden: semEndereco,
            },
            {
              // "Remover da lista", e não "excluir": o histórico de trocas continua registrado, e
              // é ele que responde auditoria. O rótulo promete exatamente o que acontece.
              label: 'Remover da lista',
              onClick: () => onAction('hide', contact),
              tone: 'danger',
            },
          ]}
        />
      </div>

      <UserAvatar name={contact.name} email={contact.email} size="lg" />

      <div className="w-full min-w-0">
        <p className="type-body truncate text-doqyn-text">{contact.name}</p>
        {contact.username ? (
          <p className="truncate font-mono text-micro text-doqyn-muted">@{contact.username}</p>
        ) : null}
        <p className="truncate text-micro text-doqyn-subtle">
          {contact.email ?? 'sem e-mail nesta troca'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {contact.scope === 'external' ? (
          // O aceite é a diferença que muda o que acontece depois de enviar, e por isso está no
          // cartão e não só no título da seção — o cartão é o que a pessoa lê antes de clicar.
          <Badge variant="neutral">{t('contactCard.deFora')}</Badge>
        ) : null}
        {contact.saved ? <Badge variant="brand">{t('contactCard.salvo')}</Badge> : null}
      </div>

      <p className="register-label text-doqyn-subtle">
        {/* Salvo e nunca acionado não tem data de troca. "0 trocas · última hoje" seria mentira
            sobre a única coisa que a linha afirma. */}
        {contact.interactions === 0
          ? 'salvo à mão · nenhuma troca ainda'
          : formatContactMeta(contact.interactions, contact.lastInteractionAt)}
      </p>
    </article>
  );
}
