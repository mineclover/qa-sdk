// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence-strategy-hybrid

/**
 * 전략 #7 — Hybrid (encode는 클라이언트, 저장은 address 정수)
 *
 * DB는 address 정수 하나만 저장. 차원 분해는 클라이언트가 `WI.decode`로 수행.
 * 실전 1순위지만, **shape version 없이 address만 저장하면 호환성 지옥**.
 * 본 테스트는 `VersionedIndex` 패턴(prefixId + version + address) 저장을 증명한다.
 */

import { and, between, eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { calcAddressRanges } from "../math/calc.js";
import { WI, freshDb, shape } from "./shared.js";

describe("#7 Hybrid with VersionedIndex — address 정수 + version 동봉 저장", () => {
  const events = sqliteTable("events", {
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    address: integer("address").notNull(),
    observedAt: text("observed_at").notNull(),
  });

  it("VersionedIndex로 저장하면 version 필터와 주소 범위 쿼리가 동시 성립", () => {
    const { raw, db } = freshDb();
    raw.exec(`
      CREATE TABLE events (
        prefix_id TEXT NOT NULL,
        version TEXT NOT NULL,
        address INTEGER NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY (prefix_id, version, address)
      );
    `);

    const observations: Array<[number, number, number]> = [
      [1, 1, 1],
      [2, 2, 3],
      [3, 3, 3],
      [2, 1, 2],
    ];
    db.insert(events)
      .values(observations.map(([r, a, x]) => ({
        prefixId: "perm",
        version: "pv1",
        address: WI.encode([r, a, x]),
        observedAt: "2026-04-22T00:00:00Z",
      })))
      .run();

    // 1) DB는 address 정수만 보관, client가 decode로 좌표 복원
    const rows = db
      .select({ address: events.address })
      .from(events)
      .where(and(eq(events.prefixId, "perm"), eq(events.version, "pv1")))
      .all();
    const decoded = rows.map((r) => WI.decode(r.address));
    const decodedSorted = [...decoded].sort((a, b) =>
      WI.encode(a) - WI.encode(b),
    );
    const observationsSorted = [...observations].sort((a, b) =>
      WI.encode([...a]) - WI.encode([...b]),
    );
    expect(decodedSorted).toEqual(observationsSorted);

    // 2) 범위 쿼리 = calcAddressRanges 결과를 WHERE로 번역 (다중 range 지원)
    const ranges = calcAddressRanges([...shape], ["2", null, null]);
    let role2Sum = 0;
    for (const [lo, hi] of ranges) {
      const [{ n }] = db
        .select({ n: events.address })
        .from(events)
        .where(
          and(
            eq(events.prefixId, "perm"),
            eq(events.version, "pv1"),
            between(events.address, lo, hi),
          ),
        )
        .all()
        .reduce((acc: Array<{ n: number }>, row) => {
          acc[0].n += 1;
          return acc;
        }, [{ n: 0 }]);
      role2Sum += n;
    }
    const manuallyCounted = observations.filter(([r]) => r === 2).length;
    expect(role2Sum).toBe(manuallyCounted);

    // 3) 다른 version의 address는 오염되지 않음 (shape 변경 시 안전한 격리)
    db.insert(events).values({
      prefixId: "perm",
      version: "pv2",        // 다른 shape 스냅샷 가정
      address: 42,           // pv1과 pv2는 의미 다름
      observedAt: "2026-04-22T01:00:00Z",
    }).run();
    const pv1Count = db
      .select({ n: events.address })
      .from(events)
      .where(and(eq(events.prefixId, "perm"), eq(events.version, "pv1")))
      .all().length;
    expect(pv1Count).toBe(observations.length); // pv2는 pv1 쿼리에 섞이지 않음
  });
});
