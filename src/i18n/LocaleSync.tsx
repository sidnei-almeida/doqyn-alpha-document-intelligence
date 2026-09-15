/**
 * Quando a sessão chega, o perfil vence o navegador.
 *
 * Antes da sessão, o idioma sai do `localStorage` ou do `Accept-Language` — é o que dá para
 * saber sobre alguém que ainda não se identificou, e é o que a antessala usa. Depois dela,
 * quem manda é a coluna `locale` do perfil: foi ali que a pessoa registrou a escolha, e é
 * dali que o servidor tira o idioma do e-mail dela.
 *
 * Sem esta sincronização, entrar num navegador novo abriria o app em português enquanto os
 * e-mails chegavam em inglês — a mesma conta falando duas línguas, cada uma num canal.
 *
 * Fica **dentro** do `AuthProvider`, ao contrário do `I18nProvider`, que fica fora: o provider
 * precisa existir antes de haver sessão; a sincronização só faz sentido depois que há uma.
 */
import { useEffect } from 'react';
import { useAuth } from '@/auth/useAuth';
import { i18n } from './index';
import { normalizeLocale } from './locales';
import { setProfileTimeZone } from './timeZone';
import { rememberLocale } from './useLocale';

export function LocaleSync() {
  const { user } = useAuth();
  const profileLocale = normalizeLocale(user?.locale);

  /* O fuso é gravado no render, e não num efeito: é estado de módulo lido por quem formata
     data, sem assinatura de React. Num efeito, os irmãos abaixo já teriam pintado as datas no
     fuso do navegador, e nada os faria pintar de novo. `LocaleSync` vem antes de `children` em
     `providers.tsx`, então roda primeiro no mesmo passe. A chamada é idempotente. */
  setProfileTimeZone(user?.timeZone);

  useEffect(() => {
    if (!profileLocale) return;

    /* O cache de arranque é atualizado sempre, mesmo quando o idioma já está certo.
       O caso que obriga a isso: o `localStorage` guardava um idioma ainda em preparo, o
       arranque o descartou e caiu no padrão, e o padrão calhou de ser o do perfil. Sem esta
       linha o valor velho ficaria lá — inerte hoje, e uma piscada no idioma errado no dia em
       que aquele idioma for liberado. */
    rememberLocale(profileLocale);

    if (i18n.language !== profileLocale) {
      void i18n.changeLanguage(profileLocale);
    }
  }, [profileLocale]);

  return null;
}
