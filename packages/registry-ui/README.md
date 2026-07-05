# @qa-sdk/registry-ui

`@qa-sdk/registry-ui`는 registry 데이터를 브라우저에서 탐색하고 구성하는 프론트엔드다. 구현 이해는 중앙 spec 두세 개를 먼저 보는 방식이 가장 빠르다.

## 먼저 볼 문서

- [registry-ui.md](../../docs/specs/registry-ui/registry-ui.md) — 패키지 수준 개요
- [registry-ui.spec.md](../../docs/specs/viz-system/registry-ui.spec.md) — UI 구성과 페이지 경계
- [registry-service-modules.md](../../docs/specs/registry-service/registry-service-modules.md) — 이 UI가 소비하는 registry-service 모듈 경계

## 패키지 역할

- Glossary, Prefix Builder, DSL Builder 3개 탭/페이지를 제공한다.
- registry-service `/api/*`를 읽어 축, prefix, DSL 구성을 시각적으로 탐색한다.
- 프레임워크 없이 Vanilla TS + DOM API + Vite로 구성된 경량 UI다.

## 코드 진입점

- `src/main.ts` — SPA 부팅
- `src/store.ts` — 상태 관리와 API 연결
- `src/pages/glossary.ts` — 용어/축 탐색
- `src/pages/prefix-builder.ts` — prefix 구성
- `src/pages/dsl-builder.ts` — DSL 구조 편집

## 실행

```bash
pnpm --filter @qa-sdk/registry-ui dev
pnpm --filter @qa-sdk/registry-ui build
pnpm --filter @qa-sdk/registry-ui test
```

`test`는 production build 뒤 SPA 탭/컨테이너 marker, JS/CSS asset, `public/__generated__/git-conflicts.e2e.json`의 dist 복사와 conflict fixture shape을 검증한다.

이 패키지의 동작 의미는 registry-service가 SSOT다. UI에서 새 개념을 추가하기보다 먼저 registry 쪽 문서와 API surface가 맞는지 확인한다.
