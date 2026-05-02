-- qa-sdk Phase 5 enforce — Plan 15e
-- shadow 분석 통과 후 수동 적용. init 자동 실행 대상 아님.
-- 적용 전제: Plan 15a helpers + Plan 15b policies 모두 배포 완료.

\c qa_sdk

\getenv qa_admin_bypass_pw QA_SDK_ADMIN_BYPASS_PASSWORD

-- 1. qa_admin_bypass role 신설 — BYPASSRLS + 감사 대상
--    일반 admin (qa_admin) 은 RLS 대상 (Plan 15b 의 app.role='admin' GUC 경로 사용).
--    마이그레이션·backup·긴급 운영은 본 role 로 로그인.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qa_admin_bypass') THEN
    CREATE ROLE qa_admin_bypass WITH LOGIN PASSWORD :'qa_admin_bypass_pw' BYPASSRLS;
  ELSE
    ALTER ROLE qa_admin_bypass BYPASSRLS;
  END IF;
END$$;

-- 2. qa_admin_bypass 에 5 schema read/write 모두 허가 (마이그레이션용)
GRANT USAGE ON SCHEMA auth, audit, ingest, decision, definition TO qa_admin_bypass;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth, audit, ingest, decision, definition TO qa_admin_bypass;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth, audit, ingest, decision, definition GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qa_admin_bypass;

-- 3. FORCE 적용 — 4 테이블 (+ shadow 테이블)
ALTER TABLE auth.resource_policies        FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_entries           FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observations       FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observation_prefixes FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.event_records          FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.rls_shadow_decisions    FORCE ROW LEVEL SECURITY;

-- 4. (선택) pgAudit 활성 — qa_admin_bypass 의 모든 쿼리 로깅.
--    pgAudit extension 이 컨테이너에 없으면 CREATE EXTENSION 실패 → 경고 후 skip.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgaudit') THEN
    CREATE EXTENSION IF NOT EXISTS pgaudit;
    EXECUTE $a$ALTER ROLE qa_admin_bypass SET pgaudit.log = 'all'$a$;
    RAISE NOTICE 'pgAudit 활성화 완료 — qa_admin_bypass 쿼리 전체 감사';
  ELSE
    RAISE NOTICE 'pgAudit 미설치 — 건너뜀. 운영 도입 시 postgres 이미지를 pgaudit 포함으로 교체.';
  END IF;
END$$;

-- 5. BYPASSRLS 확인 쿼리 (스크립트가 파싱하는 sentinel)
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('qa_admin_bypass','qa_admin','auth_app','audit_app','ingest_app') ORDER BY rolname;
