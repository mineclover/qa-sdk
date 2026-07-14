// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PositionEngine — MigrationStore 계약 테스트
 * 버전 간 변경 이력 (EntityId 수정, 비활성화) + 체이닝
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMigrationStore } from './adapters/memory-migration-store.js';
import { NodeSqliteDriver } from './adapters/node-sqlite-driver.js';
import { SqlMigrationStore } from './adapters/sql-migration-store.js';
import type { MigrationStore, MigrationMapping } from './migration-store.js';

function mapping(
  overrides: Partial<MigrationMapping> &
    Pick<MigrationMapping, 'fromVersionId' | 'toVersionId' | 'position' | 'changeType'>,
): MigrationMapping {
  return {
    oldEntityId: null,
    newEntityId: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function migrationStoreSuite(name: string, factory: () => MigrationStore) {
  describe(name, () => {
    let store: MigrationStore;

    beforeEach(() => {
      store = factory();
    });

    // ── saveMappings + getMappings ────────────────────────

    it('매핑 저장 및 조회', async () => {
      const mappings = [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'member',
        }),
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 5,
          changeType: 'deactivated',
        }),
      ];
      await store.saveMappings('role', mappings);

      const result = await store.getMappings('role', 'v1', 'v2');
      expect(result).toHaveLength(2);
      expect(result[0]!.position).toBe(3);
      expect(result[1]!.position).toBe(5);
    });

    it('중복 매핑 저장 거부', async () => {
      const m = [
        mapping({ fromVersionId: 'v1', toVersionId: 'v2', position: 3, changeType: 'modified' }),
      ];
      await store.saveMappings('role', m);
      await expect(store.saveMappings('role', m)).rejects.toThrow();
    });

    it('서로 다른 prefix는 동일한 매핑 키를 재사용할 수 있고 조회도 분리된다', async () => {
      const roleMapping = [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'member',
        }),
      ];
      const permMapping = [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'allow',
          newEntityId: 'deny',
        }),
      ];

      await store.saveMappings('role', roleMapping);
      await store.saveMappings('perm', permMapping);

      expect(await store.getMappings('role', 'v1', 'v2')).toEqual(roleMapping);
      expect(await store.getMappings('perm', 'v1', 'v2')).toEqual(permMapping);
      expect(await store.getHistory('role', 3)).toEqual(roleMapping);
      expect(await store.getHistory('perm', 3)).toEqual(permMapping);
    });

    // ── getHistory ────────────────────────────────────────

    it('position별 변경 이력', async () => {
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'member',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ]);
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v2',
          toVersionId: 'v3',
          position: 3,
          changeType: 'deactivated',
          createdAt: '2026-02-01T00:00:00Z',
        }),
      ]);

      const history = await store.getHistory('role', 3);
      expect(history).toHaveLength(2);
      expect(history[0]!.fromVersionId).toBe('v1');
      expect(history[1]!.fromVersionId).toBe('v2');
    });

    it('변경 없는 position은 빈 이력', async () => {
      expect(await store.getHistory('role', 99)).toEqual([]);
    });

    // ── resolveToLatest ───────────────────────────────────

    it('체이닝: modified → modified', async () => {
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'member',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ]);
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v2',
          toVersionId: 'v3',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'member',
          newEntityId: 'contributor',
          createdAt: '2026-02-01T00:00:00Z',
        }),
      ]);

      const result = await store.resolveToLatest('role', 'v1', 3, 'v3');
      expect(result.currentVersionId).toBe('v3');
      expect(result.currentEntityId).toBe('contributor');
      expect(result.chain).toHaveLength(2);
    });

    it('체이닝: modified → deactivated', async () => {
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'member',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ]);
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v2',
          toVersionId: 'v3',
          position: 3,
          changeType: 'deactivated',
          createdAt: '2026-02-01T00:00:00Z',
        }),
      ]);

      const result = await store.resolveToLatest('role', 'v1', 3, 'v3');
      expect(result.currentEntityId).toBeNull();
      expect(result.chain).toHaveLength(2);
    });

    it('변경 없는 position은 경로만 따라가고 체인은 비어 있다', async () => {
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 5,
          changeType: 'deactivated',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ]);

      const result = await store.resolveToLatest('role', 'v1', 1, 'v2');
      expect(result.currentVersionId).toBe('v2');
      expect(result.chain).toHaveLength(0);
    });

    it('분기된 edge가 있어도 latestVersionId로 이어지는 경로를 선택한다', async () => {
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v1b',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'observer',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ]);
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'member',
          createdAt: '2026-01-02T00:00:00Z',
        }),
      ]);
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v2',
          toVersionId: 'v3',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'member',
          newEntityId: 'contributor',
          createdAt: '2026-01-03T00:00:00Z',
        }),
      ]);

      const result = await store.resolveToLatest('role', 'v1', 3, 'v3');
      expect(result.currentVersionId).toBe('v3');
      expect(result.currentEntityId).toBe('contributor');
      expect(result.chain.map((item) => item.toVersionId)).toEqual(['v2', 'v3']);
    });

    it('경로가 없으면 시작 버전과 빈 체인을 반환한다', async () => {
      await store.saveMappings('role', [
        mapping({
          fromVersionId: 'v1',
          toVersionId: 'v2',
          position: 3,
          changeType: 'modified',
          oldEntityId: 'viewer',
          newEntityId: 'member',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ]);

      const result = await store.resolveToLatest('role', 'v1', 3, 'v9');
      expect(result.currentVersionId).toBe('v1');
      expect(result.currentEntityId).toBeNull();
      expect(result.chain).toEqual([]);
    });

    // ── 이미 latest인 경우 ───────────────────────────────

    it('fromVersion === latestVersion → 빈 체인', async () => {
      const result = await store.resolveToLatest('role', 'v1', 3, 'v1');
      expect(result.currentVersionId).toBe('v1');
      expect(result.chain).toEqual([]);
    });
  });
}

migrationStoreSuite('InMemoryMigrationStore', () => {
  return new InMemoryMigrationStore();
});

migrationStoreSuite('SqlMigrationStore', () => {
  const driver = new NodeSqliteDriver();
  return new SqlMigrationStore(driver);
});
