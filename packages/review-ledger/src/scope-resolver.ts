/**
 * filePath → serviceScope 매핑.
 *
 * 우선순위:
 * 1. packages/<name>/ → 패키지 이름
 * 2. docs/specs/<domain>/ → "docs:<domain>"
 * 3. docs/ → "docs"
 * 4. .github/ → "ci"
 * 5. 루트 파일 → "root"
 */

const PACKAGES_RE = /^packages\/([^/]+)\//;
const DOCS_SPECS_RE = /^docs\/specs\/([^/]+)\//;
const DOCS_RE = /^docs\//;
const GITHUB_RE = /^\.github\//;

export function resolveScope(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");

  const pkgMatch = normalized.match(PACKAGES_RE);
  if (pkgMatch) return pkgMatch[1];

  const specMatch = normalized.match(DOCS_SPECS_RE);
  if (specMatch) return `docs:${specMatch[1]}`;

  if (DOCS_RE.test(normalized)) return "docs";
  if (GITHUB_RE.test(normalized)) return "ci";

  return "root";
}
