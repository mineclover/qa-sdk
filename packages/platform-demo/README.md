# @qa-sdk/platform-demo

`@qa-sdk/platform-demo`는 개별 기능 데모 모음이 아니라 **viz-system과 indexing 레이어를 브라우저에서 체험하는 집합 프론트엔드**다. README도 그 기준으로 중앙 spec을 먼저 가리킨다.

## 먼저 볼 문서

- [viz-system.md](../../docs/specs/viz-system/viz-system.md) — 플랫폼 데모가 속한 전체 UI 시스템
- [viz-surface-system.md](../../docs/specs/viz-system/viz-surface-system.md) — 패널/그래프 렌더러 표면
- [platform-demo-api.spec.md](../../docs/specs/viz-system/platform-demo-api.spec.md) — 데모가 소비하는 API 경계
- [indexing/README.md](../../docs/specs/indexing/README.md) — 좌표 시스템 개념 맵과 플랫폼 데모 위치
- [rlsc-core-model.spec.md](../../docs/specs/viz-system/viz-language-system/rlsc-core-model.spec.md) — RLSC 모델 계약
- [rlsc-integration.spec.md](../../docs/specs/viz-system/viz-language-system/rlsc-integration.spec.md) — RLSC와 좌표계 통합 경계

## 패키지 역할

- monitor/diagram/debugger 성격의 시각화 페이지와 좌표계 데모 페이지를 묶는다.
- `weighted-index`, `permission-engine`, `demo-snapshot`, `weighted-ui`, viz-language 계약을 조합해 브라우저에서 개념을 시연한다.
- Vite 앱은 카탈로그 탐색 화면을 `demo-snapshot` 기반 bundled read model로 제공하므로 별도 백엔드 없이도 동작한다.
- 서비스·권한·이벤트·Casbin·시나리오 화면은 `src/mock-*-api.ts`와 `src/event-address.ts`를 사용한다. 이 read model은 API response shape를 유지하면서 canonical catalog 주소와 `address_context`를 만든다.
- grant 편집, 로그 조회/seed, version, permission-engine, prefix-meta처럼 runtime 상태가 필요한 화면은 `platform-demo-api` 경계를 계속 사용하며 API가 없을 때의 제한을 화면에 반영한다.

## 코드 진입점

- `src/main.ts` — 앱 부팅
- `src/pages/*.ts` — 데모 페이지 단위 구현
- `src/pages/layout.ts` — 레이아웃/시각화 시나리오
- `src/registry.ts` — registry 관련 연결
- `public/*.html` — monitor/dashboard/diagram/flow/debugger 정적 관찰 페이지

## 실행

```bash
pnpm --filter @qa-sdk/platform-demo dev
pnpm --filter @qa-sdk/platform-demo build
pnpm --filter @qa-sdk/platform-demo test
```

`test`는 production build 뒤 workbook HTML/asset, public 정적 관찰 페이지 복사, `def-catalog-data.json`, fallback read-model, diagram preset 전역 등록을 검증하고, 모든 catalog 버전의 bundled read model·주소 계산·`address_context`를 실행한다.

개별 페이지를 수정할 때는 먼저 관련 spec이 어느 그룹에 속하는지 확인한 뒤, 그 문서 링크를 README와 코드 변경에 함께 반영한다.
