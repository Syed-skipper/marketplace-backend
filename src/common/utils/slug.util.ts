export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function appendUniqueSuffix(slug: string, suffix: string): string {
  return `${slug}-${suffix.slice(0, 8)}`;
}
