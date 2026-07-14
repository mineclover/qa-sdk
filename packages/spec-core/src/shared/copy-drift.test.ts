// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * 복사본 드리프트 방지 — 물리 분할로 인한 복사본이 원본과 동기화되는지 검증.
 *
 * convergence는 독립 패키지이므로 dkg에 직접 의존 불가 (순환).
 * decision-scaffold.ts와 dkg-types.ts는 복사본을 유지하되,
 * 이 테스트가 구조적 동기화를 검증한다.
 *
 * GraphPort는 spec-schema에서 직접 import하므로 드리프트 검사 불필요.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DKG = resolve(import.meta.dirname, '../../../dkg/src');
const CONVERGENCE = resolve(import.meta.dirname, '../../../convergence/src');

describe('convergence 복사본 드리프트 방지', () => {
  it('decision-scaffold 함수 시그니처가 동기화되어 있다', () => {
    const dkgFile = readFileSync(resolve(DKG, 'decision-scaffold.ts'), 'utf-8');
    const convFile = readFileSync(resolve(CONVERGENCE, 'decision-scaffold.ts'), 'utf-8');

    // export function 시그니처 추출
    const extractExports = (content: string) =>
      content
        .split('\n')
        .filter((l) => l.startsWith('export function') || l.startsWith('export interface'))
        .map((l) => l.trim());

    const dkgExports = extractExports(dkgFile);
    const convExports = extractExports(convFile);

    expect(dkgExports.length).toBeGreaterThan(0);
    expect(convExports).toEqual(dkgExports);
  });

  it('DkgNodePort 기본 형태가 서비스 포트와 호환된다', () => {
    // convergence의 dkg-types.ts에서 DecisionNode 형태 확인
    const convTypes = readFileSync(resolve(CONVERGENCE, 'dkg-types.ts'), 'utf-8');

    // 최소 필수 타입이 존재하는지
    expect(convTypes).toContain('DecisionNode');
    expect(convTypes).toContain('ObservationNode');
    expect(convTypes).toContain('ConstraintNode');
    expect(convTypes).toMatch(/kind:\s*['"]decision['"]/);
    expect(convTypes).toMatch(/kind:\s*['"]observation['"]/);
    expect(convTypes).toMatch(/kind:\s*['"]constraint['"]/);
  });
});
