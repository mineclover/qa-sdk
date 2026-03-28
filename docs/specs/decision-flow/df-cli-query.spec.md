---
def:
  id: df-cli-query
  address: def_document:v1:3233
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: qa-sdk-cli
  tags: [decision, cli]
  links:
    - target: df-cli-persistence
      type: depends_on
    - target: df-system
      type: implements
---
# CLI 의사결정 조회 명령

## 목적 ^purpose

`flow lookup/history/verdict/judge` 4개 CLI 명령으로 의사결정 이력을 조회하고 판정을 기록한다. SQLite에서 세션 간 영속된 데이터를 읽는다.

## 구성 ^overview

- **flow lookup \<keyword\>**: context 값 + schemaId로 키워드 검색. 관련 정책, 의사결정 단위 표시
- **flow history [schema-id]**: 완료된 인스턴스 이력 (최신순, 소요 시간 포함)
- **flow verdict \<instance-id\>**: 여정(gate별 선택+근거+소요시간) + 의사결정 단위(주제/목적/기준) + 판정 상태
- **flow judge \<instance-id\>**: 성공 기준별 충족 여부 입력 → verdict 영속. 중복 판정 차단

## flow lookup \<keyword\> ^lookup

키워드로 의사결정 이력을 종합 검색한다.

- **구현**: `SqliteInstanceStore.search(keyword)` — `schema_id LIKE` 또는 `context LIKE` (최대 50건)
- **출력 항목**: 인스턴스 ID, 스키마, 상태, 완료 일시, 코어 gate 선택
- 코어 gate 판별: 스키마의 `gate.weight === "core"`인 선택만 추출하여 별도 표시
- **관련 정책**: 등록된 정책 중 `name` 또는 `rationale`에 키워드가 포함된 것을 같이 표시
- **의사결정 단위**: `DEV_DECISION_UNITS`에서 해당 스키마의 주제/목적/성공기준 안내
- 정렬: 완료 시각 내림차순 (최신 우선), 최대 20건 표시

## flow history [schema-id] ^history

완료된 인스턴스 이력을 테이블 형태로 표시한다.

- **옵션**: `--limit N` (기본 20), `--status <status>` (필터)
- **구현**: `SqliteInstanceStore.recent(limit, schemaId)` — 최신순 정렬
- **출력 컬럼**: ID, Schema, Status, 좌표(Addr), 소요 시간, 시각
- 소요 시간: `completedAt - startedAt` 계산. 진행 중이면 "진행중" 표시
- 시간 포맷: `formatDuration()` — ms를 초/분/시간으로 변환

## flow verdict \<instance-id\> ^verdict

특정 인스턴스의 전체 결정 여정과 판정 상태를 상세 표시한다.

- **조회 순서**: 엔진 인메모리 → SQLite fallback
- **시간 분석**:
  - 총 소요 시간: `completedAt - startedAt`
  - 완료→판정 지연: `verdict.judgedAt - completedAt`
  - gate별 체류 시간: `selection.durationMs` (각 gate에서 결정까지 걸린 시간)
- **여정 표시**: gate별 `선택 → branchId`, confidence, evidence kind, 체류 시간
  - 코어 gate: `★` 마커, structural: `◆`, tactical: `·`
- **의사결정 단위**: `schema.unit` 또는 `DEV_DECISION_UNITS[schemaId]`에서 주제/목적/성공기준/fallback 표시
- **판정 표시**: verdict가 있으면 `verdict/reason/criteriaResults` 표시. 없으면 `flow judge` 명령 안내

## flow judge \<instance-id\> ^judge

완료된 인스턴스에 대해 성공/실패/보류 판정을 기록한다.

- **전제 조건**: `status === "completed"` 필수. 이미 verdict가 있으면 중복 판정 차단
- **입력 방식**: `--result '[{"criterion":"...","met":true,"evidence":"..."}]'` JSON 배열
  - `--result` 없이 호출하면 성공 기준 목록을 안내하고 JSON 템플릿 출력
- **판정 로직**: `narrative.ts`의 `evaluateDecision()` 패턴
  - 전부 충족 → `success`
  - 전부 미충족 → `failure`
  - 일부 충족 → `deferred` (추가 검증 필요)
- **영속**: 판정 결과를 FlowInstance.verdict에 기록 → `SqliteInstanceStore.save()` 호출
- **시간 분리**: 과정(active→completed)과 결론(verdict)의 시간축이 다름을 시스템이 인식

## 공통 사항 ^common

- 모든 명령은 `ensureInit()`를 호출하여 스키마/정책 등록 + SQLite 인스턴스 복원을 보장
- `findActiveInstance()` — 활성 인스턴스 자동 탐색: 엔진 인메모리 → SQLite fallback
- 시간 비교: `@qa-sdk/core`의 `compareTimestamps()`, `normalizeTimestamp()` 사용
