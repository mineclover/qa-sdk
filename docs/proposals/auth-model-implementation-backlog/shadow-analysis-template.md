---
lifecycle: draft
role: template
sources:
  - docs/specs/audit-recorder-store/audit-recorder-store-rls-shadow.spec.md
  - packages/audit-recorder-store/src/pg/shadow-recorder.ts
  - packages/audit-recorder-store/src/pg/shadow-schema.ts
---

# RLS Shadow 분석 리포트 — <기간>

> Plan 15d → Plan 15e 진입 전제. 본 템플릿을 복사해 `shadow-analysis-<yyyy-mm-dd>.md` 로 제출.

## 1. 기간 + 환경
- 기간: <YYYY-MM-DD ~ YYYY-MM-DD>
- 환경: production / staging
- qa-sdk-db 버전 + helper 함수 해시 (select md5(prosrc) from pg_proc ...)

## 2. 트래픽 규모
- `shadow report --hours <N>` 출력
- 총 record 수 / divergence 수 / divergence 비율 (%)

## 3. 도메인별 divergence
- `auth.resource_policies` — divergence X 건, 주 deny_reason Y
- `audit.audit_entries`   — ...
- `ingest.key_observations` — ...
- `ingest.event_records`   — ...

## 4. 주요 false positive (application allow vs RLS would deny)
| id | resource_table | operation | deny_reason | 사용자 action | 분석 |
|----|----|----|----|----|----|
| ... | ... | ... | ... | ... | bitmap 발급 누락 / policy 범위 오류 / context 주입 누락 등 |

## 5. 조치 항목 (enforce 전 해결 필요)
- [ ] bitmap 발급 로직 X 수정 (permission-engine)
- [ ] JWT claim 에 tenantId 항시 포함 (auth-api)
- [ ] admin 경로 role='admin' 주입 (CLI)
- [ ] ...

## 6. enforce 진입 Go/NoGo
- Go 조건: divergence 비율 < 0.1% + 모든 조치 완료 + admin bypass 경로 감사 확인
- 현재 상태: <Go | NoGo | Hold — 이유>

## 7. 참조
- spec: docs/specs/authorization-ontology/authorization-ontology-rls-enforcement.spec.md
- implementation spec: docs/specs/audit-recorder-store/audit-recorder-store-rls-shadow.spec.md
- plan: Plan 15d, Plan 15e
- shadow schema: audit.rls_shadow_decisions
