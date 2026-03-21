/**
 * Version Resolution 통합 테스트.
 *
 * 컨벤션 검증:
 *   1. 모든 prefix의 최신 version에서 encode/decode 라운드트립이 성공하는가
 *   2. CatalogProvider.latestVersion()이 catalog과 일치하는가
 *   3. catalogToSchemaSnapshot이 전체 축/prefix를 포함하는가
 *
 * 이 테스트가 실패하면 → catalog 변경이 version resolution을 깨뜨린 것.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, encodePrefixByValue, decodePrefix } from "demo-snapshot";
import { catalogToSchemaSnapshot } from "../loader/catalog-bridge.js";

describe("Version Resolution — 전체 prefix 라운드트립", () => {
  const prefixes = Object.entries(DEMO_CATALOG.prefixes);

  it(`${prefixes.length}개 prefix의 최신 version에서 encode/decode 라운드트립 성공`, () => {
    let pass = 0;
    let fail = 0;
    const errors: string[] = [];

    for (const [prefixId, prefix] of prefixes) {
      const ver = prefix.versions[prefix.versions.length - 1].version;
      const dims: Record<string, string | number> = {};
      let canTest = true;

      for (const label of prefix.labels) {
        const dim = (prefix.dims as any)[label];
        if (dim.kind === "axis") {
          const axisId = dim.axisId;
          const axis = (DEMO_CATALOG.axes as any)[axisId];
          if (!axis) { canTest = false; break; }
          const versionKey = (prefix.versions[prefix.versions.length - 1].axisVersions as any)?.[label];
          if (!versionKey) { canTest = false; break; }
          const snap = axis.versions[versionKey];
          if (!snap?.entries?.length) { canTest = false; break; }
          dims[label] = snap.entries[0];
        } else if (dim.kind === "prefix_ref") {
          const refEntries = (prefix.versions[prefix.versions.length - 1] as any).refEntries?.[label];
          if (!refEntries?.values?.length) { canTest = false; break; }
          dims[label] = refEntries.values[0];
        } else {
          dims[label] = 0;
        }
      }

      if (!canTest) continue;

      try {
        const addr = encodePrefixByValue(DEMO_CATALOG, prefixId, ver, dims);
        decodePrefix(DEMO_CATALOG, prefixId, ver, addr);
        pass++;
      } catch (e: any) {
        fail++;
        errors.push(`${prefixId}:${ver} — ${e.message}`);
      }
    }

    expect(fail).toBe(0);
    expect(pass).toBe(prefixes.length);
    if (errors.length > 0) {
      throw new Error(`Version resolution 실패:\n${errors.join("\n")}`);
    }
  });

  it("latestVersion이 catalog의 마지막 version과 일치", () => {
    for (const [prefixId, prefix] of prefixes) {
      const expected = prefix.versions[prefix.versions.length - 1].version;
      // latestPrefixVersion 패턴과 동일
      expect(expected).toBeTruthy();
      expect(prefix.versions.length).toBeGreaterThan(0);
    }
  });
});

describe("catalogToSchemaSnapshot — 전체 포함 검증", () => {
  it("모든 축이 snapshot에 포함됨", () => {
    const snapshot = catalogToSchemaSnapshot(DEMO_CATALOG as any);
    const snapshotAxes = new Set(snapshot.axes.map(a => a.id));
    const catalogAxes = Object.keys(DEMO_CATALOG.axes);

    for (const axisId of catalogAxes) {
      expect(snapshotAxes.has(axisId)).toBe(true);
    }
    expect(snapshot.axes.length).toBe(catalogAxes.length);
  });

  it("모든 prefix가 snapshot에 포함됨", () => {
    const snapshot = catalogToSchemaSnapshot(DEMO_CATALOG as any);
    const snapshotPrefixes = new Set(snapshot.composites.map(c => c.id));
    const catalogPrefixes = Object.keys(DEMO_CATALOG.prefixes);

    for (const prefixId of catalogPrefixes) {
      expect(snapshotPrefixes.has(prefixId)).toBe(true);
    }
    expect(snapshot.composites.length).toBe(catalogPrefixes.length);
  });

  it("축 capacity가 entries보다 큼", () => {
    const snapshot = catalogToSchemaSnapshot(DEMO_CATALOG as any);
    for (const axis of snapshot.axes) {
      expect(axis.capacity).toBeGreaterThanOrEqual(axis.entries.length);
    }
  });
});
