// @def.doc definition-assembly

/**
 * 조립 기능 검증 — assembleFeature로 gate 시스템을 설명할 수 있는가
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { scanAndBuild, extractFrontmatter, type ScanResult } from './frontmatter.js';
import { assembleBoundary, assembleFeature } from './assemble.js';
import { extractByLevel } from './extract.js';
import { computeEffectiveConcerns } from './concern.js';

const ROOT = join(import.meta.dirname, '../../..');

let result: ScanResult;
let bodies: Map<string, string>;

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, 'docs')]);

  bodies = new Map();
  for (const entry of result.registry.all()) {
    if (entry.ref) {
      try {
        const content = await readFile(join(ROOT, entry.ref), 'utf-8');
        const fm = extractFrontmatter(content);
        if (fm) bodies.set(entry.id, fm.body);
      } catch {
        /* skip */
      }
    }
  }
}, 60_000);

// ─── gate-system 조립 ────────────────────────────────────

describe('assembleFeature: gate-system', () => {
  it('gate-system 그룹이 등록되어 있다', () => {
    const group = result.registry.get('gate-system');
    expect(group).toBeDefined();
    expect(group!.depth).toBe('overview');
  });

  it('gate-system이 6개 멤버를 structural link로 조망한다', () => {
    const links = result.registry
      .getLinks('gate-system', 'outgoing')
      .filter((l) => l.linkType === 'contains' || l.linkType === 'refs');
    expect(links.length).toBeGreaterThanOrEqual(6);
  });

  it('assembleFeature로 전체 요약을 조립한다', () => {
    const assembled = assembleFeature(
      'gate-system',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      (id) => bodies.get(id),
    );

    expect(assembled).not.toBeNull();

    // 그룹 purpose
    expect(assembled!.group.purpose).toContain('주소 공간의 물리적 유효성');

    // 멤버 6건
    expect(assembled!.members.length).toBeGreaterThanOrEqual(6);

    // 각 멤버에 purpose가 있다
    for (const m of assembled!.members) {
      expect(m.purpose, `${m.id}에 purpose 없음`).not.toBeNull();
    }

    // concerns
    expect(assembled!.concerns).toContain('security');
  });

  it('purpose 수준으로 조립하면 목적만 모인다', () => {
    const assembled = assembleFeature(
      'gate-system',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      (id) => bodies.get(id),
      'purpose',
    );

    // overview 줄은 없어야 함
    for (const m of assembled!.members) {
      expect(m.overview.length).toBe(0);
    }

    // text에 핵심 키워드
    expect(assembled!.text).toContain('RPC');
    expect(assembled!.text).toContain('상태');
    expect(assembled!.text).toContain('불변 조건');
  });

  it('overview 수준으로 조립하면 핵심 사실도 포함된다', () => {
    const assembled = assembleFeature(
      'gate-system',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      (id) => bodies.get(id),
      'overview',
    );

    // overview에 구체적 사실
    const allOverview = assembled!.members.flatMap((m) => m.overview);
    expect(allOverview.some((l) => l.includes('check'))).toBe(true);
    expect(allOverview.some((l) => l.includes('recompute'))).toBe(true);
  });

  it('멤버가 scope별로 정렬된다', () => {
    const assembled = assembleFeature(
      'gate-system',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      (id) => bodies.get(id),
    );

    const scopes = assembled!.members.map((m) => m.scope);
    // constraint → state → feature → flow → interface 순
    const constraintIdx = scopes.indexOf('constraint');
    const stateIdx = scopes.indexOf('state');
    const interfaceIdx = scopes.lastIndexOf('interface');
    expect(constraintIdx).toBeLessThan(stateIdx);
    expect(stateIdx).toBeLessThan(interfaceIdx);
  });

  it('텍스트 렌더링이 읽을 수 있는 형태다', () => {
    const assembled = assembleFeature(
      'gate-system',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      (id) => bodies.get(id),
      'purpose',
    );

    const text = assembled!.text;
    // 구조: # 그룹 제목, concern, ## [scope] 멤버 제목, purpose
    expect(text).toContain('# Gate 시스템');
    expect(text).toContain('concerns: security');
    expect(text).toContain('## [constraint]');
    expect(text).toContain('## [interface]');
  });
});

describe('assembleBoundary: viteplus playbook', () => {
  it('viteplus-sdk-smoke-system boundary는 direct 구조와 direct outgoing coupling만 조립한다', () => {
    const assembled = assembleBoundary(
      'viteplus-sdk-smoke-system',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      (id) => bodies.get(id),
    );

    expect(assembled).not.toBeNull();
    expect(
      assembled!.members.some((m) => m.id === 'viteplus-playbook-template-implementation'),
    ).toBe(true);
    expect(assembled!.members.some((m) => m.id === 'viteplus-playbook-provider-stack')).toBe(true);
    expect(assembled!.members.some((m) => m.id === 'sdk-usage-guide')).toBe(true);
    expect(assembled!.members.some((m) => m.id === 'sdk-vite-onboarding-guide')).toBe(true);
    expect(assembled!.text).toContain('## 구조');
    expect(assembled!.text).toContain('## 직접 결합');
  });

  it('template implementation boundary는 incoming refines와 outgoing depends_on을 분리해 보여준다', () => {
    const assembled = assembleBoundary(
      'viteplus-playbook-template-implementation',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      (id) => bodies.get(id),
    );

    expect(assembled).not.toBeNull();
    expect(
      assembled!.couplings.incoming.some(
        (c) => c.linkType === 'depends_on' && c.doc.id === 'viteplus-playbook-template-flow',
      ),
    ).toBe(true);
    expect(
      assembled!.couplings.incoming.some(
        (c) => c.doc.id === 'viteplus-canonical-review-implementation',
      ),
    ).toBe(true);
    expect(
      assembled!.couplings.outgoing.some(
        (c) => c.linkType === 'depends_on' && c.doc.id === 'sdk-usage-guide',
      ),
    ).toBe(true);
    expect(
      assembled!.couplings.outgoing.some((c) => c.doc.id === 'viteplus-playbook-boundary-relation'),
    ).toBe(true);
  });
});

// ─── concern 전파 (contains 경로) ────────────────────────

describe('refs 경로 concern 분리', () => {
  it('gate-system layout refs는 gate-api의 직접 security를 대체하지 않는다', () => {
    const gateApi = computeEffectiveConcerns(
      'gate-api',
      (id) => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
    );
    expect(gateApi.all).toContain('security');
    expect(gateApi.direct).toContain('security');
  });
});

// ─── 전체 frontmatter 문서 마커 커버리지 ─────────────────

describe('마커 커버리지', () => {
  it('frontmatter가 있는 모든 문서에 ^purpose가 있다', () => {
    const withoutPurpose: string[] = [];

    for (const entry of result.registry.all()) {
      if (entry.ref?.startsWith('docs/proposals/')) continue;
      if (entry.ref?.startsWith('docs/archive/')) continue;
      const body = bodies.get(entry.id);
      if (!body) continue;
      const r = extractByLevel(body, 'purpose');
      if (r.text.length === 0) {
        withoutPurpose.push(entry.id);
      }
    }

    expect(withoutPurpose, `^purpose 없는 문서: ${withoutPurpose.join(', ')}`).toEqual([]);
  });
});
