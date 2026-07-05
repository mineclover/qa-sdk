---
def:
  id: package-classifier-spec
  tier: component
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

## 관련 소스

- `packages/package-classifier/src/pkg-classifier.ts`
- `packages/package-classifier/src/index.ts`
