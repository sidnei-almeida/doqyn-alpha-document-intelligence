import { useEffect, useState } from 'react';
import { isSupportedCountry } from 'libphonenumber-js/min';
import type { CountryCode } from '@/lib/identifiers/countryIdentifiers';

type DetectCountryResponse = {
  country?: string | null;
};

/**
 * Sugestão de país por IP (GeoIP, via GET /api/geo/detect-country) pra pré-selecionar
 * o CountrySelect no formulário de cadastro. Retorna null enquanto carrega ou se não
 * foi possível detectar — quem chama já tem um default por locale do navegador e deve
 * preservar a seleção manual do usuário sobre essa sugestão.
 */
export function useDetectedCountry(): CountryCode | null {
  const [detected, setDetected] = useState<CountryCode | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/geo/detect-country')
      .then((response) => (response.ok ? (response.json() as Promise<DetectCountryResponse>) : null))
      .then((data) => {
        if (cancelled || !data?.country) return;
        // Cloudflare devolve 'XX' (IP não geolocalizável) ou 'T1' (saída Tor) em
        // cf-ipcountry — nenhum dos dois é um país real; sem essa checagem,
        // getCountryCallingCode (libphonenumber-js) lança exceção e derruba a página.
        if (!isSupportedCountry(data.country)) return;
        setDetected(data.country);
      })
      .catch(() => {
        // Falha silenciosa — mantém o default por locale já usado no formulário.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return detected;
}
