---
def:
  id: spec-convention
  type: knowledge
  knowledge_kind: convention
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  tags: [entry-point, structural, testing]
  links:
    - target: guides-system
      type: refines
sources:
  - docs/specs/system/doc-type-convention.spec.md
  - docs/specs/system/doc-type-convention.cases.md
  - docs/specs/system/test-md-convention.rule.md
  - docs/specs/definition-catalog/definition-management.spec.md
  - docs/specs/definition-catalog/definition-frontmatter-metadata-system.spec.md
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/frontmatter.test.ts
---
# Spec Convention

## 목적 ^purpose

스펙 문서 작성 컨벤션. frontmatter 구조, 마커 사용법, scope-aspect 판별 기준을 정의한다.


스펙은 `docs/specs/` 디렉토리에서 **관심사(concern)** 단위로 중앙 관리한다.

## 구조

```text
docs/specs/
  README.md                  ← 전체 인덱스 + 패키지→스펙 매핑표
  data-model/                ← 시스템 공유 타입 & 포트
  event-vocabulary/          ← 이벤트 어휘 (Core Pattern, Payload Guide, Graph Hint)
  collection/                ← SDK 수집 계층
  pipeline/                  ← 엔진 파이프라인 + ingest 오케스트레이션
  server/
    ingest/                  ← Ingest Server 엔드포인트
    registry/                ← Registry Server/Client
  storage/                   ← DB 스키마 + 어댑터
  infra/                     ← 로깅 등 인프라 도구
```

## 스펙 파일 포맷

```markdown
# <진입점 이름>

> 한줄 요약

## 상태

implemented | draft | planned | hold

## 인터페이스

(public API, port contract, endpoint 정의)

## 동작

(입력 → 출력, side effects, 에러 케이스)

## 제약 조건

(불변 조건, 경계 조건, 성능 제약)
```

## 역할 분리

| 문서 | 위치 | 역할 |
|---|---|---|
| `docs/specs/*.spec.md` | 중앙 | 기능 정의 (what this does) |
| `docs/architecture-decisions.md` | 중앙 | 횡단 설계 결정 (why we decided) |
| `tasks/prd.json` | 루트 | 구현 스토리 (what to build now) — 수시 갱신 |
| `packages/<pkg>/specs/README.md` | 각 패키지 | 중앙 스펙 위치로의 리다이렉트 |
| `README.md` | 각 패키지 | 사용법 가이드 (how to use) |

## 관심사 배치 기준

| 관심사 | 대상 | 예시 |
|---|---|---|
| `data-model/` | 2개 이상 패키지가 공유하는 타입 + 포트 | EventRecord, RuntimeGraph, VerdictStore |
| `event-vocabulary/` | 이벤트 정의, payload 규격, 그래프 힌트 | CoreEventDef, PayloadFieldGuide, GraphHint |
| `collection/` | SDK 클라이언트 사이드 수집 | QaLogger, TraceContext, masking |
| `pipeline/` | 데이터 처리 파이프라인 (엔진 + 오케스트레이션) | reconstruct, matchViaPathMatcher, ingest Phase 1/2 |
| `server/<name>/` | 서버 엔드포인트 | REST API, SSE, health check |
| `storage/` | DB 스키마 + 어댑터 구현 | PostgreSQL 테이블, Drizzle adapter |
| `infra/` | 횡단 인프라 도구 | pino 로거 |

## 패키지 → 스펙 매핑

코드 변경 시 어떤 스펙을 업데이트해야 하는지 찾는 참조표.
전체 매핑은 [docs/specs/README.md](specs/README.md) 참조.

## 규칙

1. 스펙은 **현재 구현 상태**를 반영한다 (aspirational 금지)
2. `draft` 상태의 스펙은 인터페이스만 정의하고 동작은 TBD 가능
3. 구현이 변경되면 스펙도 함께 업데이트한다
4. 하나의 스펙 파일이 길어지면 진입점을 더 세분화한다
5. 새 패키지를 추가할 때 — 해당 관심사 폴더에 스펙 추가 + README.md 인덱스 갱신
6. 패키지의 `specs/README.md`는 **리다이렉트 전용** — 스펙 내용을 직접 넣지 않는다

## 연쇄 수정 가이드

공유 타입 변경 시 영향받는 스펙 목록:

| 변경 대상 | 연쇄 확인 스펙 |
|---|---|
| EventRecord | `data-model/record` → `storage/schema` → `pipeline/ingest` → `pipeline/pipeline` |
| RuntimeGraph | `data-model/graph` → `storage/schema` → `pipeline/pipeline` → `pipeline/ingest` |
| VerdictReport | `data-model/verdict` → `storage/schema` → `server/ingest/verdict` → `pipeline/pipeline` |
| ScenarioSpec | `server/ingest/scenario` → `pipeline/pipeline` → `storage/schema` |
| CoreEventDef | `event-vocabulary/core-pattern` → `event-vocabulary/graph-hint` → `pipeline/pipeline` |
