/**
 * PositionEngine — VersionLifecycleStore 계약 테스트
 * 버전 상태 전이 (draft→released→active→deprecated)
 * + DeactivationMode (strict/flexible) 상속
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { VersionLifecycleStore } from "./version-lifecycle.js";
import { InMemoryVersionLifecycleStore } from "./adapters/memory-version-lifecycle.js";
import { NodeSqliteDriver } from "./adapters/node-sqlite-driver.js";
import { SqlVersionLifecycleStore } from "./adapters/sql-version-lifecycle-store.js";

function versionLifecycleSuite(
  name: string,
  factory: () => VersionLifecycleStore,
) {
  describe(name, () => {
    let store: VersionLifecycleStore;

    beforeEach(() => {
      store = factory();
    });

    // ── createDraft ───────────────────────────────────────

    it("draft 생성", async () => {
      const rec = await store.createDraft("role", "v2", "v1", 16);
      expect(rec.prefix).toBe("role");
      expect(rec.versionId).toBe("v2");
      expect(rec.status).toBe("draft");
      expect(rec.baseVersionId).toBe("v1");
      expect(rec.capacity).toBe(16);
      expect(rec.releasedAt).toBeNull();
    });

    it("중복 versionId 거부", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await expect(store.createDraft("role", "v1", "v0", 8)).rejects.toThrow(/already exists/);
    });

    // ── release ───────────────────────────────────────────

    it("draft → released", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await store.release("role", "v1");
      const record = await store.getVersion("role", "v1");
      expect(record!.status).toBe("released");
      expect(record!.releasedAt).not.toBeNull();
    });

    it("released 상태에서 release 불가", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await store.release("role", "v1");
      await expect(store.release("role", "v1")).rejects.toThrow(/expected "draft"/);
    });

    // ── activate ──────────────────────────────────────────

    it("released → active, 기존 active → released", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await store.release("role", "v1");
      await store.activate("role", "v1");
      expect((await store.getActive("role"))!.versionId).toBe("v1");

      await store.createDraft("role", "v2", "v1", 16);
      await store.release("role", "v2");
      await store.activate("role", "v2");

      expect((await store.getActive("role"))!.versionId).toBe("v2");
      expect((await store.getVersion("role", "v1"))!.status).toBe("released");
    });

    it("draft 상태에서 activate 불가", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await expect(store.activate("role", "v1")).rejects.toThrow(/expected "released"/);
    });

    // ── deprecate ─────────────────────────────────────────

    it("active → deprecated", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await store.release("role", "v1");
      await store.activate("role", "v1");
      await store.deprecate("role", "v1");
      expect((await store.getVersion("role", "v1"))!.status).toBe("deprecated");
    });

    it("draft 상태에서 deprecate 불가", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await expect(store.deprecate("role", "v1")).rejects.toThrow(/draft/);
    });

    // ── getVersions ───────────────────────────────────────

    it("상태별 필터", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await store.release("role", "v1");
      await store.activate("role", "v1");
      await store.createDraft("role", "v2", "v1", 16);

      expect(await store.getVersions("role", "draft")).toHaveLength(1);
      expect(await store.getVersions("role", "active")).toHaveLength(1);
      expect(await store.getVersions("role")).toHaveLength(2);
    });

    it("존재하지 않는 prefix는 빈 배열", async () => {
      expect(await store.getVersions("nope")).toEqual([]);
      expect(await store.getActive("nope")).toBeNull();
    });

    // ── getVersion ────────────────────────────────────────

    it("존재하지 않는 version은 null", async () => {
      expect(await store.getVersion("role", "v999")).toBeNull();
    });

    // ── prefix 격리 ──────────────────────────────────────

    it("서로 다른 prefix는 독립적", async () => {
      await store.createDraft("role", "v1", "v0", 8);
      await store.createDraft("perm", "v1", "v0", 32);
      await store.release("role", "v1");
      await store.activate("role", "v1");

      expect((await store.getActive("role"))!.versionId).toBe("v1");
      expect(await store.getActive("perm")).toBeNull();
      expect((await store.getVersion("perm", "v1"))!.status).toBe("draft");
    });

    // ── DeactivationMode ─────────────────────────────────

    it("기본 deactivationMode는 strict", async () => {
      const rec = await store.createDraft("role", "v1", null, 8);
      expect(rec.deactivationMode).toBe("strict");
    });

    it("최초 버전에서 flexible 모드 지정", async () => {
      const rec = await store.createDraft("flag", "v1", null, 16, "flexible");
      expect(rec.deactivationMode).toBe("flexible");
    });

    it("기반 버전에서 모드 상속", async () => {
      await store.createDraft("flag", "v1", null, 16, "flexible");
      const v2 = await store.createDraft("flag", "v2", "v1", 32);
      expect(v2.deactivationMode).toBe("flexible");
    });

    it("기반 버전 없이 모드 미지정 시 strict", async () => {
      const rec = await store.createDraft("role", "v1", null, 8);
      expect(rec.deactivationMode).toBe("strict");
    });

    it("서로 다른 prefix는 서로 다른 모드 가능", async () => {
      await store.createDraft("role", "v1", null, 8, "strict");
      await store.createDraft("flag", "v1", null, 16, "flexible");

      expect((await store.getVersion("role", "v1"))!.deactivationMode).toBe("strict");
      expect((await store.getVersion("flag", "v1"))!.deactivationMode).toBe("flexible");
    });
  });
}

versionLifecycleSuite("InMemoryVersionLifecycleStore", () => {
  return new InMemoryVersionLifecycleStore();
});

versionLifecycleSuite("SqlVersionLifecycleStore", () => {
  const driver = new NodeSqliteDriver();
  return new SqlVersionLifecycleStore(driver);
});
