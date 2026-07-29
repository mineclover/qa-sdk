---
def:
  id: domain-hierarchy-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  links:
    - target: domain-hierarchy-00-design
      type: refs
    - target: domain-hierarchy-01-migration
      type: refs
    - target: domain-hierarchy-02-proposals-integration
      type: refs
status: implemented
date: 2026-04-20
part_of: domain-hierarchy
role: index
supersedes: -
superseded_by: -
sources:
  - docs/proposals/aspect-evolution-index.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase2-impl.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase6-impl.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-21-final-cleanup.md
  - packages/definition-catalog/src/domain-root.ts
  - packages/definition-catalog/src/domain-root.test.ts
  - packages/definition-catalog/src/validate.ts
  - packages/cli/src/commands/def.ts
  - packages/cli/src/workflow-smoke.test.ts
---

> **RFC / Proposal historical record.** `docs/proposals/domain-hierarchy/`. 현재 실행 결과와 정규화된 규칙은 `aspect-evolution-index` 및 `docs/specs/system/*` rule 문서가 잇는다.

# Domain Hierarchy — 시스템의 도메인 소속 및 좌표 구별

## 목적 ^purpose

이 문서는 Domain Hierarchy — 시스템의 도메인 소속 및 좌표 구별에 대한 제안·검토 기록을 보존하고, 관련 설계 판단과 후속 작업의 근거를 제공한다.

## 배경

현재 `def validate`가 `duplicate-coordinate` 경고 30건을 보고한다. 분석 결과:
- 대부분은 서로 다른 도메인(APM, DF, WI, CQ, …)에 속한 시스템들이 **좌표만 겹침**
- 내용 중복이 아니라 **도메인 식별 부재** 문제
- 도메인 정보는 `id` 접두사(apm-, df-, …)와 `owner_system` 필드에 분산 존재

## 핵심 통찰

**의존성 관리 관점**. 시스템 = 도메인이며, 시스템 간 관계는 "누가 무엇을 누구에게 기대하는가"로 본다.

멘탈 모델 병렬:
- **패키지 + import**: `dependencies` 선언 + 테스트로 기대 검증
- **함수형 컴포지션**: 타입 시그니처 + 테스트로 기대 검증
- **ECS 게임 시스템**: System이 Component를 읽고 쓸 때 불변식을 테스트로 검증
- **qa-sdk**: `depends_on` 링크 + `.test.md`/`.cases.md` 시나리오로 기대 검증

공통점: **독립 단위를 의존 관계로 조합하며, 기대 충족은 테스트로 검증**.

## 제안 요약

새 스키마 필드 **없이** 기존 링크 그래프 + 테스트 문서를 활용:

1. **`domain_root` 파생 로직**: `depends_on`/`refines` 체인을 타고 최상위 조상을 찾음
2. **duplicate-coordinate 재정의**: 키를 `tier:scope:layer:aspect:domain_root`로 확장
3. **의존 관계 보완**: `domain_root == self`이면서 실제 도메인 루트가 아닌 문서 → 부모 시스템에 `depends_on` 링크 추가
4. **기대 시나리오 명세화**: 각 `depends_on` 링크는 `.test.md`(공급자 보장) 또는 `.cases.md`(소비자 기대)로 뒷받침. `def audit --coverage`로 측정
5. **내용 중복만 남김**: 같은 `domain_root + 좌표` 공유는 진짜 후보로 좁혀짐 (30 → ≤8 예상)

## 구성 문서

| 문서 | 내용 |
|------|------|
| [00-design.md](./00-design.md) | 설계 개요 + 핵심 원칙 + 멘탈 모델 |
| [01-migration.md](./01-migration.md) | Phase 0~5 마이그레이션 계획 |
| [02-proposals-integration.md](./02-proposals-integration.md) | `docs/proposals/` 자체를 문서 관리체계에 편입하는 방안 |

## 상태

- 2026-04-20: RFC 작성 및 Phase 0~6 실행.
- 2026-04-21: Aspect Evolution 3-RFC 흐름으로 흡수되어 `duplicate-coordinate` 최종 0건까지 정리.
- 현재: proposal은 historical record이며, runtime evidence는 `domain-root.ts`, `validate.ts`, CLI `def list --domain-root`, workflow smoke test, `aspect-evolution-index`가 소유한다.

## 현재 증거 표면 ^evidence

- `packages/definition-catalog/src/domain-root.ts`가 `deriveDomainRoot()` / `deriveAllDomainRoots()`를 소유하고, `domain-root.test.ts`가 기본 walk, 안전장치, sub-doc rollup을 검증한다.
- `packages/definition-catalog/src/validate.ts`는 duplicate-coordinate 키에 파생 `domain_root`를 포함하고, proposal/ADR/convention 및 `cross-scope` / `coordinate-cluster` 예외 정책을 적용한다.
- `packages/cli/src/commands/def.ts`는 `def list --domain-root` 및 domain member 탐색 경로를 제공한다.
- `packages/cli/src/workflow-smoke.test.ts`는 핵심 root의 domain-root 파생, topdown member union, domain-root listing을 repo 문서 데이터로 검증한다.
