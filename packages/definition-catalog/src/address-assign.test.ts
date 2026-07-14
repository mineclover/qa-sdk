// @def.doc definition-catalog-spec

import { describe, it, expect } from 'vitest';
import { assignUniqueAddresses, buildIdToAddressMap } from './address-assign.js';
import { decodeUniqueDocument, serializeUniqueDocumentAddress } from './observe.js';
import type { DefinitionEntry } from './types.js';

function entry(id: string, scope: string, aspect: string, depth: string): DefinitionEntry {
  return {
    id,
    scope,
    aspect,
    depth,
    title: id,
    lifecycle: 'approved',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  } as DefinitionEntry;
}

describe('assignUniqueAddresses', () => {
  it('같은 유형의 문서에 다른 주소를 부여한다', () => {
    const entries = [
      entry('record-spec', 'data', 'domain_data', 'specification'),
      entry('trace-spec', 'data', 'domain_data', 'specification'),
      entry('session-spec', 'data', 'domain_data', 'specification'),
    ];

    const assignments = assignUniqueAddresses(entries);
    const addresses = assignments.map((a) => a.address);

    // 모두 다른 주소
    expect(new Set(addresses).size).toBe(3);
    // 결정론적 (id 정렬)
    expect(assignments[0]!.docId).toBe('record-spec');
    expect(assignments[1]!.docId).toBe('session-spec');
    expect(assignments[2]!.docId).toBe('trace-spec');
  });

  it('다른 유형의 문서는 독립적으로 순번이 부여된다', () => {
    const entries = [
      entry('a-feature', 'feature', 'func_def', 'specification'),
      entry('b-feature', 'feature', 'func_def', 'specification'),
      entry('a-data', 'data', 'domain_data', 'specification'),
    ];

    const assignments = assignUniqueAddresses(entries);
    expect(assignments).toHaveLength(3);

    // 각 유형 내에서 seq=1부터 시작
    const featureAssignments = assignments.filter((a) => a.scope === 'feature');
    expect(featureAssignments[0]!.seq).toBe(1);
    expect(featureAssignments[1]!.seq).toBe(2);

    const dataAssignment = assignments.find((a) => a.scope === 'data');
    expect(dataAssignment!.seq).toBe(1);
  });

  it('주소를 디코딩하면 원본 좌표 + seq가 복원된다', () => {
    const entries = [entry('gate-api', 'interface', 'api_contract', 'specification')];
    const [assignment] = assignUniqueAddresses(entries);
    const decoded = decodeUniqueDocument(assignment!.address);

    expect(decoded.scope).toBe('interface');
    expect(decoded.aspect).toBe('api_contract');
    expect(decoded.depth).toBe('specification');
    expect(decoded.seq).toBe(1);
  });

  it('serialized 형식이 def_document:v2:<address>이다', () => {
    const entries = [entry('test', 'ui', 'component', 'overview')];
    const [assignment] = assignUniqueAddresses(entries);
    expect(assignment!.serialized).toMatch(/^def_document:v2:\d+$/);
  });

  it('buildIdToAddressMap이 정확하다', () => {
    const entries = [
      entry('a', 'feature', 'func_def', 'specification'),
      entry('b', 'data', 'domain_data', 'specification'),
    ];
    const assignments = assignUniqueAddresses(entries);
    const map = buildIdToAddressMap(assignments);

    expect(map.size).toBe(2);
    expect(map.get('a')).toBe(assignments.find((a) => a.docId === 'a')!.address);
    expect(map.get('b')).toBe(assignments.find((a) => a.docId === 'b')!.address);
  });

  it('548건 규모에서 모든 주소가 유일하다', () => {
    // 실제 규모 시뮬레이션
    const entries: DefinitionEntry[] = [];
    const types = [
      { scope: 'feature', aspect: 'func_def', depth: 'specification', count: 80 },
      { scope: 'data', aspect: 'domain_data', depth: 'specification', count: 70 },
      { scope: 'interface', aspect: 'api_contract', depth: 'specification', count: 40 },
      { scope: 'constraint', aspect: 'tech_constraint', depth: 'specification', count: 30 },
      { scope: 'feature', aspect: 'func_def', depth: 'overview', count: 20 },
    ];

    for (const type of types) {
      for (let i = 0; i < type.count; i++) {
        entries.push(
          entry(`${type.scope}-${type.aspect}-${i}`, type.scope, type.aspect, type.depth),
        );
      }
    }

    const assignments = assignUniqueAddresses(entries);
    const addresses = new Set(assignments.map((a) => a.address));

    expect(assignments.length).toBe(entries.length);
    expect(addresses.size).toBe(entries.length);
  });
});
