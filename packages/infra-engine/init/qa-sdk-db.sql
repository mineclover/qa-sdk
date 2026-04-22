-- qa-sdk PG 부트스트랩 — postgres 컨테이너 첫 부팅 시 자동 실행
-- pg-migration-design.md §3 (schema 격리)와 동기 유지

-- 환경 변수 → psql 변수 로드 (psql 14+ \getenv)
\getenv qa_auth_pw       QA_SDK_AUTH_PASSWORD
\getenv qa_audit_pw      QA_SDK_AUDIT_PASSWORD
\getenv qa_ingest_pw     QA_SDK_INGEST_PASSWORD
\getenv qa_decision_pw   QA_SDK_DECISION_PASSWORD
\getenv qa_definition_pw QA_SDK_DEFINITION_PASSWORD
\getenv qa_admin_pw      QA_SDK_ADMIN_PASSWORD
\getenv qa_sim_pw        QA_SDK_SIM_PASSWORD

-- 1. 운영 DB + 테스트 DB
CREATE DATABASE qa_sdk;
CREATE DATABASE qa_sdk_test;

-- 2. 운영 DB에 5개 도메인 schema + role 생성
\c qa_sdk

CREATE SCHEMA auth;
CREATE SCHEMA audit;
CREATE SCHEMA ingest;
CREATE SCHEMA decision;
CREATE SCHEMA definition;

-- 시뮬레이션 schema (Plan 09b — Phase 4 enterprise-pm)
CREATE SCHEMA sim;

-- 도메인별 application role (각 schema 안에서만 동작)
-- 비밀번호는 .env.docker → docker entrypoint에서 환경 변수로 주입
CREATE ROLE auth_app       WITH LOGIN PASSWORD :'qa_auth_pw';
CREATE ROLE audit_app      WITH LOGIN PASSWORD :'qa_audit_pw';
CREATE ROLE ingest_app     WITH LOGIN PASSWORD :'qa_ingest_pw';
CREATE ROLE decision_app   WITH LOGIN PASSWORD :'qa_decision_pw';
CREATE ROLE definition_app WITH LOGIN PASSWORD :'qa_definition_pw';

-- cross-domain 분석 role (admin)
CREATE ROLE qa_admin WITH LOGIN PASSWORD :'qa_admin_pw';

-- 시뮬 application role (9개 NestJS 서비스가 공유)
-- 도메인별 분리는 시뮬 검증 가치 없음 — 권한 검증은 application-level AccessChecker로 한다
CREATE ROLE sim_app WITH LOGIN PASSWORD :'qa_sim_pw';

-- schema-level GRANT
GRANT USAGE ON SCHEMA auth       TO auth_app;
GRANT USAGE ON SCHEMA audit      TO audit_app;
GRANT USAGE ON SCHEMA ingest     TO ingest_app;
GRANT USAGE ON SCHEMA decision   TO decision_app;
GRANT USAGE ON SCHEMA definition TO definition_app;
GRANT USAGE ON SCHEMA sim        TO sim_app;

GRANT USAGE ON SCHEMA auth, audit, ingest, decision, definition, sim TO qa_admin;

-- 테이블이 아직 없으므로 ALTER DEFAULT PRIVILEGES로 미래 테이블도 자동 권한 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA auth       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit      GRANT SELECT, INSERT                ON TABLES TO audit_app;  -- audit는 write-mostly, update/delete 권한 제외
ALTER DEFAULT PRIVILEGES IN SCHEMA ingest     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ingest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA decision   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO decision_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA definition GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO definition_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sim        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sim_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sim        GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sim_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth, audit, ingest, decision, definition, sim GRANT SELECT ON TABLES TO qa_admin;

-- 3. 테스트 DB도 동일 schema 구조 (각 테스트가 random schema를 만들지만 도메인 schema 기본 보유)
\c qa_sdk_test

CREATE SCHEMA auth;
CREATE SCHEMA audit;
CREATE SCHEMA ingest;
CREATE SCHEMA decision;
CREATE SCHEMA definition;
CREATE SCHEMA sim;

-- 테스트 DB는 qa_admin이 모든 권한 (random schema 생성·drop)
GRANT ALL ON SCHEMA auth, audit, ingest, decision, definition, sim TO qa_admin;
GRANT CREATE ON DATABASE qa_sdk_test TO qa_admin;
