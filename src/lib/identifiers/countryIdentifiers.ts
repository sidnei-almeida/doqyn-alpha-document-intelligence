import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';
import { formatCnpj, formatCpf, isCompleteTaxId, normalizeTaxId } from './taxId';

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
  return value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, GENERIC_TAX_ID_MAX_LENGTH);
}

export type TaxIdSpec = {
  /** Valor enviado como `taxIdType` — o backend só valida o mapeamento para BR. */
  type: string;
  label: string;
  placeholder: string;
  /** Máscara aplicada enquanto se digita. */
  format: (value: string) => string;
  isComplete: (value: string) => boolean;
  /** Valor enviado à API. */
  toApiValue: (value: string) => string;
};

const BR_TAX_ID_SPECS: Record<PersonType, TaxIdSpec> = {
  individual: {
    type: 'cpf',
    label: 'CPF',
    placeholder: '000.000.000-00',
    format: (value) => formatCpf(normalizeTaxId(value)),
    isComplete: (value) => isCompleteTaxId(value, 'CPF'),
    toApiValue: (value) => normalizeTaxId(value),
  },
  company: {
    type: 'cnpj',
    label: 'CNPJ',
    placeholder: '00.000.000/0000-00',
    format: (value) => formatCnpj(normalizeTaxId(value)),
    isComplete: (value) => isCompleteTaxId(value, 'CNPJ'),
    toApiValue: (value) => normalizeTaxId(value),
  },
};

const GENERIC_TAX_ID_SPEC: TaxIdSpec = {
  type: 'tax_id',
  label: 'Documento fiscal',
  placeholder: 'Documento de identificação fiscal',
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
export function listCountries(locale = 'pt-BR'): CountryOption[] {
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

export function getCountryName(country: CountryCode, locale = 'pt-BR'): string {
  return new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country;
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
