import type { PrefixRegistry, DimRef, VersionLifecycleStore, VersionRecord } from "index-meta";
import { calcWeights } from "weighted-index";
import type { PrefixOwnerStore } from "../stores/prefix-owner-store.js";
import type { DraftLockStore } from "../stores/draft-lock-store.js";
import type {
  DraftLock,
  ExtendedVersionRecord,
  ExtendedVersionStatus,
  PrefixOwnerRecord,
} from "../types/index.js";
import {
  AppError,
  prefixNotFound,
  versionNotFound,
  invalidTransition,
  draftLocked,
  refNotFound,
  circularRef,
  notReady,
  overflow,
  duplicatePrefix,
} from "./errors.js";
import { analyze } from "./draft-workspace.js";

export interface RegistryServiceDeps {
  prefixRegistry: PrefixRegistry;
  versionStore: VersionLifecycleStore;
  ownerStore: PrefixOwnerStore;
  lockStore: DraftLockStore;
}

/**
 * ## Capacity SSOT (Single Source of Truth)
 *
 * `prefixRegistry` is the authoritative source for capacity values.
 * `versionStore.capacity` may lag behind after operations like `patchDraft()`
 * that update prefixRegistry without propagating back to versionStore.
 *
 * Write order convention: **versionStore first, then prefixRegistry**.
 * This ensures prefixRegistry always holds the latest committed value.
 * Read paths (e.g. `getVersion()`, `getAllDrafts()`) reconcile by
 * preferring `prefixRegistry.getCapacity()` over `versionStore` capacity.
 */
export class RegistryService {
  readonly prefixRegistry: PrefixRegistry;
  readonly versionStore: VersionLifecycleStore;
  readonly ownerStore: PrefixOwnerStore;
  readonly lockStore: DraftLockStore;

  constructor(deps: RegistryServiceDeps) {
    this.prefixRegistry = deps.prefixRegistry;
    this.versionStore = deps.versionStore;
    this.ownerStore = deps.ownerStore;
    this.lockStore = deps.lockStore;
  }

  // ── Prefix CRUD ───────────────────────────────────────────

  async registerPrefix(input: {
    prefix: string;
    owner: string;
    kind: "leaf" | "composite";
    numberType: "number" | "bigint";
  }): Promise<PrefixOwnerRecord> {
    const existing = await this.ownerStore.get(input.prefix);
    if (existing) throw duplicatePrefix(input.prefix);

    const record: PrefixOwnerRecord = {
      prefix: input.prefix,
      owner: input.owner,
      kind: input.kind,
      numberType: input.numberType,
      createdAt: new Date().toISOString(),
    };
    await this.ownerStore.register(record);
    return record;
  }

  async getPrefix(prefix: string): Promise<PrefixOwnerRecord> {
    const record = await this.ownerStore.get(prefix);
    if (!record) throw prefixNotFound(prefix);
    return record;
  }

  async listPrefixes(): Promise<PrefixOwnerRecord[]> {
    return this.ownerStore.list();
  }

  async deletePrefix(prefix: string): Promise<void> {
    const record = await this.ownerStore.get(prefix);
    if (!record) throw prefixNotFound(prefix);

    const versions = await this.versionStore.getVersions(prefix);
    const nonDeprecated = versions.filter((v) => v.status !== "deprecated");
    if (nonDeprecated.length > 0) {
      throw invalidTransition(
        `Cannot delete prefix '${prefix}': has ${nonDeprecated.length} non-deprecated version(s)`,
      );
    }

    await this.ownerStore.delete(prefix);
  }

  // ── Version CRUD ──────────────────────────────────────────

  async createDraft(input: {
    prefix: string;
    versionId: string;
    baseVersionId: string | null;
    capacity: number;
    deactivationMode?: "strict" | "flexible";
    refs?: { prefix: string; versionId: string }[];
  }): Promise<ExtendedVersionRecord> {
    const owner = await this.getPrefix(input.prefix);

    // composite refs 검증 + capacity 결정
    let dimRefs: DimRef[] | undefined;
    let finalCapacity = input.capacity;

    if (input.refs && input.refs.length > 0) {
      // 순환참조 검증
      await this.checkCircularRef(input.prefix, input.refs);

      dimRefs = [];
      for (const ref of input.refs) {
        const refOwner = await this.ownerStore.get(ref.prefix);
        if (!refOwner) throw refNotFound(ref.prefix, ref.versionId);

        // draft 상태의 capacity를 version store에서 조회
        const refVersion = await this.versionStore.getVersion(ref.prefix, ref.versionId);
        let refCapacity: number;
        if (refVersion) {
          refCapacity = refVersion.capacity;
        } else {
          // prefix registry에서 조회
          const cap = await this.prefixRegistry.getCapacity(ref.prefix, ref.versionId);
          if (cap === null) throw refNotFound(ref.prefix, ref.versionId);
          refCapacity = cap;
        }

        dimRefs.push({ prefix: ref.prefix, versionId: ref.versionId, capacity: refCapacity });
      }
      // composite capacity = product of ref capacities
      finalCapacity = dimRefs.reduce((acc, r) => acc * r.capacity, 1);
    }

    // Write order: versionStore first → prefixRegistry second.
    // prefixRegistry is the capacity SSOT; writing it last ensures it
    // always reflects the most recent value.
    const versionRecord = await this.versionStore.createDraft(
      input.prefix,
      input.versionId,
      input.baseVersionId,
      finalCapacity,
      input.deactivationMode,
    );

    await this.prefixRegistry.register({
      prefix: input.prefix,
      versionId: input.versionId,
      capacity: finalCapacity,
      ...(dimRefs ? { refs: dimRefs } : {}),
    });

    return this.toExtendedVersion(versionRecord, dimRefs);
  }

  async patchDraft(
    prefix: string,
    versionId: string,
    patch: { capacity?: number; refs?: { prefix: string; versionId: string }[] },
  ): Promise<ExtendedVersionRecord> {
    const version = await this.versionStore.getVersion(prefix, versionId);
    if (!version) throw versionNotFound(prefix, versionId);
    if (version.status !== "draft") {
      throw invalidTransition(`Cannot modify: version '${versionId}' is '${version.status}'`);
    }
    if (await this.isLocked(prefix, versionId)) {
      throw draftLocked(prefix, versionId);
    }

    let dimRefs: DimRef[] | undefined;
    let newCapacity = patch.capacity ?? version.capacity;

    if (patch.refs) {
      // 순환참조 검증
      await this.checkCircularRef(prefix, patch.refs);

      dimRefs = [];
      for (const ref of patch.refs) {
        const refVersion = await this.versionStore.getVersion(ref.prefix, ref.versionId);
        let refCapacity: number;
        if (refVersion) {
          refCapacity = refVersion.capacity;
        } else {
          const cap = await this.prefixRegistry.getCapacity(ref.prefix, ref.versionId);
          if (cap === null) throw refNotFound(ref.prefix, ref.versionId);
          refCapacity = cap;
        }
        dimRefs.push({ prefix: ref.prefix, versionId: ref.versionId, capacity: refCapacity });
      }
      newCapacity = dimRefs.reduce((acc, r) => acc * r.capacity, 1);
    }

    // Write order: versionStore first → prefixRegistry second.
    // prefixRegistry is the capacity SSOT; writing it last ensures it
    // always reflects the most recent value.
    // Note: versionStore has no dedicated updateCapacity method, so the
    // in-memory record is constructed manually below. The authoritative
    // capacity is persisted in prefixRegistry.
    await this.prefixRegistry.updateCapacity(prefix, versionId, newCapacity, dimRefs);

    const updatedVersion: VersionRecord = { ...version, capacity: newCapacity };
    return this.toExtendedVersion(updatedVersion, dimRefs);
  }

  async getVersion(prefix: string, versionId: string): Promise<ExtendedVersionRecord> {
    const version = await this.versionStore.getVersion(prefix, versionId);
    if (!version) throw versionNotFound(prefix, versionId);

    // ── Capacity reconciliation ──────────────────────────────
    // prefixRegistry is the SSOT for capacity. versionStore.capacity may
    // lag behind because patchDraft() updates prefixRegistry but
    // VersionLifecycleStore has no updateCapacity method to propagate
    // the change. Reconcile here by preferring prefixRegistry's value.
    const registryCap = await this.prefixRegistry.getCapacity(prefix, versionId);
    const corrected = registryCap !== null && registryCap !== version.capacity
      ? { ...version, capacity: registryCap }
      : version;

    const deps = await this.prefixRegistry.getDeps(prefix, versionId);
    const dimRefs = deps.length > 0 ? [...deps] : undefined;

    return this.toExtendedVersion(corrected, dimRefs);
  }

  async listVersions(
    prefix: string,
    status?: ExtendedVersionStatus,
  ): Promise<ExtendedVersionRecord[]> {
    await this.getPrefix(prefix); // 존재 확인

    // locked는 서비스 레이어 개념 → draft + lock 필터
    const libStatus = status === "locked" ? "draft" : status;
    const versions = await this.versionStore.getVersions(prefix, libStatus);

    const results: ExtendedVersionRecord[] = [];
    for (const v of versions) {
      const deps = await this.prefixRegistry.getDeps(prefix, v.versionId);
      const dimRefs = deps.length > 0 ? [...deps] : undefined;
      const ext = await this.toExtendedVersion(v, dimRefs);

      // locked 필터: status=locked → locked만 반환
      if (status === "locked" && ext.status !== "locked") continue;
      // draft 필터에서 locked 제외
      if (status === "draft" && ext.status === "locked") continue;

      results.push(ext);
    }
    return results;
  }

  // ── Lifecycle transitions ─────────────────────────────────

  async lockDraft(prefix: string, versionId: string): Promise<void> {
    const version = await this.versionStore.getVersion(prefix, versionId);
    if (!version) throw versionNotFound(prefix, versionId);
    if (version.status !== "draft") {
      throw invalidTransition(`Cannot lock: version '${versionId}' is '${version.status}'`);
    }
    if (await this.isLocked(prefix, versionId)) {
      throw invalidTransition(`Version '${versionId}' is already locked`);
    }

    await this.lockStore.acquire({
      prefix,
      versionId,
      lockedAt: new Date().toISOString(),
    });
  }

  async unlockDraft(prefix: string, versionId: string): Promise<void> {
    const version = await this.versionStore.getVersion(prefix, versionId);
    if (!version) throw versionNotFound(prefix, versionId);
    if (!(await this.isLocked(prefix, versionId))) {
      throw invalidTransition(`Version '${versionId}' is not locked`);
    }
    await this.lockStore.release(prefix, versionId);
  }

  async release(prefix: string, versionId: string): Promise<void> {
    const version = await this.versionStore.getVersion(prefix, versionId);
    if (!version) throw versionNotFound(prefix, versionId);

    // locked → released (서비스 레이어에서 lock 해제 후 library release 호출)
    if (await this.isLocked(prefix, versionId)) {
      await this.lockStore.release(prefix, versionId);
    } else if (version.status !== "draft") {
      throw invalidTransition(
        `Cannot release: version '${versionId}' is '${version.status}', expected 'draft' or 'locked'`,
      );
    }

    // 경량 overflow 체크 (composite만)
    const owner = await this.ownerStore.get(prefix);
    if (owner?.kind === "composite" && owner.numberType === "number") {
      const deps = await this.prefixRegistry.getDeps(prefix, versionId);
      if (deps.length > 0) {
        const product = deps.reduce((acc, d) => acc * d.capacity, 1);
        if (product > Number.MAX_SAFE_INTEGER) {
          throw overflow(
            `Cannot release '${prefix}/${versionId}': product ${product} exceeds Number.MAX_SAFE_INTEGER`,
          );
        }
      }
    }

    await this.versionStore.release(prefix, versionId);
  }

  async activate(prefix: string, versionId: string): Promise<void> {
    const version = await this.versionStore.getVersion(prefix, versionId);
    if (!version) throw versionNotFound(prefix, versionId);
    await this.versionStore.activate(prefix, versionId);
  }

  async deprecate(prefix: string, versionId: string): Promise<void> {
    const version = await this.versionStore.getVersion(prefix, versionId);
    if (!version) throw versionNotFound(prefix, versionId);
    await this.versionStore.deprecate(prefix, versionId);
  }

  // ── Lock-all / Release-all ────────────────────────────────

  async lockAll(): Promise<{ locked: string[] }> {
    const prefixes = await this.ownerStore.list();
    const locked: string[] = [];

    for (const p of prefixes) {
      const drafts = await this.versionStore.getVersions(p.prefix, "draft");
      for (const d of drafts) {
        if (!(await this.isLocked(d.prefix, d.versionId))) {
          await this.lockDraft(d.prefix, d.versionId);
          locked.push(`${d.prefix}/${d.versionId}`);
        }
      }
    }
    return { locked };
  }

  async releaseAll(): Promise<{ released: string[] }> {
    // Readiness gate: analyze 실행 후 ready: false면 차단
    const analysis = await analyze(
      this.prefixRegistry,
      this.versionStore,
      this.ownerStore,
      (p, v) => this.isLocked(p, v),
    );
    if (!analysis.ready) {
      const errors = analysis.diagnostics
        .filter((d) => d.level === "error")
        .map((e) => e.message);
      throw notReady(`Release blocked: ${errors.join("; ")}`);
    }

    // 위상정렬 순서로 release (leaf 먼저)
    const order = await this.computeReleaseOrder();
    const released: string[] = [];

    for (const prefix of order) {
      const drafts = await this.versionStore.getVersions(prefix, "draft");
      for (const d of drafts) {
        await this.release(d.prefix, d.versionId);
        released.push(`${d.prefix}/${d.versionId}`);
      }
    }
    return { released };
  }

  // ── DAG ───────────────────────────────────────────────────

  async getDeps(prefix: string, versionId: string): Promise<readonly DimRef[]> {
    return this.prefixRegistry.getDeps(prefix, versionId);
  }

  async getTransitiveDeps(prefix: string, versionId: string): Promise<readonly DimRef[]> {
    return this.prefixRegistry.getTransitiveDeps(prefix, versionId);
  }

  async getReverseRefs(prefix: string, versionId: string): Promise<readonly import("index-meta").PrefixRegistryRecord[]> {
    return this.prefixRegistry.getReverseRefs(prefix, versionId);
  }

  async getDagGraph(): Promise<{
    nodes: { prefix: string; versionId: string; capacity: number; kind: string }[];
    edges: { from: string; to: string }[];
  }> {
    const allRecords = await this.prefixRegistry.listAll();
    const owners = await this.ownerStore.list();
    const ownerMap = new Map(owners.map((o) => [o.prefix, o]));

    const nodes = allRecords.map((r) => ({
      prefix: r.prefix,
      versionId: r.versionId,
      capacity: r.capacity,
      kind: ownerMap.get(r.prefix)?.kind ?? "leaf",
    }));

    const edges: { from: string; to: string }[] = [];
    for (const r of allRecords) {
      if (r.refs) {
        for (const ref of r.refs) {
          edges.push({
            from: `${r.prefix}:${r.versionId}`,
            to: `${ref.prefix}:${ref.versionId}`,
          });
        }
      }
    }
    return { nodes, edges };
  }

  // ── Resolve ───────────────────────────────────────────────

  async getActiveEnriched(prefix: string): Promise<{
    versionId: string;
    capacity: number;
    numberType: string;
    shape?: number[];
    stride?: number[];
  } | null> {
    const active = await this.versionStore.getActive(prefix);
    if (!active) return null;

    const owner = await this.ownerStore.get(prefix);
    const shape = await this.prefixRegistry.getShape(prefix, active.versionId);
    const stride = shape ? calcWeights(shape) : undefined;

    return {
      versionId: active.versionId,
      capacity: active.capacity,
      numberType: owner?.numberType ?? "number",
      ...(shape && shape.length > 1 ? { shape, stride } : {}),
    };
  }

  async resolveAllActive(): Promise<
    Record<
      string,
      {
        versionId: string;
        capacity: number;
        numberType: string;
        shape?: number[];
        stride?: number[];
      }
    >
  > {
    const prefixes = await this.ownerStore.list();
    const result: Record<string, any> = {};

    for (const p of prefixes) {
      const active = await this.versionStore.getActive(p.prefix);
      if (!active) continue;

      const shape = await this.prefixRegistry.getShape(p.prefix, active.versionId);
      const stride = shape ? calcWeights(shape) : undefined;

      result[p.prefix] = {
        versionId: active.versionId,
        capacity: active.capacity,
        numberType: p.numberType,
        ...(shape && shape.length > 1 ? { shape, stride } : {}),
      };
    }
    return result;
  }

  async resolveManifest(): Promise<{
    versions: Record<string, any>;
    generatedAt: string;
  }> {
    const versions = await this.resolveAllActive();
    return {
      versions,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Inspect (3-level prefix version query) ─────────────

  /**
   * Level 1 — 메타만 조회.
   * prefix:v의 dims, capacity, stride, snapshotSupply, status, kind.
   */
  async inspectMeta(prefix: string, versionId: string): Promise<{
    prefix: string;
    versionId: string;
    kind: string;
    status: string;
    numberType: string;
    capacity: number;
    dims: string[];
    shape: number[] | null;
    stride: number[] | null;
    product: number | null;
  }> {
    const owner = await this.ownerStore.get(prefix);
    if (!owner) throw prefixNotFound(prefix);

    const ver = await this.versionStore.getVersion(prefix, versionId);
    if (!ver) throw versionNotFound(prefix, versionId);

    const shape = await this.prefixRegistry.getShape(prefix, versionId);
    const stride = shape ? calcWeights(shape) : null;
    const product = shape ? shape.reduce((a, b) => a * b, 1) : null;
    const deps = await this.prefixRegistry.getDeps(prefix, versionId);
    const dims = deps.map((d) => d.prefix);

    return {
      prefix,
      versionId,
      kind: owner.kind,
      status: ver.status,
      numberType: owner.numberType,
      capacity: ver.capacity,
      dims: owner.kind === "composite" ? dims : [prefix],
      shape,
      stride,
      product,
    };
  }

  /**
   * Level 2 — 인덱스 키 조회.
   * 메타 + 유효 주소 범위 [min, max] + 축별 entry 개수.
   */
  async inspectKeys(prefix: string, versionId: string): Promise<{
    meta: Awaited<ReturnType<RegistryService["inspectMeta"]>>;
    addressRange: { min: number; max: number } | null;
    dimEntries: { dim: string; entryCount: number; capacity: number }[];
  }> {
    const meta = await this.inspectMeta(prefix, versionId);
    const deps = await this.prefixRegistry.getDeps(prefix, versionId);

    const dimEntries: { dim: string; entryCount: number; capacity: number }[] = [];
    for (const dep of deps) {
      const depVer = await this.versionStore.getVersion(dep.prefix, dep.versionId);
      dimEntries.push({
        dim: dep.prefix,
        entryCount: 0, // IndexMetaStore.getEntries가 있으면 실제 개수
        capacity: dep.capacity,
      });
    }

    // leaf prefix: 주소 범위 = [0, capacity-1]
    // composite: 주소 범위 = [0, product-1]
    const addressRange = meta.product !== null
      ? { min: 0, max: meta.product - 1 }
      : meta.capacity > 0
        ? { min: 0, max: meta.capacity - 1 }
        : null;

    return { meta, addressRange, dimEntries };
  }

  /**
   * Level 3 — 인덱스 밸류 조회.
   * 메타 + 키 + 특정 주소의 디코드 결과 (좌표 + dims 매핑).
   */
  async inspectValue(prefix: string, versionId: string, address: number): Promise<{
    meta: Awaited<ReturnType<RegistryService["inspectMeta"]>>;
    address: number;
    coords: number[];
    decoded: { dim: string; position: number; capacity: number }[];
  }> {
    const meta = await this.inspectMeta(prefix, versionId);

    if (!meta.shape || !meta.stride) {
      // leaf prefix: 주소가 곧 position
      return {
        meta,
        address,
        coords: [address],
        decoded: [{ dim: prefix, position: address, capacity: meta.capacity }],
      };
    }

    // composite: stride 기반 디코드
    const shape = meta.shape;
    const stride = meta.stride;
    const coords: number[] = [];
    let remaining = address;

    for (let i = 0; i < shape.length; i++) {
      coords.push(Math.floor(remaining / stride[i]));
      remaining = remaining % stride[i];
    }

    const deps = await this.prefixRegistry.getDeps(prefix, versionId);
    const decoded = deps.map((dep, i) => ({
      dim: dep.prefix,
      position: coords[i],
      capacity: dep.capacity,
    }));

    return { meta, address, coords, decoded };
  }

  // ── Schema Diff ─────────────────────────────────────────

  async diffVersions(fromVersionId: string, toVersionId: string): Promise<{
    from: string;
    to: string;
    diffs: {
      prefix: string;
      kind: string;
      from: { capacity: number; shape: number[] | null; stride: number[] | null } | null;
      to: { capacity: number; shape: number[] | null; stride: number[] | null } | null;
      capacityChanged: boolean;
      strideChanged: boolean;
      migrationRequired: boolean;
      status: "added" | "removed" | "changed";
    }[];
    migrationRequired: boolean;
  }> {
    const prefixes = await this.ownerStore.list();
    const diffs: any[] = [];

    for (const p of prefixes) {
      let fromCap: number | null = null;
      let toCap: number | null = null;
      let fromShape: number[] | null = null;
      let toShape: number[] | null = null;

      const fromVer = await this.versionStore.getVersion(p.prefix, fromVersionId);
      if (fromVer) {
        fromCap = (await this.prefixRegistry.getCapacity(p.prefix, fromVersionId)) ?? fromVer.capacity;
        if (p.kind === "composite") {
          fromShape = (await this.prefixRegistry.getShape(p.prefix, fromVersionId)) ?? null;
        }
      }

      const toVer = await this.versionStore.getVersion(p.prefix, toVersionId);
      if (toVer) {
        toCap = (await this.prefixRegistry.getCapacity(p.prefix, toVersionId)) ?? toVer.capacity;
        if (p.kind === "composite") {
          toShape = (await this.prefixRegistry.getShape(p.prefix, toVersionId)) ?? null;
        }
      }

      if (fromCap === null && toCap === null) continue;

      const fromStride = fromShape ? calcWeights(fromShape) : null;
      const toStride = toShape ? calcWeights(toShape) : null;

      const capacityChanged = fromCap !== toCap;
      const strideChanged = !!(fromStride && toStride && !arraysEqual(fromStride, toStride))
        || (!!fromStride !== !!toStride);

      // skip unchanged entries
      if (!capacityChanged && !strideChanged && fromCap !== null && toCap !== null) continue;

      diffs.push({
        prefix: p.prefix,
        kind: p.kind,
        from: fromCap !== null ? { capacity: fromCap, shape: fromShape, stride: fromStride } : null,
        to: toCap !== null ? { capacity: toCap, shape: toShape, stride: toStride } : null,
        capacityChanged,
        strideChanged,
        migrationRequired: strideChanged,
        status: fromCap === null ? "added" : toCap === null ? "removed" : "changed",
      });
    }

    return {
      from: fromVersionId,
      to: toVersionId,
      diffs,
      migrationRequired: diffs.some((d: any) => d.migrationRequired),
    };
  }

  // ── Helpers ───────────────────────────────────────────────

  async isLocked(prefix: string, versionId: string): Promise<boolean> {
    return this.lockStore.isLocked(prefix, versionId);
  }

  async getLock(prefix: string, versionId: string): Promise<DraftLock | null> {
    return this.lockStore.get(prefix, versionId);
  }

  async getAllDrafts(): Promise<
    { prefix: string; versionId: string; owner: string; kind: string; capacity: number; locked: boolean }[]
  > {
    const prefixes = await this.ownerStore.list();
    const results: any[] = [];

    for (const p of prefixes) {
      const drafts = await this.versionStore.getVersions(p.prefix, "draft");
      for (const d of drafts) {
        // prefixRegistry를 capacity 진실의 원천으로 사용
        const registryCap = await this.prefixRegistry.getCapacity(d.prefix, d.versionId);
        results.push({
          prefix: d.prefix,
          versionId: d.versionId,
          owner: p.owner,
          kind: p.kind,
          capacity: registryCap ?? d.capacity,
          locked: await this.isLocked(d.prefix, d.versionId),
        });
      }
    }
    return results;
  }

  /** 위상정렬: leaf → composite 순서 */
  async computeReleaseOrder(): Promise<string[]> {
    const prefixes = await this.ownerStore.list();

    // DAG 구축: prefix → refs의 prefix 목록
    const adj = new Map<string, Set<string>>();
    const allPrefixes = new Set<string>();

    // draft가 있는 prefix만 대상
    for (const p of prefixes) {
      const drafts = await this.versionStore.getVersions(p.prefix, "draft");
      if (drafts.length === 0) continue;
      allPrefixes.add(p.prefix);

      for (const d of drafts) {
        const deps = await this.prefixRegistry.getDeps(p.prefix, d.versionId);
        if (!adj.has(p.prefix)) adj.set(p.prefix, new Set());
        for (const dep of deps) {
          adj.get(p.prefix)!.add(dep.prefix);
        }
      }
    }

    // 위상정렬 (DFS post-order)
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const stack: string[] = [];
    const order: string[] = [];

    const visit = (node: string) => {
      if (visited.has(node)) return;
      if (visiting.has(node)) {
        // cycle detected — reconstruct cycle path from stack
        const cycleStart = stack.indexOf(node);
        const cyclePath = [...stack.slice(cycleStart), node];
        throw circularRef(
          `Cycle detected in release DAG: ${cyclePath.join(" → ")}`,
        );
      }
      visiting.add(node);
      stack.push(node);

      const neighbors = adj.get(node);
      if (neighbors) {
        for (const n of neighbors) {
          if (allPrefixes.has(n)) visit(n);
        }
      }

      stack.pop();
      visiting.delete(node);
      visited.add(node);
      order.push(node);
    };

    for (const p of allPrefixes) visit(p);
    return order; // leaf가 먼저 (post-order)
  }

  // ── Private ───────────────────────────────────────────────

  /** refs 설정 시 순환참조 검증 */
  private async checkCircularRef(
    prefix: string,
    refs: { prefix: string; versionId: string }[],
  ): Promise<void> {
    for (const ref of refs) {
      // 자기 참조
      if (ref.prefix === prefix) {
        throw circularRef(`Self-reference detected: '${prefix}' references itself`);
      }
      // 추이적 의존에서 순환 검사
      try {
        const transitive = await this.prefixRegistry.getTransitiveDeps(ref.prefix, ref.versionId);
        for (const dep of transitive) {
          if (dep.prefix === prefix) {
            throw circularRef(
              `Circular reference: '${prefix}' → '${ref.prefix}' → ... → '${prefix}'`,
            );
          }
        }
      } catch (e) {
        // circularRef 에러는 반드시 전파, registry 미등록(새 생성 중)은 skip
        if (e instanceof AppError && e.code === "CIRCULAR_REF") throw e;
      }
    }
  }

  private async toExtendedVersion(
    v: VersionRecord,
    dimRefs?: DimRef[],
  ): Promise<ExtendedVersionRecord> {
    const locked = await this.isLocked(v.prefix, v.versionId);
    const lock = await this.getLock(v.prefix, v.versionId);

    const shape = dimRefs ? dimRefs.map((r) => r.capacity) : undefined;
    const stride = shape ? calcWeights(shape) : undefined;
    const product = shape ? shape.reduce((a, b) => a * b, 1) : undefined;

    return {
      prefix: v.prefix,
      versionId: v.versionId,
      status: (locked ? "locked" : v.status) as ExtendedVersionStatus,
      baseVersionId: v.baseVersionId,
      capacity: v.capacity,
      deactivationMode: v.deactivationMode,
      ...(dimRefs ? { refs: dimRefs } : {}),
      ...(shape ? { shape } : {}),
      ...(stride ? { stride } : {}),
      ...(product !== undefined ? { product } : {}),
      createdAt: v.createdAt,
      ...(lock ? { lockedAt: lock.lockedAt } : {}),
      releasedAt: v.releasedAt,
    };
  }
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
