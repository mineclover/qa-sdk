---
def:
  id: deterministic-label-architecture
  type: spec
  level: module
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: deterministic-label-registry
  tags: [structural, entry-point, cross-scope, contract]
  links:
    - target: docs-control-plane
      type: refines
    - target: deterministic-label-coordinate-stability
      type: contains
    - target: deterministic-label-projection-determinism
      type: contains
    - target: doc-envelope
      type: contains
    - target: ralph-tui-integration
      type: contains
    - target: deterministic-label-stability-boundary
      type: traces_to
    - target: deterministic-label-registry-extraction-plan
      type: traces_to
  source: packages/deterministic-label-registry/src/index.ts
---

# Deterministic Label — 아키텍처 경계

## 목적 ^purpose

Deterministic label system의 **5 계층 경계와 허용 의존 방향**을 고정한다. 각 계층이 어떤 목적 단위를 소유하는지, 무엇을 하지 않는지, 어디서 어디를 import해도 되는지 선언한다. 신규 기여자의 진입점이자 PR 리뷰의 근거 문서.

## 5 계층 ^overview

```
Layer 1 — 수집 (collection)
  doc-envelope
    envelope 타입, 범용 family/scope 판정, 범용 `.todo.md` completed 감지,
    TODO lifecycle 파싱. 도구 중립.

Layer 2 — 도구 통합 (integration) [병렬]
  ralph-tui-integration            ontology-pack-validate
    `.ralph-tui/` session adapter    pack schema/runtime/readiness
    ralph PRD JSON adapter           docs family reader DI point
    ralph PRD completion detection   known pack registry

Layer 3 — 해석 (interpretation)
  deterministic-label-registry
    semantic coordinate + label record projection
    read-only inventory 조립 (+ extraRecords 주입점)
    FSM readiness/transition dry-run은 2026-04-18 단순화에서 제거됨

Layer 4 — 환경 조립 (composition)
  @qa-sdk/cli
    adapter 구성 (5종 도구별 adapter)
    docs reader DI (ontology-pack-validate에 주입)
    completed record 병합 (doc-envelope + ralph-tui-integration)
    명령 표면 (docs/def/ontology 등)
```

## 의존 방향 ^defines

```
doc-envelope         ← (단독, node 외 의존 0)
  ↑
ralph-tui-integration   ← doc-envelope만
ontology-pack-validate  ← doc-envelope + definition-catalog + authorization/operational-ontology
  ↑
deterministic-label-registry  ← doc-envelope만
  ↑
@qa-sdk/cli          ← 위 4개 + definition-catalog + 기타 서비스 의존
```

**역방향 금지**. 예: `doc-envelope`이 `ralph-tui-integration`을 import하면 경계 위반. CLAUDE.md의 "QA 플랫폼 → 인코딩 라이브러리만 허용" 규칙과 동일 정신.

## 각 계층 계약

### 1. `doc-envelope` (수집)

**소유**:
- `DocumentEnvelope` + 보조 타입 (`DocumentLink`, `DocumentSource`, `DocumentTask`, `DocumentMetadata` 등)
- `normalizeDocumentEnvelope` / `matchesDocumentQuery`
- `collectDocumentFamilyOnlyScope` / `isArchivedPrdDocument` / `isTransientDocument`
- `detectCompletedRecords` (범용 `.todo.md` 감지)
- `parseTodoFollowUps` / `classifyTodoHeading` / `countMarkdownCheckboxes`

**소유하지 않음**:
- 특정 도구(ralph-tui 등)의 파일 경로 하드코딩
- 특정 도구의 schema/format 파싱
- 해석 logic (graph ranking, FSM readiness, drift 등)
- 쓰기 경로

**허용 import**: node built-ins만

### 2. `ralph-tui-integration` (도구 통합)

**소유**:
- `.ralph-tui/session-meta.json` adapter (envelope 생성 시 `metadata.transient: true` 스탬프)
- ralph PRD JSON flat-root 포맷 adapter
- `detectCompletedRalphPrdRecords` (ralph 특화 완료 감지)

**소유하지 않음**:
- `.todo.md` 범용 감지 (doc-envelope 소유)
- ralph 세션 mutation / write
- label 투영 / FSM

**허용 import**: `doc-envelope`

### 3. `ontology-pack-validate` (도구 통합)

**소유**:
- Pack ref 해석 + schema / component / system / runtime / readiness 검증
- Known pack registry (`KNOWN_ONTOLOGY_PACK_IDS`)
- `OntologyPackDocsFamilyReader` DI point (docs reader 주입 대상)

**소유하지 않음**:
- Label 투영 / URN 생성
- Docs family 구현 (caller가 reader 주입)
- Pack mutation

**허용 import**: `doc-envelope`, `definition-catalog`, `authorization-ontology`, `operational-ontology`, node built-ins

### 4. `deterministic-label-registry` (해석)

**소유**:
- Semantic coordinate candidate + URN 생성
- DeterministicLabelRecord 투영 (상태 없음 — 순수 투영)
- Inventory 조립 (documents + extraRecords 주입점)

**의도적으로 소유하지 않음 (2026-04-18 단순화로 제거)**:
- FSM readiness gates
- Transition dry-run
- State enum / gate evidence
- Append-only event schema candidate

**소유하지 않음**:
- Pack validation logic (ontology-pack-validate 소유)
- `.ralph-tui/` 경로 지식 (ralph-tui-integration 소유)
- Adapter 구성 (cli 소유)
- Write/persistence
- Operator CLI surface

**허용 import**: `doc-envelope`

### 5. `@qa-sdk/cli` (환경 조립)

**소유**:
- 5종 adapter factory 구성 (definition-markdown / prd-markdown / artifact-evidence + ralph-tui-integration 재수출 2종)
- `readDocsFamilyFromDefinitionMarkdown` — ontology-pack-validate의 DI 구현
- `detectCompletedRecordsWithRalphIntegration` — doc-envelope + ralph-tui-integration 병합
- CLI 명령 (docs / def / ontology 등)
- 전역 orchestration

**소유하지 않음**:
- 라이브러리 logic 직접 구현 (위 라이브러리들이 소유)

**허용 import**: 위 4개 라이브러리 + 기타 서비스 패키지

## 규칙

### R-1. 역방향 import 금지
- `doc-envelope`이 `ralph-tui-integration`/`ontology-pack-validate`/`deterministic-label-registry`/`@qa-sdk/cli` 중 **어느 것도 import 금지**
- Layer 2 (`ralph-tui-integration`, `ontology-pack-validate`)가 Layer 3 이상을 import 금지
- `deterministic-label-registry`가 `@qa-sdk/cli`를 import 금지

### R-2. 같은 Layer 내 횡단 의존 금지
- `ralph-tui-integration`과 `ontology-pack-validate`는 **서로 모름** (둘 다 Layer 2, 병렬)
- cli에서 둘을 조합만 가능

### R-3. 새 계층 추가 시 본 spec 갱신 필수
- 새 도구 통합(예: notion-integration)이 추가되면 Layer 2에 등록 + 본 spec 표 갱신
- 의존 방향이 기존 그래프를 역행하면 **PR rejection 근거**

### R-4. CLI는 경계 위반 허용되지 않음
- cli가 환경 조립자이지만 cli 내부에서도 라이브러리 경계는 그대로 유지
- 예: cli의 ontology 명령이 deterministic-label-registry 내부를 deep-import 금지 — public API만

## 기계적 강제

`packages/cli/src/lib/deterministic-label-boundary.test.ts`가 각 패키지의 `package.json` 의존을 스캔해 허용 목록과 비교. 위반 시 테스트 실패 + 파일:줄 출력. 본 spec의 의존 방향이 SSOT.

## CLAUDE.md 참조

본 spec의 의존 체인은 CLAUDE.md의 "패키지 규칙" 절에 한 줄로 요약됨:
```
문서 control-plane 체인: doc-envelope → (ralph-tui-integration | ontology-pack-validate | deterministic-label-registry) → @qa-sdk/cli
```

세션 컨텍스트 자동 주입 용도. 상세는 본 spec이 authoritative.

## 비목표

- 본 spec은 **라이브러리 API의 세부 계약**을 다루지 않음 — 각 패키지 README와 spec 2종 (`coordinate-stability`, `projection-determinism`)이 담당
- 본 spec은 **CLI 명령 표면**을 다루지 않음 — cli 내부 문서 영역
- 본 spec은 **기존 4 라이브러리 외 독립 관찰자**를 강제하지 않음 — 새 도구 통합은 Layer 2에 추가되는 것을 가정
