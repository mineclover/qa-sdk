// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Deterministic label 아키텍처 경계 강제 테스트.
 *
 * SSOT: `docs/specs/definition-catalog/deterministic-label-architecture.spec.md`
 *
 * 각 계층 라이브러리의 `package.json` dependencies가 아키텍처 spec이 선언한
 * 허용 의존 목록과 일치하는지 검증한다. 위반 시 실패 + 문서 경로 안내.
 *
 * 원칙 (R-1, R-2):
 *   - 역방향 import 금지 (하위 계층이 상위 계층을 import 금지)
 *   - Layer 2 횡단 의존 금지 (ralph-tui-integration ↔ ontology-pack-validate)
 */

interface PackageBoundary {
  readonly name: string;
  readonly layer: string;
  readonly allowedDeps: ReadonlySet<string>;
}

const BOUNDARIES: readonly PackageBoundary[] = [
  {
    name: 'doc-envelope',
    layer: '1 (collection)',
    allowedDeps: new Set<string>(),
  },
  {
    name: 'ralph-tui-integration',
    layer: '2 (integration, parallel)',
    allowedDeps: new Set(['doc-envelope']),
  },
  {
    name: 'ontology-pack-validate',
    layer: '2 (integration, parallel)',
    allowedDeps: new Set([
      'doc-envelope',
      'definition-catalog',
      'authorization-ontology',
      'operational-ontology',
    ]),
  },
  {
    name: 'deterministic-label-registry',
    layer: '3 (interpretation)',
    allowedDeps: new Set(['doc-envelope']),
  },
];

describe('deterministic-label architecture boundary', () => {
  it.each(BOUNDARIES)(
    '$name (Layer $layer) only depends on permitted packages',
    async ({ name, allowedDeps }) => {
      const repoRoot = resolveRepoRoot();
      const pkgPath = resolve(repoRoot, 'packages', name, 'package.json');
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      const deps = Object.keys(pkg.dependencies ?? {});

      const violations = deps.filter((dep) => !allowedDeps.has(dep));
      if (violations.length > 0) {
        throw new Error(
          `${name} has forbidden dependencies: ${violations.join(', ')}\n` +
            'Permitted: ' +
            (allowedDeps.size === 0 ? '(none)' : [...allowedDeps].join(', ')) +
            '\n' +
            'See docs/specs/definition-catalog/deterministic-label-architecture.spec.md',
        );
      }

      expect(violations).toEqual([]);
    },
  );

  it('ralph-tui-integration and ontology-pack-validate do not cross-depend (Layer 2 horizontal)', async () => {
    const repoRoot = resolveRepoRoot();
    const ralphPkg = JSON.parse(
      await readFile(resolve(repoRoot, 'packages/ralph-tui-integration/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const packPkg = JSON.parse(
      await readFile(resolve(repoRoot, 'packages/ontology-pack-validate/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(Object.keys(ralphPkg.dependencies ?? {})).not.toContain('ontology-pack-validate');
    expect(Object.keys(packPkg.dependencies ?? {})).not.toContain('ralph-tui-integration');
  });
});

function resolveRepoRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, '../../../..');
}
