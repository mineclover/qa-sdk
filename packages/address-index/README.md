# address-index

`address-index`는 `address_context`를 역방향으로 조회하기 위한 라이브러리다. 구현 이해는 중앙 spec 두 문서를 먼저 보는 것이 가장 빠르다.

## 먼저 볼 문서

- [address-index.md](../../docs/specs/index-meta-system/address-index.md) — 패키지 개요와 역할
- [address-index.spec.md](../../docs/specs/indexing-core-system/address-index.spec.md) — `AddressIndex` 포트와 질의 모델
- [indexing/README.md](../../docs/specs/indexing/README.md) — indexing 레이어 전체 경계

## 패키지 역할

- `"tracking:v2:1200"` 같은 주소 문자열을 `{ prefixId, version, address }`로 정규화한다.
- prefix×address 단일 조회와 cross-prefix 교차 조회를 지원한다.
- 현재는 인메모리 구현이 기본이며, 이후 SQLite/Redis 어댑터 확장을 염두에 둔 포트 구조를 갖는다.

## 코드 진입점

- `src/index.ts` — public export
- `src/port.ts` — `AddressIndex` 포트
- `src/types.ts` — `ParsedAddress`, query 타입
- `src/memory-store.ts` — 인메모리 구현
- `src/address-index.test.ts` — 기본 회귀 테스트

## 실행

```bash
pnpm --filter address-index build
pnpm --filter address-index test
```

패키지 semantics를 바꿀 때는 코드보다 먼저 `address-index.spec.md`의 query/port 계약을 확인한다.
