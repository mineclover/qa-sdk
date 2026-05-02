# #7 Hybrid with VersionedIndex — 실전 1순위

[← 진입점](README.md)

DB는 address 정수 하나만 저장. 차원 분해는 클라이언트가 `WI.decode`로 수행. **shape version 없이 address만 저장하면 호환성 지옥** — `VersionedIndex` 패턴 필수.

검증 코드: `src/rdbms/strategy-hybrid.test.ts`

## 잘못된 형태 (금지)

```ts
// shape version 누락 — 나중에 shape 바뀌면 의미 재해석 불가
await db.insert(events).values({
  address: WI.encode(coord),
  observedAt: new Date().toISOString(),
});
```

## 올바른 형태

```ts
await db.insert(events).values({
  prefixId: "perm",
  version: "pv1",              // shape snapshot 식별자 (필수)
  address: WI.encode(coord),
  observedAt: new Date().toISOString(),
});

// 범위 쿼리 (version 함께 필터)
const ranges = calcAddressRanges(shape, ["2", null, null]);
for (const [lo, hi] of ranges) {
  await db.select().from(events).where(
    and(
      eq(events.prefixId, "perm"),
      eq(events.version, "pv1"),
      between(events.address, lo, hi),
    ),
  );
}
```

## 트레이드오프

- ✅ 가장 현실적 — qa-sdk ingest가 사실상 이 모델
- ⚠️ **치명적 취약점**: shape이 바뀌면 저장된 address의 의미가 재해석됨. version 없이 도입하면 데이터 corruption 위험
- ✅ **필수 보완**: `VersionedIndex = { prefixId, version, address }` 저장 패턴. weighted-index의 `PrefixCodec`이 이미 제공

## 언제 쓰는가

- 이벤트 수집, 관측 로그, 샘플링 등 append-only write 경로
- 클라이언트(브라우저·엣지)가 encode를 수행하고 address만 서버로 전송
- shape 버전을 명시 관리할 수 있는 조직 규율

## 핵심 포인트

- **version 없이 저장하지 말 것** — 비가역 부채
- 여러 version이 공존해도 서로 오염되지 않음 (prefix_id + version으로 격리)
- `calcAddressRanges` 결과를 `BETWEEN` 또는 `IN` 절로 번역 가능
- shape 변경 시 새 version 발급 + 마이그레이션 툴로 이행
