// @def.doc definition-service

const separatorPattern = /[\s:_./\\|()[\]{}"'`~,;!?<>+=*&^%$#@]+/g;
const dashPattern = /[-]+/g;

export function normalizeSemanticText(raw: string): string {
  return raw
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(dashPattern, ' ')
    .replace(separatorPattern, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSemanticText(raw: string): readonly string[] {
  const normalized = normalizeSemanticText(raw);
  if (!normalized) return [];
  return [...new Set(normalized.split(' ').filter(Boolean))];
}
