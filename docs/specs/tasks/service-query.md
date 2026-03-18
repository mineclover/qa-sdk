# query-service 구축

> 관계형 질의 + 정책 해소 + gate 통합을 중앙 질의 서비스로 노출한다.

## 흐름 심볼

`[S2]` resolve · `[S2→S4]` 규칙 CRUD · `[A5]` match-ranges / compose-query

## 현재 상태

| 항목 | 라이브러리 (🔧) | 서비스 (📋) |
|---|---|---|
| RelationalEngine | ✅ 226줄, 12 facade 메서드 | ❌ |
| PolicyResolver | ✅ 170줄, 4전략 | ❌ |
| CrossIndexQuery | ✅ 206줄, 5단계 composeQuery | ❌ |
| VersionQuery | ✅ 202줄 | ❌ |
| PolicyRule 영속화 | ❌ | ❌ |
| Gate 통합 | gateAwareResolve 함수 있음 | ❌ |

## 선행 조건

- **service-gate** — gateFilterRanges / gateAwareResolve 연동
- infra-sql-adapters H-2 (MigrationStore SQL) — 버전 횡단 시

## spec.todo 매핑

F-1, F-2, F-3, F-4, F-5

## 작업 항목

| # | spec.todo | 작업 | 설명 |
|---|---|---|---|
| 1 | F-1 | PolicyRule 저장소 인터페이스 | `StoredPolicyRule`, CRUD 포트, Memory 어댑터 |
| 2 | F-1 | PolicyRule SQL 어댑터 | Drizzle 테이블 + 어댑터 |
| 3 | F-2 | 규칙 CRUD 엔드포인트 | POST/GET/PUT/DELETE `/rules` + detectConflicts 사전 검증 (409) |
| 4 | F-3 | 질의 엔드포인트 5종 | `/resolve`, `/match-ranges`, `/compose-query`, `/query-across-versions`, `/resolve-relation` |
| 5 | F-4 | Gate Service 클라이언트 | `gateMode` / `withGate` 파라미터 → gate-service RPC 호출 |
| 6 | F-4 | fail-open / fail-closed 전략 | gate 조회 실패 시 동작 선택 |
| 7 | F-5 | 규칙 버전 마이그레이션 | index version 변경 시 translateConstraint로 규칙 자동 변환 (우선순위 낮음) |
| 8 | — | 테스트 | 규칙 CRUD + 질의 + gate 통합 E2E |

## 분할 가능성

spec.todo에서 언급된 대로, 규모가 커지면 분할 고려:

| 서브서비스 | 포함 엔드포인트 | 흐름 |
|---|---|---|
| rule-store | 규칙 CRUD, detectConflicts | S2→S4 |
| query-runtime | resolve, match-ranges, compose-query | S2, A5 |

현재 단일 서비스로 시작하고, 부하 패턴에 따라 분리.

## 산출물

- `packages/query-service/` 패키지
- PolicyRule 저장소 (Memory + SQL)
- 규칙 CRUD 5종 + 질의 5종 = 10개 엔드포인트
- Gate 통합 클라이언트
- coordinate-query.spec.md `[S2]` `[A5]` → 📋 에서 ✅로 전환
