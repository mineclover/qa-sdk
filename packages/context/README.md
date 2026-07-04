# @qa-sdk/context

`@qa-sdk/context`는 서비스/SDK가 공유하는 QA 컨텍스트 제공층이다. 구현 기준은 platform context spec이다.

## 먼저 볼 문서

- [platform-context-spec.md](../../docs/specs/platform-chain/platform-context-spec.md) — QaContext와 CatalogProvider 계약
- [platform-chain-system.md](../../docs/specs/platform-chain/platform-chain-system.md) — 플랫폼 체인 상위 구조
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — context의 계층 위치

## 패키지 역할

- Catalog, 세션, 서비스 정보를 묶은 `QaContext`를 제공한다.
- runtime에서 Catalog를 공급하는 `CatalogProvider`를 감싼다.
- `@qa-sdk/sdk`가 여러 하위 라이브러리를 하나의 facade로 조립할 수 있게 한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/qa-context.ts` — `createQaContext()`와 컨텍스트 구현
- `src/catalog-provider.ts` — CatalogProvider 구현

## 실행

```bash
pnpm --filter @qa-sdk/context build
pnpm --filter @qa-sdk/context test
```
