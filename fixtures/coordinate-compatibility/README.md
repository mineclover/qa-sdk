# Coordinate Compatibility Fixtures

좌표 주소 codec의 호환성 기준 데이터. 생성·검증 테스트는 `packages/demo-tests/src/codec-compat/`에 있다.

## legacy-v1/demo.json

`DEMO_CATALOG`에서 현재 codec(`legacy-v1`: `prefix:version:address`, capacity 기준 mixed-radix — ADR-010)으로
만든 주소와 decode 값의 기록이다.

- **현재 동작의 기록이며 기대값의 정본이 아니다.** 정본은 `@qa-sdk/core` catalog runtime이다.
- 표본: prefix version마다 전 dim position 0, 전 dim 마지막 실제 entry, dim별 단독 마지막 entry,
  dim별 단독 headroom(capacity - 1). headroom 값은 `(reserved:N)`으로 기록된다.
- 제외: `addressModel: 'sum'` prefix(path-summation 테스트 소유), 주소 공간이 2^53을 넘는 layout.
- `catalogDigest`는 생성 시점 `computeCatalogDigest(DEMO_CATALOG)`이다. catalog 표시 이름만 바뀌어도 달라진다.

## 갱신 규칙

```bash
UPDATE_CORPUS=1 corepack pnpm --filter @qa-sdk/demo-tests exec vitest run src/codec-compat/legacy-v1-corpus.test.ts
```

- 갱신은 위 명령으로만 한다. 손으로 편집하지 않는다.
- catalog의 **append-only 변경**(capacity 안에서 entry 추가)은 기존 case의 `address`·`values`를 바꾸지 않아야 한다.
  headroom이던 position이 새 entry 이름으로 바뀌는 것만 허용된다. 그 외 기존 case가 바뀌면 breaking 변경이므로
  새 prefix version을 발행해야 한다 (`findUnversionedBreakingChanges`).
- PR에 corpus diff가 있으면 변경 사유를 본문에 적는다.
