import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { looksLikeEmail, useDirectoryLookup } from '../hooks/useDirectoryLookup';
import { useDirectorySearch } from '../hooks/useDirectorySearch';
import { useFrequentContacts } from '../hooks/useFrequentContacts';
import { ContactRow, useFormatContactMeta } from './ContactRow';
import { PartnerContactList } from './PartnerContactList';
import { useTranslation } from 'react-i18next';

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
  label,
  idleHint,
  initialEmail,
  onPick,
  onFallbackToLink,
  fallbackLabel,
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
  const { t } = useTranslation('directory');
  const formatContactMeta = useFormatContactMeta();
  const fieldLabel = label ?? t('crossTenantRecipientField.label');
  const hint = idleHint ?? t('crossTenantRecipientField.idleHint');

  const [email, setEmail] = useState(initialEmail ?? '');
  const normalized = email.trim().toLowerCase();
  const isEmail = looksLikeEmail(normalized);
  const lookup = useDirectoryLookup(normalized, isEmail);
  // Enquanto não é e-mail, o que se digita é apelido — e aí a busca por prefixo responde.
  const search = useDirectorySearch(normalized, !isEmail);

  /** Menos de dois caracteres nem chega ao servidor — ver `useDirectorySearch`. */
  const prefixTooShort = normalized.replace(/^@/, '').length < 2;

  /**
   * O histórico **não some ao digitar**, ele estreita.
   *
   * Sumir na primeira tecla tirava a lista da tela justo quando se começa a procurar alguém com
   * quem já se trocou documento — e aí só restava lembrar o apelido inteiro. Filtrado e cortado em
   * três, ele responde "é esta pessoa de novo" sem disputar espaço com a busca, que vem logo
   * abaixo e é a resposta para quem ainda não está no histórico.
   *
   * O filtro é local e o nome entra nele: esta lista já chegou ao navegador, então casar por nome
   * aqui não pede nada novo ao servidor nem revela ninguém que já não estivesse na tela. A busca
   * do diretório continua sendo só por prefixo de apelido — lá o nome não existe em claro.
   */
  const frequentContacts = useFrequentContacts('external', { limit: 8 });
  const recentes = useMemo(() => {
    const frequentes = frequentContacts.data ?? [];
    if (!normalized) return frequentes;
    return frequentes
      .filter((contact) =>
        `${contact.username ?? ''} ${contact.email ?? ''} ${contact.name}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 3);
  }, [frequentContacts.data, normalized]);
  const mostrarFrequentes = recentes.length > 0;

  /**
   * O diretório não repete quem já está logo acima: com as duas listas na tela ao mesmo tempo, a
   * mesma pessoa aparecia duas vezes e a segunda linha não oferecia nada que a primeira não desse.
   */
  const hits = useMemo(() => {
    const results = search.data?.results ?? [];
    if (!mostrarFrequentes) return results;
    const jaListados = new Set(recentes.map((contact) => contact.userId));
    return results.filter((hit) => !jaListados.has(hit.userId));
  }, [mostrarFrequentes, recentes, search.data]);

  let resolution: Resolution | null = null;
  let action: { label: string; run: () => void } | null = null;

  if (!isEmail) {
    /**
     * O caminho por apelido não tinha estado nenhum: procurando, deu erro e não achou ninguém
     * mostravam todos a mesma dica de sempre. Uma busca que voltava vazia era indistinguível de
     * uma busca que nunca aconteceu, e quem digitava o apelido inteiro de alguém concluía que o
     * campo estava quebrado.
     *
     * Buscar pelo próprio apelido cai aqui também: o servidor filtra quem consulta
     * (`hit.id !== user.id`), então a resposta é vazia — correta, e ilegível sem esta linha.
     * Distinguir esse caso pelo nome exigiria `username` em `/api/me`, que a sessão verificada
     * do auth-service não carrega; o vazio genérico já diz a verdade.
     */
    if (prefixTooShort) {
      resolution = { tone: 'muted', text: hint };
    } else if (search.isLoading) {
      resolution = { tone: 'muted', text: t('crossTenantRecipientField.procurando') };
    } else if (search.isError) {
      resolution = { tone: 'warn', text: t('crossTenantRecipientField.erroConsulta') };
    } else if (hits.length === 0 && !mostrarFrequentes) {
      resolution = { tone: 'warn', text: t('crossTenantRecipientField.ninguemComPrefixo') };
    } else {
      resolution = { tone: 'muted', text: hint };
    }
  } else if (lookup.isLoading) {
    resolution = { tone: 'muted', text: t('crossTenantRecipientField.procurando') };
  } else if (lookup.isError || !lookup.data) {
    resolution = { tone: 'warn', text: t('crossTenantRecipientField.erroConsulta') };
  } else if (lookup.data.kind === 'self') {
    resolution = { tone: 'warn', text: t('crossTenantRecipientField.seuEmail') };
  } else if (lookup.data.kind === 'tenant_member') {
    // Achou em casa: o caminho certo é o campo de cima, e dizer isso evita o envio pendente
    // desnecessário para quem já é colega.
    resolution = {
      tone: 'warn',
      text: t('crossTenantRecipientField.ehDaqui', { name: lookup.data.user.name }),
    };
  } else if (lookup.data.kind === 'doqyn_user') {
    const { name } = lookup.data.user;
    resolution = { tone: 'ok', text: t('crossTenantRecipientField.usaDoqyn', { name }) };
    action = {
      label: t('crossTenantRecipientField.escolher', { name }),
      run: () => onPick({ email: normalized, name }),
    };
  } else {
    // Sem conta, ou com conta e o envio entre empresas desligado: a resposta é a mesma de
    // propósito, para que "tem conta aqui" não se descubra de graça.
    resolution = { tone: 'warn', text: t('crossTenantRecipientField.semConta') };
    if (onFallbackToLink) {
      action = {
        label: fallbackLabel ?? t('crossTenantRecipientField.fallbackLink'),
        run: () => onFallbackToLink(normalized),
      };
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        label={fieldLabel}
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

      {/* O histórico vem primeiro, e continua na tela enquanto se digita.

          É o que responde "para quem eu mando isto de novo?" sem exigir que a pessoa lembre do
          apelido inteiro. As duas listas convivem porque respondem coisas diferentes, e a ordem
          diz qual é qual: em cima, quem você já conhece, no máximo três; embaixo, o diretório,
          para quem ainda não está aqui. */}
      {mostrarFrequentes ? (
        <div>
          <p className="text-eyebrow uppercase text-doqyn-subtle">
            {t('crossTenantRecipientField.comQuemVoceJa')}
          </p>
          <ul className="mt-1 max-h-56 overflow-y-auto border-t border-doqyn-border-subtle">
            {recentes.map((contact) => (
              <li key={contact.userId} className="border-b border-doqyn-border-subtle">
                <ContactRow
                  name={contact.name}
                  email={contact.email}
                  meta={formatContactMeta(contact.interactions, contact.lastInteractionAt)}
                  disabled={disabled || !(contact.email ?? contact.username)}
                  onPick={() => {
                    // Preenche o campo em vez de escolher direto: o `lookup` por e-mail é que
                    // decide se a pessoa ainda tem conta e se o envio entre empresas está ligado.
                    // Pular essa checagem ofereceria um destino que o servidor pode recusar.
                    // O apelido serve quando não há e-mail guardado: cai na busca por prefixo,
                    // que resolve do mesmo jeito. Antes a linha só ficava apagada.
                    const alvo = contact.email ?? contact.username;
                    if (alvo) setEmail(alvo);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
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
          {t('crossTenantRecipientField.haMaisGenteCom')}
        </span>
      ) : null}
      {/* O agrupamento por empresa responde outra pergunta — "com quem eu falo naquela empresa" —
          e por isso continua existindo, um degrau abaixo. */}
      <PartnerContactList onPick={setEmail} />
    </div>
  );
}
