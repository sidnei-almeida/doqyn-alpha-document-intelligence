import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';
import { i18n } from '@/i18n';
import { DEFAULT_LOCALE } from '@/i18n/locales';
import { formatCnpj, formatCpf, isCompleteTaxId, normalizeTaxId } from './taxId';

/**
 * O idioma em que o `Intl` deve escrever nome de país e ordenar a lista.
 *
 * Antes era `pt-BR` cravado no parâmetro padrão, e nenhum chamador passava outra coisa: o
 * cadastro em inglês listaria "Alemanha" e ordenaria por A de Alemanha. O parâmetro continua
 * existindo para quem precisar de um idioma específico — o resto pergunta ao i18n.
 */
function activeLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE;
}

export type { CountryCode };

export type PersonType = 'individual' | 'company';

export type CountryOption = {
  code: CountryCode;
  /** Nome do país no idioma do usuário. */
  name: string;
  /** DDI, sem o `+`. */
  callingCode: string;
};

export const DEFAULT_COUNTRY: CountryCode = 'BR';

/**
 * Tolerância de documento fiscal fora do Brasil.
 *
 * O backend (`doqyn-auth-service/src/utils/taxIdValidation.ts`) só conhece o algoritmo
 * brasileiro; para os demais países ele aceita de 4 a 20 caracteres alfanuméricos. Repetir
 * aqui exatamente os mesmos limites evita o pior dos mundos, que é o formulário aprovar um
 * documento que o servidor vai recusar — ou o contrário.
 */
const GENERIC_TAX_ID_MIN_LENGTH = 4;
const GENERIC_TAX_ID_MAX_LENGTH = 20;

/** Aceita letras porque vários documentos as usam (NIF/CIF espanhol, RUC, VAT europeu). */
function normalizeGenericTaxId(value: string): string {
  return value
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, GENERIC_TAX_ID_MAX_LENGTH);
}

export type TaxIdSpec = {
  /** Valor enviado como `taxIdType` — o backend só valida o mapeamento para BR. */
  type: string;
  /** Chave do rótulo: a spec é constante de módulo e não pode congelar a frase. */
  labelKey: string;
  /**
   * Chave do placeholder. No Brasil ele é máscara (`000.000.000-00`), e nenhum tradutor a
   * altera — mas passa pelo catálogo do mesmo jeito, para a spec ter uma forma só. Fora do
   * Brasil é frase de verdade, porque o campo é livre.
   */
  placeholderKey: string;
  /** Máscara aplicada enquanto se digita. */
  format: (value: string) => string;
  isComplete: (value: string) => boolean;
  /** Valor enviado à API. */
  toApiValue: (value: string) => string;
};

const BR_TAX_ID_SPECS: Record<PersonType, TaxIdSpec> = {
  individual: {
    type: 'cpf',
    labelKey: 'common:taxId.cpfLabel',
    placeholderKey: 'common:taxId.cpfPlaceholder',
    format: (value) => formatCpf(normalizeTaxId(value)),
    isComplete: (value) => isCompleteTaxId(value, 'CPF'),
    toApiValue: (value) => normalizeTaxId(value),
  },
  company: {
    type: 'cnpj',
    labelKey: 'common:taxId.cnpjLabel',
    placeholderKey: 'common:taxId.cnpjPlaceholder',
    format: (value) => formatCnpj(normalizeTaxId(value)),
    isComplete: (value) => isCompleteTaxId(value, 'CNPJ'),
    toApiValue: (value) => normalizeTaxId(value),
  },
};

const GENERIC_TAX_ID_SPEC: TaxIdSpec = {
  type: 'tax_id',
  labelKey: 'common:taxId.genericLabel',
  placeholderKey: 'common:taxId.genericPlaceholder',
  format: (value) => normalizeGenericTaxId(value),
  isComplete: (value) => {
    const normalized = normalizeGenericTaxId(value);
    return (
      normalized.length >= GENERIC_TAX_ID_MIN_LENGTH &&
      normalized.length <= GENERIC_TAX_ID_MAX_LENGTH
    );
  },
  toApiValue: (value) => normalizeGenericTaxId(value),
};

/** Só o Brasil tem documento com formato conhecido dos dois lados; o resto é campo livre. */
export function getTaxIdSpec(country: CountryCode, personType: PersonType): TaxIdSpec {
  return country === 'BR' ? BR_TAX_ID_SPECS[personType] : GENERIC_TAX_ID_SPEC;
}

/**
 * Países oferecidos no cadastro.
 *
 * A lista vem do `libphonenumber-js`, a mesma que o backend usa em `isSupportedCountry` para
 * validar o campo `country` — assim os dois lados não divergem sobre o que é um país válido.
 * Os nomes saem do `Intl.DisplayNames`, sem catálogo próprio para manter.
 */
export function listCountries(locale = activeLocale()): CountryOption[] {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' });

  const options = getCountries().map((code) => ({
    code,
    name: displayNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }));

  options.sort((a, b) => a.name.localeCompare(b.name, locale));

  // O público inicial é brasileiro: o país mais provável não deve exigir rolagem.
  const brazilIndex = options.findIndex((option) => option.code === DEFAULT_COUNTRY);
  if (brazilIndex > 0) {
    const [brazil] = options.splice(brazilIndex, 1);
    options.unshift(brazil);
  }

  return options;
}

/**
 * Nome do país, e nunca uma exceção.
 *
 * `Intl.DisplayNames.of` lança `RangeError` com qualquer coisa que não seja um código de região
 * válido — inclusive `undefined` e string vazia, que é o que chega quando o formulário ainda não
 * teve o país escolhido. Deixar estourar derrubava a tela de revisão inteira por causa de um
 * rótulo; devolver o código cru mostra algo útil e segue.
 */
export function getCountryName(country: CountryCode, locale = activeLocale()): string {
  if (!country) return '';
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}

export function phonePlaceholder(country: CountryCode): string {
  return `+${getCountryCallingCode(country)}`;
}

/** Máscara progressiva do telefone conforme o país escolhido. */
export function formatPhoneForCountry(country: CountryCode, value: string): string {
  if (!value.trim()) return '';
  return new AsYouType(country).input(value);
}

export function isCompletePhoneForCountry(country: CountryCode, value: string): boolean {
  return isValidPhoneNumber(value, country);
}

/** Valor enviado à API: E.164 (`+5554999998888`). O backend renormaliza com o mesmo país. */
export function toPhoneApiValue(country: CountryCode, value: string): string {
  return parsePhoneNumberFromString(value, country)?.number ?? value.trim();
}
