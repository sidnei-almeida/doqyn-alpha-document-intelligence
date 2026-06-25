export function slugifyName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function groupIdFromSlug(slug: string): string {
  return `group_${slug.replace(/-/g, '_')}`;
}

export function classIdFromSlug(slug: string): string {
  return `class_${slug.replace(/-/g, '_')}`;
}

export function memberIdFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'member';
  const slug = slugifyName(local).replace(/-/g, '_') || 'member';
  return `member_${slug}`;
}
