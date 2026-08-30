import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { looksLikeEmail, useDirectoryLookup } from '../hooks/useDirectoryLookup';
import { useDirectorySearch } from '../hooks/useDirectorySearch';
import { useFrequentContacts } from '../hooks/useFrequentContacts';
import { ContactRow, formatContactMeta } from './ContactRow';
import { PartnerContactList } from './PartnerContactList';

/**
 * Campo próprio para achar alguém de **outra** empresa.
 *
 * **O nome de usuário vem primeiro, e o e-mail é o outro caminho.** Eram duas formas com peso
 * igual no rótulo, e o rótulo dizia "e-mail" — então quem procurava alguém do DOQYN em outra
 * empresa não tinha como saber que era pelo apelido que se procura.
 *
 * São duas porque o schema manda: **apelido** responde prefixo e é digitável; **e-mail** só
 * responde igualdade exata, porque o que existe dele é um hash determinístico. O nome nunca entra
 * na busca — é guardado cifrado, e tirá-lo de lá para permitir busca desfaria a decisão que
 * protege todo mundo.
 *
 * O e-mail continua aceito porque é ele que leva ao terceiro caso: quem **não** tem conta DOQYN,
 * e recebe por link. Tirar o e-mail daqui fecharia essa saída.
 *
 * Não é o mesmo campo da busca de colegas: aquele varre uma lista conhecida. Misturar os dois num
 * campo só escondia o caminho de fora atrás do "ninguém encontrado" — e quem tem três colegas na
 * lista nunca via que ele existia.
 *
 * A mesma peça serve compartilhar, pedir assinatura e requisitar: são três verbos, uma fronteira.
 */
type Resolution =
  | { tone: 'muted'; text: string }
  | { tone: 'warn'; text: string }
  | { tone: 'ok'; text: string };

export function CrossTenantRecipientField({
  label = 'Nome de usuário de quem é de outra empresa',
  idleHint = 'Quem tem conta DOQYN é achado pelo nome de usuário. O e-mail inteiro também resolve, e é o caminho de quem não tem conta.',
  initialEmail,
  onPick,
  onFallbackToLink,
  fallbackLabel = 'Enviar por link',
  disabled,
}: {
  label?: string;
  idleHint?: string;
  /**
   * O e-mail com que o campo nasce, quando o envio já começou com alguém escolhido.
   *
   * Só no primeiro render — o campo desmonta junto com o modal, então "primeiro render" é
   * "cada abertura". Reaplicar a cada render desfaria a digitação de quem trocasse de pessoa.
   */
  initialEmail?: string;
  /** Chamado quando o e-mail resolve para um usuário DOQYN de outra empresa. */
  /**
   * O escolhido. `email` vem preenchido quando se digitou um e-mail; `username`, quando se escolheu
   * um resultado da busca. Nunca os dois: o diretório não entrega e-mail a quem só buscou.
   */
  onPick: (recipient: { email?: string; username?: string; name: string }) => void;
  /**
   * O caminho para quem não tem conta. Ausente quando o fluxo não oferece link com token — e aí o
   * campo só diz que não deu, em vez de prometer uma saída que não existe.
   */
  onFallbackToLink?: (email: string) => void;
  fallbackLabel?: string;
  disabled?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const normalized = email.trim().toLowerCase();
  const isEmail = looksLikeEmail(normalized);
  const lookup = useDirectoryLookup(normalized, isEmail);
  // Enquanto não é e-mail, o que se digita é apelido — e aí a busca por prefixo responde.
  const search = useDirectorySearch(normalized, !isEmail);
  const hits = search.data?.results ?? [];

  const frequentContacts = useFrequentContacts('external', { enabled: !normalized, limit: 8 });
  const frequentes = frequentContacts.data ?? [];
  const mostrarFrequentes = !normalized && frequentes.length > 0;

  let resolution: Resolution | null = null;
  let action: { label: string; run: () => void } | null = null;

  if (!isEmail) {
    resolution = { tone: 'muted', text: idleHint };
  } else if (lookup.isLoading) {
    resolution = { tone: 'muted', text: 'Procurando…' };
  } else if (lookup.isError || !lookup.data) {
    resolution = { tone: 'warn', text: 'Não foi possível consultar agora.' };
  } else if (lookup.data.kind === 'self') {
    resolution = { tone: 'warn', text: 'Esse é o seu e-mail.' };
  } else if (lookup.data.kind === 'tenant_member') {
    // Achou em casa: o caminho certo é o campo de cima, e dizer isso evita o envio pendente
    // desnecessário para quem já é colega.
    resolution = {
      tone: 'warn',
      text: `${lookup.data.user.name} é da sua empresa. Use a busca acima.`,
    };
  } else if (lookup.data.kind === 'doqyn_user') {
    const { name } = lookup.data.user;
    resolution = {
      tone: 'ok',
      text: `${name} usa o DOQYN. O documento continua seu, e ela precisa aceitar antes de ver.`,
    };
    action = { label: `Escolher ${name}`, run: () => onPick({ email: normalized, name }) };
  } else {
    // Sem conta, ou com conta e o envio entre empresas desligado: a resposta é a mesma de
    // propósito, para que "tem conta aqui" não se descubra de graça.
    resolution = { tone: 'warn', text: 'Esse e-mail não tem conta DOQYN.' };
    if (onFallbackToLink) {
      action = { label: fallbackLabel, run: () => onFallbackToLink(normalized) };
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        label={label}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="joao.silva"
        autoComplete="off"
        disabled={disabled}
      />

      {resolution ? (
        <span
          className={cn(
            'text-[11px]',
            resolution.tone === 'ok' && 'text-doqyn-accent-active',
            resolution.tone === 'warn' && 'text-doqyn-warning',
            resolution.tone === 'muted' && 'text-doqyn-subtle',
          )}
        >
          {resolution.text}
        </span>
      ) : null}

      {action ? (
        <Button type="button" size="sm" variant="ghost" onClick={action.run} disabled={disabled}>
          {action.label}
        </Button>
      ) : null}

      {/* O que a busca por apelido achou. Colega de casa não aparece aqui: para ele existe a
          busca por nome, que é melhor, e oferecê-lo por este caminho criaria pendência de aceite
          onde bastava compartilhar.

          Altura travada com rolagem própria: a lista mora dentro de um formulário em modal, e
          deixá-la crescer empurraria categoria, prazo e o botão de enviar para fora da vista
          justamente enquanto se escolhe o destinatário. */}
      {!isEmail && hits.length > 0 ? (
        <ul className="max-h-56 overflow-y-auto border-t border-doqyn-border-subtle">
          {hits.map((hit) => (
            <li key={hit.userId} className="border-b border-doqyn-border-subtle">
              <ContactRow
                name={hit.name}
                email={hit.email}
                username={hit.username}
                avatarUrl={hit.avatarUrl}
                disabled={disabled}
                onPick={() => onPick({ username: hit.username, name: hit.name })}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Nunca "mostrando 8 de 1000": a contagem total é a informação que um diretório varrível
          entregaria de graça. O que a pessoa precisa saber é o que fazer — digitar mais. */}
      {!isEmail && search.data?.hasMore ? (
        <span className="text-micro text-doqyn-subtle">
          Há mais gente com esse começo de nome de usuário. Digite mais letras para estreitar.
        </span>
      ) : null}

      {/* O histórico, enquanto ainda não se digitou nada.

          É o que responde "para quem eu mando isto de novo?" sem exigir que a pessoa lembre do
          e-mail ou do apelido. Some assim que se digita: aí a busca é a resposta melhor, e manter
          as duas listas na tela ao mesmo tempo faria a pessoa escolher entre elas sem saber a
          diferença. */}
      {mostrarFrequentes ? (
        <div>
          <p className="text-eyebrow uppercase text-doqyn-subtle">Com quem você já trocou</p>
          <ul className="mt-1 max-h-56 overflow-y-auto border-t border-doqyn-border-subtle">
            {frequentes.map((contact) => (
              <li key={contact.userId} className="border-b border-doqyn-border-subtle">
                <ContactRow
                  name={contact.name}
                  email={contact.email}
                  meta={formatContactMeta(contact.interactions, contact.lastInteractionAt)}
                  disabled={disabled || !contact.email}
                  onPick={() => {
                    // Preenche o campo em vez de escolher direto: o `lookup` por e-mail é que
                    // decide se a pessoa ainda tem conta e se o envio entre empresas está ligado.
                    // Pular essa checagem ofereceria um destino que o servidor pode recusar.
                    if (contact.email) setEmail(contact.email);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* O agrupamento por empresa responde outra pergunta — "com quem eu falo naquela empresa" —
          e por isso continua existindo, um degrau abaixo. */}
      <PartnerContactList onPick={setEmail} />
    </div>
  );
}
