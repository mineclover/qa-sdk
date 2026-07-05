---
def:
  id: package-classifier-spec
  type: spec
  tier: system
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: package-classifier
  tags: [structural, runtime, cross-scope]
  links:
    - target: system-support
      type: refines
    - target: shared-utility-group
      type: refs
    - target: package-classifier-rule
      type: traces_to
    - target: package-classifier-test
      type: traces_to
  sources:
    - packages/package-classifier/package.json
    - packages/package-classifier/src/index.ts
    - packages/package-classifier/src/pkg-classifier.ts
    - packages/package-classifier/src/pkg-classifier.test.ts
    - packages/package-classifier/src/__tests__/usage-logic.test.ts
    - scripts/analyze-package-usage.ts
    - scripts/check-dependency-boundaries.ts
    - scripts/generate-api-reference.ts
---
# package-classifier

## 목적 ^purpose

모노레포 패키지를 스캔해 `tier`, `runtime`, `scope` 메타데이터로 분류하는 유틸리티. CLI와 리뷰 도구가 패키지군을 구조적으로 읽을 수 있게 최소 분류 정보를 제공한다.

## 구성 ^overview

- `scanAndClassify(root)` — `packages/*` 순회
- `tier` heuristic — foundation/kernel/logic/bridge/consumer 분류
- `runtime` heuristic — server/browser/library 분류
- 내부 의존 패키지 해석 — `packages/*` surface-managed package name/displayName 기준
- CLI/review 도구는 `package-classifier` public export를 소비한다. 도구별 local classifier 사본은 분류 SSOT로 두지 않는다.

## 기능 경계 ^constraint

- 이 패키지는 `packages/*` package.json 스캔, `ClassifiedPackage` shape, tier/runtime/scope heuristic, 내부 dependency displayName 해석을 소유한다.
- surface manifest, promotion/quarantine verdict, zero-fan-in disposition은 `scripts/package-surfaces.mjs`와 `scripts/analyze-package-usage.ts`가 소유한다.
- architecture tier violation 판정과 API reference manifest 생성은 소비자 script 책임이다. `package-classifier`는 그 입력 데이터만 제공한다.
- generated manifest나 docs table을 직접 쓰지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter package-classifier typecheck
corepack pnpm --filter package-classifier test
corepack pnpm --filter package-classifier build
```
