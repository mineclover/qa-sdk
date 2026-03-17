# QA-SDK Monorepo

## Build
- `pnpm --filter <pkg> build` — 개별 패키지 빌드 (tsup)
- weighted-index → permission-engine → platform-demo 순서로 빌드해야 함 (의존성)
- weighted-index DTS 빌드에 기존 에러 있음 (calc.js exports); ESM/CJS는 정상
- platform-demo tsc 우회: `pnpm --filter platform-demo exec vite build --mode development`

## Package Structure

### weighted-index
- `packages/weighted-index/src/index.ts` — 모든 public export 관리; 새 함수 추가 시 여기도 업데이트
- `packages/weighted-index/src/layout-fit.ts` — 레이아웃 시뮬레이터 순수 함수 (Number/BigInt 모드)

### permission-engine
- `packages/permission-engine/` — 비트마스크 기반 권한 엔진 (weighted-index 의존)
- `src/permission-set.ts` — 핵심: [feature, role] bitmask 인코딩, O(1) grant/check
- `src/scoped-engine.ts` — env/region 등 외부 컨텍스트별 독립 마스크 관리
- `src/migration.ts` — shape 변경 시 마스크 마이그레이션 (ID 매칭 자동 변환 또는 커스텀 CoordMapper)
- `src/resource.ts` — resource 정규화/검증 (canonical path-like key, 타입별 패턴 규칙)
- `src/service-ref.ts` — 서비스 참조 (namespace/name) + SDK 글로벌 컨텍스트 (env/build/region 숨김)
- `src/permission-code.ts` — 전체 permission address: `{service-ref}.{type}.{resource}.{action}`

### platform-demo
- `packages/platform-demo/src/pages/layout.ts` — 레이아웃 시뮬레이터 UI
- `packages/platform-demo/src/pages/casbin.ts` — Casbin 권한 모델 해설 (qa-sdk ↔ Casbin 대비)
- `packages/platform-demo/src/pages/perm-engine.ts` — permission-engine v1→v2 마이그레이션 비교 데모

## Permission Engine Architecture
- 내부 차원: feature(resource) × role → weighted-index 압축 → bitmask
- 외부 차원: env/region/namespace → ScopedEngine scope key로 라우팅
- 클라이언트는 role을 직접 확인하지 않음 — 서버가 role → flat permission mask로 resolve 후 전송
- resource 규칙: 소문자, `/` 구분, leading/trailing slash 금지, depth ≤ 4, `:param` 패턴 허용
- permission code 포맷: `{namespace/name}.{type}.{resource}.{action}` (예: `shop/payment.api.admin/teams.GET`)
- type(page/api/action)별 resource 패턴 분리: page는 :param 금지/depth 3, api는 :param 허용/depth 4

## Conventions
- 한국어 주석/UI 텍스트 사용
- Number.MAX_SAFE_INTEGER 한계: indexBudget > 13 hex chars 시 dimMaxForBudget 캡 발생 → BigInt 대안 필요
