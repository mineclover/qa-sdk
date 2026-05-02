# RLS Enforce 운영 Runbook — Plan 15e

> FORCE ROW LEVEL SECURITY 적용 전·후 체크리스트와 장애 대응 절차.

## 1. 적용 전 체크리스트

- [ ] Plan 15a helpers 배포 — `pnpm qa-sdk rls preflight` 의 `helperFunctionsOk=true`
- [ ] Plan 15b 정책 배포 — `policyOk=true`
- [ ] Plan 15c 세션 미들웨어가 모든 서비스에 부착됨 (auth-api, ingest-server, audit-browser-api, approval-api)
- [ ] Plan 15d shadow 기간 완료 + `shadow-analysis-*.md` 제출 + divergence 비율 < 0.1%
- [ ] `QA_SDK_ADMIN_BYPASS_PASSWORD` 환경 변수 sops 에 저장
- [ ] 백업: `pg_dump qa_sdk > backup-pre-enforce.sql` 선행

## 2. 적용 절차

```bash
cd /path/to/qa-sdk/packages/infra-engine
export QA_SDK_ADMIN_BYPASS_PASSWORD=$(sops -d .env.docker | grep '^QA_SDK_ADMIN_BYPASS_PASSWORD=' | cut -d= -f2)
./scripts/apply-rls-enforce.sh
```

출력에서 다음 확인:
- 6 테이블의 FORCE 상태 = `t`
- `qa_admin_bypass` role BYPASSRLS = `t`

## 3. 적용 직후 검증 (30분 내)

```bash
# 1. CLI status
pnpm qa-sdk rls status

# 2. 회귀 테스트
QA_TEST_PG=1 QA_TEST_PG_FORCE=1 QA_TEST_PG_PASSWORD=... QA_TEST_PG_AUTH_APP_PASSWORD=... \
  pnpm --filter resource-policy-store --filter audit-recorder-store test -- rls-regression

# 3. 시뮬레이션 시나리오 4 재실행 (Plan 13b)
SIM_SCENARIO_INPROC=1 pnpm --filter @qa-sdk/sim-scenarios test -- scenario-4
```

- 회귀 테스트 FAIL → 즉시 rollback
- 시나리오 4 의 application deny (403) 는 유지, DB 쿼리 단계에서도 invisible 확인

## 4. 장애 대응 — rollback

### 시나리오 A: 일부 서비스가 "row not found" 500 에러 대량 발생

```bash
cd /path/to/qa-sdk/packages/infra-engine
./scripts/rollback-rls-enforce.sh
```

적용 후:
- FORCE 해제 → 기존 session-based admin bypass 경로 복귀
- shadow mode 로 되돌아가 false positive 재분석
- 원인 분석: bitmap 발급 누락 / claim 누락 / interceptor 부착 누락 등

### 시나리오 B: qa_admin_bypass 비밀번호 노출 의심

```sql
-- superuser 로 접속
ALTER ROLE qa_admin_bypass PASSWORD '<new-password>';
-- sops 재암호화
```

## 5. 후속 모니터링

- 주간 `qa-sdk shadow report --hours 168` 실행 — 여전히 shadow 기록은 수행됨. divergence=0 이어야 정상.
- `audit.rls_shadow_decisions` 에 application_decision='allow' + rls_would_decision='deny' 가 급증하면 운영 이상.
- pgAudit 로그 — `qa_admin_bypass` 사용 빈도 모니터링. 일반 CLI 가 bypass 쓰지 않도록.

## 6. 용어

- **FORCE**: `ALTER TABLE ... FORCE ROW LEVEL SECURITY` — table owner 도 정책 대상.
- **BYPASSRLS**: role 권한. `ALTER ROLE ... BYPASSRLS`. FORCE 여부 무관하게 RLS 우회.
- **pgAudit**: PostgreSQL session/object-level 감사 extension.

## 7. 참조
- spec: `docs/specs/authorization-ontology/authorization-ontology-rls-enforcement.spec.md`
- plan: 15a, 15b, 15c, 15d, 15e
- apply SQL: `packages/infra-engine/init/qa-sdk-db-enforce.sql`
- rollback SQL: `packages/infra-engine/init/qa-sdk-db-rollback-enforce.sql`
