import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useDirectorySearch } from '@/features/directory/hooks/useDirectorySearch';
import { useContactMutations } from '@/features/directory/hooks/useContactMutations';

/**
 * Adicionar contato pelo nome de usuário.
 *
 * É a ponta que nenhum histórico produz: alguém com quem ainda não se trocou nada. Sem isto,
 * achar uma pessoa pelo apelido servia para um envio só, e no dia seguinte era preciso lembrar o
 * handle de novo.
 *
 * **Apelido, e não e-mail.** Quem tem conta DOQYN é achado pelo handle — é a única coluna em
 * texto claro, e a que responde busca digitada. E-mail exato continua existindo como caminho, mas
 * é o caminho de quem **não** tem conta, e misturar os dois num campo só foi o que deixou a tela
 * confusa antes.
 */
export function AddContactField() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase().replace(/^@/, '');
  const search = useDirectorySearch(normalized, normalized.length >= 2);
  const { save } = useContactMutations();

  const hits = search.data?.results ?? [];

  return (
    <section className="max-w-xl space-y-2">
      <Input
        variant="rule"
        label="Adicionar contato pelo nome de usuário"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="joao.silva"
        autoComplete="off"
      />

      {normalized.length >= 2 && !search.isLoading && hits.length === 0 ? (
        <p className="text-micro text-doqyn-subtle">
          Ninguém com esse nome de usuário. Quem não tem conta DOQYN é convidado por link, no envio
          do documento.
        </p>
      ) : null}

      {hits.length > 0 ? (
        <ul className="max-h-56 overflow-y-auto border-t border-doqyn-border-subtle">
          {hits.map((hit) => (
            <li
              key={hit.userId}
              className="flex items-center gap-3 border-b border-doqyn-border-subtle py-2"
            >
              <UserAvatar name={hit.name} email={hit.email} avatarUrl={hit.avatarUrl} size="md" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="type-body truncate text-doqyn-text">{hit.name}</span>
                <span className="truncate font-mono text-micro text-doqyn-muted">
                  @{hit.username}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => {
                  // O apelido viaja, e não o id: é o servidor que resolve contra o diretório, e
                  // aceitar id daqui deixaria salvar quem se retirou da busca.
                  save.mutate({ username: hit.username });
                  setQuery('');
                }}
              >
                Salvar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
