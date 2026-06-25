import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type ReportWriter = {
  line: (text?: string) => void;
  section: (title: string) => void;
  write: (path: string) => void;
  lines: string[];
};

export function createReportWriter(): ReportWriter {
  const lines: string[] = [];

  return {
    lines,
    line(text = '') {
      lines.push(text);
    },
    section(title: string) {
      lines.push('');
      lines.push('='.repeat(80));
      lines.push(title);
      lines.push('='.repeat(80));
    },
    write(path: string) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
    },
  };
}

export function getEnvTenantId(): string {
  return (
    process.env.MIGRATION_TENANT_ID?.trim() ||
    process.env.MONGODB_TENANT_ID?.trim() ||
    process.env.MONGODB_COMPANY_ID?.trim() ||
    'company_dev'
  );
}

export function isApplyFlag(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === 'true';
}

/** Remove possíveis valores sensíveis de strings de log. */
export function sanitizeLogValue(value: string): string {
  let out = value;
  if (/mongodb(\+srv)?:\/\//i.test(out)) out = '[REDACTED_URI]';
  out = out.replace(/\b\d{11}\b/g, '[REDACTED_CPF]');
  out = out.replace(/\b\d{14}\b/g, '[REDACTED_CNPJ]');
  out = out.replace(/\+?\d{10,15}/g, '[REDACTED_PHONE]');
  return out;
}
