import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import geoip from 'geoip-lite';
import { Reader, type CityResponse } from 'maxmind';

export type ApproximateGeo = {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
};

type GeoIpCityReader = {
  get(ip: string): CityResponse | null;
};

const BUNDLED_GEOLITE2_CITY_PATH = resolve(
  process.cwd(),
  'node_modules/geolite2-redist/dbs/GeoLite2-City.mmdb',
);

/** Normaliza IPv4-mapped IPv6 para lookup local. */
export function normalizeIpForGeoLookup(ip: string): string {
  return ip.replace(/^::ffff:/i, '').trim().toLowerCase();
}

export function isPrivateOrLoopbackIp(ip: string): boolean {
  const normalized = normalizeIpForGeoLookup(ip);
  if (!normalized) return true;

  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (normalized === 'localhost') return true;
  if (normalized === '127.0.0.1' || normalized.startsWith('127.')) return true;
  if (normalized === '0.0.0.0') return true;

  if (normalized.includes('.') && !normalized.includes(':')) {
    if (normalized.startsWith('10.')) return true;
    if (normalized.startsWith('192.168.')) return true;
    const privateClassB = normalized.match(/^172\.(\d+)\./);
    if (privateClassB) {
      const secondOctet = Number(privateClassB[1]);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
    return false;
  }

  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  return false;
}

function resolveGeoIpCityDbPath(): string | undefined {
  const fromEnv = process.env.GEOIP_CITY_DB_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    resolve(process.cwd(), 'data/geoip/GeoLite2-City.mmdb'),
    resolve(process.cwd(), 'server/data/geoip/GeoLite2-City.mmdb'),
    BUNDLED_GEOLITE2_CITY_PATH,
  ];

  return candidates.find((path) => existsSync(path));
}

function mergeApproximateGeo(primary: ApproximateGeo, fallback: ApproximateGeo): ApproximateGeo {
  return {
    city: primary.city ?? fallback.city,
    region: primary.region ?? fallback.region,
    country: primary.country ?? fallback.country,
    timezone: primary.timezone ?? fallback.timezone,
  };
}

export function mapMaxMindCityResponse(response: CityResponse): ApproximateGeo {
  const city =
    response.city?.names?.['pt-BR'] ??
    response.city?.names?.en ??
    undefined;
  const region =
    response.subdivisions?.[0]?.iso_code ??
    response.subdivisions?.[0]?.names?.['pt-BR'] ??
    response.subdivisions?.[0]?.names?.en ??
    undefined;

  return {
    city,
    region,
    country: response.country?.iso_code ?? undefined,
    timezone: response.location?.time_zone ?? undefined,
  };
}

function lookupGeoIpLite(ip: string): ApproximateGeo {
  const result = geoip.lookup(ip);
  if (!result) return {};

  return {
    country: result.country || undefined,
    region: result.region || undefined,
    city: result.city || undefined,
    timezone: result.timezone || undefined,
  };
}

function openCityReaderFromPath(dbPath: string): GeoIpCityReader | null {
  try {
    return new Reader<CityResponse>(readFileSync(dbPath));
  } catch {
    return null;
  }
}

async function ensureGeoLite2CityDbPath(): Promise<string | undefined> {
  const existing = resolveGeoIpCityDbPath();
  if (existing) return existing;

  try {
    const { downloadDbs, GeoIpDbName } = await import('geolite2-redist');
    // path é opcional em runtime; tipos do pacote exigem o campo.
    await downloadDbs({
      dbList: [GeoIpDbName.City],
    } as { path: string; dbList: import('geolite2-redist').GeoIpDbName[] });
  } catch {
    return undefined;
  }

  return resolveGeoIpCityDbPath();
}

let cityReader: GeoIpCityReader | null | undefined;
let cityReaderInit: Promise<GeoIpCityReader | null> | null = null;

async function loadCityReader(): Promise<GeoIpCityReader | null> {
  const dbPath = await ensureGeoLite2CityDbPath();
  if (!dbPath) return null;
  return openCityReaderFromPath(dbPath);
}

/** Pré-carrega GeoLite2-City (download local na 1ª execução, sem API externa por request). */
export async function initGeoIpCityReader(): Promise<void> {
  if (cityReader !== undefined) return;
  if (!cityReaderInit) {
    cityReaderInit = loadCityReader();
  }
  cityReader = await cityReaderInit;
}

function lookupMaxMindGeo(ip: string): ApproximateGeo {
  if (!cityReader) return {};

  try {
    const result = cityReader.get(ip);
    if (!result) return {};
    return mapMaxMindCityResponse(result);
  } catch {
    return {};
  }
}

/** Lookup offline por IP público — sem chamada externa por request. */
export function lookupApproximateGeoFromIp(ip: string): ApproximateGeo {
  if (!ip.trim() || isPrivateOrLoopbackIp(ip)) return {};

  const lookupIp = normalizeIpForGeoLookup(ip);
  const fromMaxMind = lookupMaxMindGeo(lookupIp);
  const fromLite = lookupGeoIpLite(lookupIp);

  return mergeApproximateGeo(fromMaxMind, fromLite);
}

void initGeoIpCityReader();
