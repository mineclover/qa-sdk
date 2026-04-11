# @qa-sdk/platform-demo

`@qa-sdk/platform-demo`는 개별 기능 데모 모음이 아니라 **viz-system과 indexing 레이어를 브라우저에서 체험하는 집합 프론트엔드**다. README도 그 기준으로 중앙 spec을 먼저 가리킨다.

## 먼저 볼 문서

- [viz-system.md](../../docs/specs/viz-system/viz-system.md) — 플랫폼 데모가 속한 전체 UI 시스템
- [viz-surface-system.md](../../docs/specs/viz-system/viz-surface-system.md) — 패널/그래프 렌더러 표면
- [platform-demo-api.spec.md](../../docs/specs/viz-system/platform-demo-api.spec.md) — 데모가 소비하는 API 경계
- [indexing/README.md](../../docs/specs/indexing/README.md) — 좌표 시스템 개념 맵과 플랫폼 데모 위치
- [rlsc.spec.md](../../docs/specs/rlsc/rlsc.spec.md) — `rlsc` 페이지가 시연하는 모델

## 패키지 역할

- monitor/diagram/debugger 성격의 시각화 페이지와 좌표계 데모 페이지를 묶는다.
- `weighted-index`, `permission-engine`, `demo-snapshot`, `rlsc`, `weighted-ui`를 조합해 브라우저에서 개념을 시연한다.
- 별도 백엔드 없이 Vite 앱으로 동작하며, 필요한 데이터는 registry/ingest/platform-demo-api에서 읽는다.

## 코드 진입점

- `src/main.ts` — 앱 부팅
- `src/pages/*.ts` — 데모 페이지 단위 구현
- `src/pages/rlsc.ts` — RLSC 데모
- `src/pages/layout.ts` — 레이아웃/시각화 시나리오
- `src/registry.ts` — registry 관련 연결

## 실행

```bash
pnpm --filter @qa-sdk/platform-demo dev
pnpm --filter @qa-sdk/platform-demo build
```

개별 페이지를 수정할 때는 먼저 관련 spec이 어느 그룹에 속하는지 확인한 뒤, 그 문서 링크를 README와 코드 변경에 함께 반영한다.
