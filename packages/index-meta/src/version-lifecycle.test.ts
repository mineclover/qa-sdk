/**
 * PositionEngine — VersionLifecycleStore 테스트
 * 버전 상태 전이 (EntryLifecycle: draft→released→active→deprecated)
 * + DeactivationMode (strict/flexible) 상속
 */
import { describe, it, expect } from "vitest";
import { InMemoryVersionLifecycleStore } from "./adapters/memory-version-lifecycle.js";

describe("PositionEngine: VersionLifecycleStore", () => {
  function create() {
    return new InMemoryVersionLifecycleStore();
  }

  // ── createDraft ─────────────────────────────────────────

  it("draft 생성", async () => {
    const s = create();
    const rec = await s.createDraft("role", "v2", "v1", 16);
    expect(rec.prefix).toBe("role");
    expect(rec.versionId).toBe("v2");
    expect(rec.status).toBe("draft");
    expect(rec.baseVersionId).toBe("v1");
    expect(rec.capacity).toBe(16);
    expect(rec.releasedAt).toBeNull();
  });

  it("중복 versionId 거부", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await expect(s.createDraft("role", "v1", "v0", 8)).rejects.toThrow(/already exists/);
  });

  // ── release ─────────────────────────────────────────────

  it("draft → released", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await s.release("role", "v1");
    const r = await s.getVersion("role", "v1");
    expect(r!.status).toBe("released");
    expect(r!.releasedAt).not.toBeNull();
  });

  it("released 상태에서 release 불가", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await s.release("role", "v1");
    await expect(s.release("role", "v1")).rejects.toThrow(/expected "draft"/);
  });

  // ── activate ────────────────────────────────────────────

  it("released → active, 기존 active → released", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await s.release("role", "v1");
    await s.activate("role", "v1");
    expect((await s.getActive("role"))!.versionId).toBe("v1");

    // v2 draft → released → active: v1이 released로 강등
    await s.createDraft("role", "v2", "v1", 16);
    await s.release("role", "v2");
    await s.activate("role", "v2");

    expect((await s.getActive("role"))!.versionId).toBe("v2");
    expect((await s.getVersion("role", "v1"))!.status).toBe("released");
  });

  it("draft 상태에서 activate 불가", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await expect(s.activate("role", "v1")).rejects.toThrow(/expected "released"/);
  });

  // ── deprecate ───────────────────────────────────────────

  it("active → deprecated", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await s.release("role", "v1");
    await s.activate("role", "v1");
    await s.deprecate("role", "v1");
    expect((await s.getVersion("role", "v1"))!.status).toBe("deprecated");
  });

  it("draft 상태에서 deprecate 불가", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await expect(s.deprecate("role", "v1")).rejects.toThrow(/draft/);
  });

  // ── getVersions ─────────────────────────────────────────

  it("상태별 필터", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await s.release("role", "v1");
    await s.activate("role", "v1");
    await s.createDraft("role", "v2", "v1", 16);

    expect(await s.getVersions("role", "draft")).toHaveLength(1);
    expect(await s.getVersions("role", "active")).toHaveLength(1);
    expect(await s.getVersions("role")).toHaveLength(2);
  });

  it("존재하지 않는 prefix는 빈 배열", async () => {
    const s = create();
    expect(await s.getVersions("nope")).toEqual([]);
    expect(await s.getActive("nope")).toBeNull();
  });

  // ── getVersion ──────────────────────────────────────────

  it("존재하지 않는 version은 null", async () => {
    const s = create();
    expect(await s.getVersion("role", "v999")).toBeNull();
  });

  // ── prefix 격리 ────────────────────────────────────────

  it("서로 다른 prefix는 독립적", async () => {
    const s = create();
    await s.createDraft("role", "v1", "v0", 8);
    await s.createDraft("perm", "v1", "v0", 32);
    await s.release("role", "v1");
    await s.activate("role", "v1");

    expect((await s.getActive("role"))!.versionId).toBe("v1");
    expect(await s.getActive("perm")).toBeNull();
    expect((await s.getVersion("perm", "v1"))!.status).toBe("draft");
  });

  // ── DeactivationMode ──────────────────────────────────

  it("기본 deactivationMode는 strict", async () => {
    const s = create();
    const rec = await s.createDraft("role", "v1", null, 8);
    expect(rec.deactivationMode).toBe("strict");
  });

  it("최초 버전에서 flexible 모드 지정", async () => {
    const s = create();
    const rec = await s.createDraft("flag", "v1", null, 16, "flexible");
    expect(rec.deactivationMode).toBe("flexible");
  });

  it("기반 버전에서 모드 상속", async () => {
    const s = create();
    await s.createDraft("flag", "v1", null, 16, "flexible");
    const v2 = await s.createDraft("flag", "v2", "v1", 32);
    expect(v2.deactivationMode).toBe("flexible");
  });

  it("기반 버전 없이 모드 미지정 시 strict", async () => {
    const s = create();
    const rec = await s.createDraft("role", "v1", null, 8);
    expect(rec.deactivationMode).toBe("strict");
  });

  it("서로 다른 prefix는 서로 다른 모드 가능", async () => {
    const s = create();
    await s.createDraft("role", "v1", null, 8, "strict");
    await s.createDraft("flag", "v1", null, 16, "flexible");

    expect((await s.getVersion("role", "v1"))!.deactivationMode).toBe("strict");
    expect((await s.getVersion("flag", "v1"))!.deactivationMode).toBe("flexible");
  });
});
