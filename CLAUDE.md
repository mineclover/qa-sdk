# QA-SDK Monorepo

## Build
- `pnpm --filter <pkg> build` — 개별 패키지 빌드 (tsup)
- weighted-index → platform-demo 순서로 빌드해야 함 (의존성)
- weighted-index DTS 빌드에 기존 에러 있음 (calc.js exports); ESM/CJS는 정상
- platform-demo tsc 우회: `pnpm --filter platform-demo exec vite build --mode development`

## Package Structure
- `packages/weighted-index/src/index.ts` — 모든 public export 관리; 새 함수 추가 시 여기도 업데이트
- `packages/weighted-index/src/layout-fit.ts` — 레이아웃 시뮬레이터 순수 함수 (Number/BigInt 모드)
- `packages/platform-demo/src/pages/layout.ts` — 레이아웃 시뮬레이터 UI

## Conventions
- 한국어 주석/UI 텍스트 사용
- Number.MAX_SAFE_INTEGER 한계: indexBudget > 13 hex chars 시 dimMaxForBudget 캡 발생 → BigInt 대안 필요
