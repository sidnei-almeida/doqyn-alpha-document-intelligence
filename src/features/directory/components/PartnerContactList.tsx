import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { usePartnerTenants } from '../hooks/usePartnerTenants';
import { useTranslation } from 'react-i18next';

/**
 * As empresas com quem já se trocou documento, e quem foi o contato em cada uma.
 *
 * Não é agenda: é histórico. A lista nasce vazia e cresce sozinha a cada troca aceita, e por isso
 * nunca mente — uma agenda mantida à mão envelheceria e ofereceria gente que já saiu.
 *
 * Existe porque a busca entre empresas é por e-mail exato, e sempre será: o nome está cifrado no
 * auth-service sem chave de busca. Lembrar de quem já se falou é o que sobra, e é o que basta para
 * a segunda conversa em diante.
 */
export function PartnerContactList({ onPick }: { onPick: (email: string) => void }) {
  const { t } = useTranslation('directory');

  const [open, setOpen] = useState(false);
  const partners = usePartnerTenants();
  const known = partners.data?.partners ?? [];

  if (!known.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 text-caption text-doqyn-muted hover:text-doqyn-text"
      >
        <Icon name={open ? 'expand_less' : 'expand_more'} size={ICON_SIZE.xs} aria-hidden />
        {t('partnerContactList.contasComQuemVoce', { total: known.length })}
      </button>

      {open ? (
        <ul className="mt-2 border-t border-doqyn-border-subtle">
          {known.map((partner) => (
            <li key={partner.tenantId} className="border-b border-doqyn-border-subtle py-2">
              <p className="text-caption text-doqyn-text">{partner.displayName}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {partner.contacts.map((contact) =>
                  contact.email ? (
                    <button
                      key={contact.userId}
                      type="button"
                      onClick={() => onPick(contact.email!)}
                      className="text-micro text-doqyn-info hover:underline"
                    >
                      {contact.name}
                    </button>
                  ) : (
                    // Houve troca, mas por um caminho que não registrou o e-mail. Mostrar o nome
                    // com ação seria uma promessa que não se cumpre.
                    <span key={contact.userId} className="text-micro text-doqyn-subtle">
                      {contact.name}
                    </span>
                  ),
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
