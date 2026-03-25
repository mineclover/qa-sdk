# PRD: Definition Catalog 문서 품질 고도화

## Overview

265건 문서(237 approved)의 품질을 체계적으로 개선한다. 7개 def-* 스킬(skills/ 디렉토리)을 활용하여 링크 연결(169건), purpose 보강, 태그 부여, overview 작성을 수행한다. 각 step은 독립적으로 실행 가능하며 /def-audit로 진행률을 측정한다.

## Goals

- links 없는 리프 169건 → 0건 (100% 횡방향 관계 연결)
- purpose 짧은 5건 → 0건 (전부 30자+)
- ^overview 커버리지 28% → 그룹 문서 100%
- tags 커버리지 34% → concern/tier 태그 50%+
- 150줄+ 잔여 리프 분할

## Quality Gates

이 커맨드가 매 스토리마다 통과해야 한다:
- `pnpm --filter definition-catalog test` — 261+ tests 통과
- `grep -rl "^def:" docs/ | while read f; do lc=$(grep "lifecycle:" "$f" | head -1 | sed 's/.*lifecycle: //'); [ "$lc" != "deprecated" ] && ! grep -q "\^purpose" "$f" && echo "FAIL: $f"; done` — ^purpose 누락 0건

## User Stories

### US-001: 스킬 구성
**Description:** skills/ 디렉토리에 7개 def-* 스킬을 skills.sh 호환 형식으로 배치한다.

**Acceptance Criteria:**
- [x] skills/def-topdown/SKILL.md 존재
- [x] skills/def-bottomup/SKILL.md 존재
- [x] skills/def-context/SKILL.md 존재
- [x] skills/def-split/SKILL.md 존재
- [x] skills/def-new/SKILL.md 존재
- [x] skills/def-link/SKILL.md 존재
- [x] skills/def-audit/SKILL.md 존재
- [x] AGENTS.md에 문서 시스템 섹션 추가

### US-002: 전체 품질 리포트 생성
**Description:** /def-audit를 실행하여 현재 문서 품질 기준선을 확인한다.

**Acceptance Criteria:**
- [ ] ^purpose 커버리지 수치 확인
- [ ] links 없는 리프 수 확인
- [ ] purpose 짧은 문서 목록 확인
- [ ] ^overview 없는 그룹 문서 목록 확인
- [ ] tags 없는 문서 수 확인

### US-003: gate-system 링크 연결 (파일럿)
**Description:** /def-link --batch gate-system으로 gate 그룹 내 멤버 간 횡방향 관계를 추가한다. 다른 시스템 배치의 기준이 된다.

**Acceptance Criteria:**
- [ ] gate-system 멤버 중 links 없는 문서 0건
- [ ] scope 기반 추론으로 depends_on/implements/refines/constrains 추가
- [ ] /def-bottomup gate-api 실행 시 blast radius 증가 확인
- [ ] /def-context gate-api 실행 시 의존 대상 표시 확인

### US-004: ingest-system 링크 연결
**Description:** ingest 그룹 내 14건 멤버 간 횡방향 관계를 추가한다.

**Acceptance Criteria:**
- [ ] ingest-system 멤버 중 links 없는 문서 0건
- [ ] API → data 모델 depends_on 연결
- [ ] pipeline-flow → API refines 연결

### US-005: df-system 링크 연결
**Description:** decision-flow 그룹 내 10건 멤버 간 횡방향 관계를 추가한다.

**Acceptance Criteria:**
- [ ] df-system 멤버 중 links 없는 문서 0건

### US-006: indexing-core-system 링크 연결
**Description:** 가장 큰 그룹(20건) 내 횡방향 관계를 추가한다.

**Acceptance Criteria:**
- [ ] indexing-core-system 멤버 중 links 없는 문서 0건

### US-007: 나머지 시스템 링크 일괄 연결
**Description:** permission, decode, query, registry, dkg, wi, cq, browser, spec-engine, index-meta, viz, apm, storage, event-vocab, guides 그룹의 링크를 연결한다.

**Acceptance Criteria:**
- [ ] 전체 리프 중 links 없는 문서 10건 이하
- [ ] /def-audit 실행 시 links 이슈 대폭 감소

### US-008: 짧은 purpose 보강
**Description:** 30자 미만 purpose 5건을 "무엇+왜+범위" 패턴으로 보강한다.

**Acceptance Criteria:**
- [ ] masking-spec purpose 30자+ (보안 맥락 추가)
- [ ] collection-transport-spec purpose 30자+ (전송 계층 설명)
- [ ] verdict-api-spec purpose 30자+ (판정 맥락 추가)
- [ ] registry-services-api-spec purpose 30자+ (디스커버리 맥락)
- [ ] wi-constraint purpose 30자+ (안전성 맥락)

### US-009: 그룹 ^overview 보강
**Description:** ^overview가 없는 그룹 문서(depth: overview)에 `## 구성 ^overview` 섹션을 추가한다.

**Acceptance Criteria:**
- [ ] 모든 그룹 문서(depth: overview)에 ^overview 있음
- [ ] overview에 멤버 수 + 각 멤버 1줄 요약 포함

### US-010: concern/tier 태그 일괄 부여
**Description:** security, performance, observability, testing 등 concern 태그와 tier-* 태그를 관련 문서에 부여한다.

**Acceptance Criteria:**
- [ ] 권한 관련 문서에 security 태그
- [ ] 벤치마크/성능 문서에 performance 태그
- [ ] 로깅/메트릭 문서에 observability 태그
- [ ] tags 커버리지 50%+ (현재 34%)

### US-011: 최종 조립 검증
**Description:** /def-topdown system-root를 실행하여 전체 시스템 조립이 올바른지 확인한다.

**Acceptance Criteria:**
- [ ] system-root 탑다운 조립에서 모든 하위 시스템 purpose 표시
- [ ] /def-context로 주요 문서(gate-api, record-spec, ingest-api-spec) 컨텍스트 정상
- [ ] /def-bottomup record-spec blast radius가 이전보다 증가

### US-012: 150줄+ 잔여 리프 분할
**Description:** /def-split으로 남은 대형 리프 문서를 분할한다.

**Acceptance Criteria:**
- [ ] 150줄+ 리프 문서 수 50% 감소
- [ ] 분할된 원본은 lifecycle: deprecated
- [ ] 새 멤버 문서에 ^purpose 있음

## Functional Requirements

- FR-1: /def-link의 scope 기반 추론 규칙을 따라 관계를 추가한다
- FR-2: frontmatter links 섹션에 `- target: <id>\n      type: <type>` 형식으로 추가한다
- FR-3: purpose 보강 시 "무엇+왜+범위" 패턴을 따른다
- FR-4: 태그는 기존 KNOWN_TAGS(taxonomy.ts)에 정의된 것을 사용한다
- FR-5: 모든 변경 후 `pnpm --filter definition-catalog test` 통과 확인

## Non-Goals

- definition-catalog 패키지 코드 변경 (문서만 수정)
- 새 scope/aspect 추가
- deprecated 문서 삭제 (이력 보존)
- 서비스 레지스트리 코드 변경

## Technical Considerations

- frontmatter YAML 형식: `def:` 래퍼 + 2칸 들여쓰기 필수
- links 추가 시 순환 참조 금지 (A→B, B→A)
- 관계 불확실하면 추가하지 않음 (잘못된 링크 > 없는 링크)
- 각 step은 독립 커밋으로 진행
- 스킬 참조: skills/def-link/SKILL.md, skills/def-audit/SKILL.md

## Success Metrics

- links 없는 리프: 169건 → 10건 이하
- purpose 짧은 문서: 5건 → 0건
- 그룹 ^overview: 28% → 100% (그룹만)
- tags 커버리지: 34% → 50%+
- /def-audit 실행 시 high severity 이슈 0건

## Open Questions

- links 연결 시 자동 추론이 부정확한 경우 수동 검토 기준은?
- 150줄+ 리프 분할의 우선순위 기준 (줄 수? scope? 시스템?)
