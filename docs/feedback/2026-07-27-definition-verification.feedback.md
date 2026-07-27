# FB-2026-07-27-01 — 문서 검증 evidence 수집·판정 구조

| 항목 | 값 |
|---|---|
| 상태 | `accepted` |
| 우선순위 | P1 |
| 등록일 | 2026-07-27 |
| 출처 | 문서 작성·검증 구조 리뷰 |
| 대상 | definition-catalog, definition-service, CLI docs-control-plane |

## 피드백

문서 검증의 목적은 타당하지만, 현재 수집기와 검증 명령이 같은 정보를 여러 read model로
재구성한다. 결과적으로 작업 트리·SQLite·CLI adapter 사이의 freshness와 의미론이 어긋날
수 있고, closure 피드백이 구조화된 증거보다 키워드에 의존한다.

## 근거

- raw scanner: [`frontmatter.ts`](../../packages/definition-catalog/src/frontmatter.ts)의 `scanAndBuild()`
- code reference 수집: [`code-references.ts`](../../packages/definition-catalog/src/code-references.ts)의 `collectCodeReferences()`
- DB 동기화: [`scanner.ts`](../../packages/definition-service/src/sync/scanner.ts)의 `syncDocsToDb()`
- closure 조립: [`docs.ts`](../../packages/cli/src/commands/docs.ts)의 `buildClosureResult()`
- Markdown adapter: [`definition-markdown.ts`](../../packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts)

## 확인된 문제

1. **중복 수집** — `scan-audit`, `def sync`, docs-control-plane adapter가 Markdown을 각각 스캔·파싱한다.
2. **snapshot 불일치** — `scan-audit`/closure는 최신 파일을, `def validate`/`find-by-file`은 마지막 sync DB를 본다. 출력에 기준 revision이 드러나지 않는다.
3. **연결과 소유권 혼합** — coverage는 `sources:`, `@def.doc`, `@def.boundary`를 모두 linked로 세지만, owner 확정은 `@def.boundary`만 가능하다.
4. **heuristic closure** — error/permission/observability concern은 키워드 탐색으로 추론한다. 현재 signal text는 주로 ID·경로·metadata·links이므로 본문 의미나 실제 실행 증거를 직접 판정하지 않는다.
5. **증거 범위 부족** — test/cases/BDD는 문서 존재·연결을 보며, 실제 test/build 실행 결과와 결합하지 않는다. source-map 스캐너도 현재 `packages/` 중심이다.

## 채택한 방향

검증 도구는 공통 **Evidence Snapshot**을 입력으로 사용한다. Snapshot은 작업 트리 또는 저장된 revision에서
문서 사실, 문서 관계, source map, boundary claim, rule use, test evidence를 한 번 정규화한 결과다.

- `definition-catalog`: 사실 추출·정규화와 순수 검증 규칙
- `definition-service`: snapshot 저장, revision/freshness, 조회
- CLI: 수집 구현을 중복하지 않고 profile별 결과를 표시
- profile: structural, ownership, closure, execution-evidence
- source relation: `implements`, `verifies`, `context` 등 typed relation으로 분리하고 `boundary`만 owner claim으로 유지
- concern은 키워드가 아니라 선언된 concern과 요구 evidence kind를 대조

## 범위와 비범위

포함:

- raw/DB/closure read model의 공통 snapshot화
- source-map과 ownership coverage의 의미 분리
- closure evidence의 typed contract화
- 검증 결과가 참조한 snapshot revision 표기

제외:

- 현재 CLI 명령 즉시 제거 또는 이름 변경
- 모든 기존 문서에 evidence metadata를 일괄 강제
- test/build 실행기를 새로 만드는 것 자체

## 후속 작업

| 우선순위 | 작업 | 완료 기준 |
|---|---|---|
| P0 | 현재 명령의 JSON 출력과 기대 결과를 characterization fixture로 고정 | 기존 동작 차이를 의도적으로 비교 가능 |
| P1 | `EvidenceSnapshot` schema와 공통 collector 설계 | raw/DB 결과가 같은 revision을 식별 |
| P1 | ownership coverage와 generic source-link coverage 분리 | linked와 authoritative-owned 지표를 별도 출력 |
| P2 | typed source/evidence relation 도입 | `sources:`와 boundary의 관계 의미가 명시됨 |
| P2 | closure concern을 declaration/evidence contract로 전환 | keyword-only warning 제거 또는 compatibility mode 격리 |
| P3 | test/typecheck/build 결과를 execution evidence로 연결 | 문서 존재와 실행 통과를 별도 판정 |

## 종료 조건

- 후속 plan/spec가 이 feedback을 `traces_to` 또는 명시 링크로 참조한다.
- 원인이 된 중복 collector와 stale snapshot 판정이 제거되거나 compatibility 범위가 문서화된다.
- ownership·closure·execution-evidence 결과가 서로 다른 의미를 가진다는 점이 CLI와 문서에 드러난다.
