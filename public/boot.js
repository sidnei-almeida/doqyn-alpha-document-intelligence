// Roda antes do React montar, e por isso mora fora do bundle: o tema e o idioma precisam estar
// no <html> antes da primeira pintura. Ficava embutido no index.html, o que obrigava a CSP a
// aceitar script inline — e `script-src 'self' 'unsafe-inline'` não barra XSS nenhum.
// Dois atributos, não um: `data-appearance` nomeia o tema e `data-theme` diz
// qual paleta vale por padrão — a do painel. No `standard` a casca desmente
// esse padrão localmente. Espelha `src/lib/theme.ts`; se um mudar, muda os dois.
//
// Quem chega pela primeira vez vê o `standard`, e não o que o sistema operacional
// prefere. O DOQYN tem uma aparência própria — casca de grafite, painel de papel —
// e é ela que apresenta o produto; herdar o modo escuro do sistema mostrava a
// terceira opção da lista para quem nunca escolheu nenhuma. A partir daí a escolha
// é da pessoa, e fica gravada.
(function () {
  var stored = localStorage.getItem('doqyn-theme');
  var theme =
    stored === 'standard' || stored === 'light' || stored === 'dark' ? stored : 'standard';
  var palette = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.appearance = theme;
  document.documentElement.dataset.theme = palette;
  document.documentElement.style.colorScheme = palette;
})();

// O idioma pelo mesmo motivo que o tema: o React só monta depois, e até lá o
// documento inteiro já declarou `lang="pt-BR"`. Um quadro no idioma errado é
// pouco para os olhos e muito para o leitor de tela, que escolhe a fonética
// pelo atributo — e para o navegador, que oferece traduzir uma página que já
// está no idioma certo.
//
// Espelha `resolveInitialLocale` de `src/i18n/locales.ts`; se um mudar, muda os
// dois. Só idioma pronto entra por conta própria — `?lang=` é o único caminho
// que aceita um catálogo ainda em tradução.
(function () {
  var READY = ['pt-BR'];
  var ALL = ['pt-BR', 'en-US', 'es-419'];
  function normalize(value) {
    if (!value) return null;
    var tag = String(value).trim().replace('_', '-');
    if (ALL.indexOf(tag) !== -1) return tag;
    var primary = tag.split('-')[0].toLowerCase();
    if (primary === 'pt') return 'pt-BR';
    if (primary === 'en') return 'en-US';
    if (primary === 'es') return 'es-419';
    return null;
  }
  var locale = null;
  try {
    locale = normalize(new URLSearchParams(location.search).get('lang'));
    if (!locale) {
      var saved = normalize(localStorage.getItem('doqyn-locale'));
      if (saved && READY.indexOf(saved) !== -1) locale = saved;
    }
    if (!locale) {
      var preferred = navigator.languages || [navigator.language];
      for (var i = 0; i < preferred.length && !locale; i++) {
        var candidate = normalize(preferred[i]);
        if (candidate && READY.indexOf(candidate) !== -1) locale = candidate;
      }
    }
  } catch (error) {
    locale = null;
  }
  document.documentElement.lang = locale || 'pt-BR';
})();
