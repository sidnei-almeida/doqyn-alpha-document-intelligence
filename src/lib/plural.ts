/**
 * Plural, e não `tentativa(s)`.
 *
 * O parêntese é a marca de texto gerado por máquina, e custa uma função escrever certo. A regra
 * nasceu nos templates de e-mail (`emailLayout.ts`, nos dois repositórios) e vale igual na tela:
 * confirmação de cadastro é justamente onde o produto aparece cuidadoso ou parece automático.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
