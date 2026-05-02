---
# 신규 proposal 작성 시 아래 def 블록의 <topic-name>을 실제 이름으로 치환하세요.
# def:
#   id: <topic-name>-01-migration
#   type: knowledge
#   knowledge_kind: proposal
#   lifecycle: draft
#   owner_system: definition-catalog
#   projection_plane: intent
#   scope: meta
#   aspect: proposal_design
#   tier: system
#   depth: specification
#   links:
#     - target: <topic-name>-readme
#       type: depends_on
status: draft
date: YYYY-MM-DD
part_of: <topic-name>
role: migration-guide
supersedes: -
superseded_by: -
---

# <Proposal Name> — 마이그레이션 가이드

## 목적 ^purpose
이 제안이 수락된 후, 기존 시스템 및 문서를 어떻게 새로운 체계로 전환할 것인지에 대한 단계별 실행 계획.

## 영향 범위
- 스키마 변경 (Frontmatter 등)
- 변경 대상 문서 수 추정
- 도구(CLI 등) 갱신 필요 사항

## 단계별 실행 계획
### Phase 0 — 설계 결정 고정
### Phase 1 — 도구 준비 및 선행 조사
### Phase 2 — 자동 분류 / 대규모 전환 준비
### Phase 3 — Pilot 적용 및 실증 (Empirical Validation)
- *주의: 가상의 예시만이 아니라, 최소 1건 이상의 실제 시스템/코드를 섀도우 리팩토링하여 작동을 증명해야 함.*
### Phase 4 — 전체 전환 적용 (경고 → 에러 승격)
### Phase 5 — 레거시 제거 (정착)

## 위험과 완화 전략
전환 과정에서 발생할 수 있는 리스크와 대비책을 기술한다.
