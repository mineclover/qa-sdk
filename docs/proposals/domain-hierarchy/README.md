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
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: index
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/domain-hierarchy/`. 아직 정규 스펙 아님.

# Domain Hierarchy — 시스템의 도메인 소속 및 좌표 구별

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

- 2026-04-20: draft 작성 완료
- 다음: Phase 1 조사 실행 후 Empirical Validation
