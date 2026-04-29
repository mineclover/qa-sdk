-- read replica 토폴로지 부트스트랩 — qa-sdk-db (primary) 측
-- Plan A 단계 4 Task 4.1: replicator role + physical replication slot
--
-- 환경 변수 → psql 변수 로드 (psql 14+ \getenv) — qa-sdk-db.sql 컨벤션 동일
\getenv replicator_password QA_SDK_REPLICATOR_PASSWORD

-- replicator role: streaming replication 전용 LOGIN
-- (실제 패스워드는 .env.docker의 QA_SDK_REPLICATOR_PASSWORD 환경에서 inject됨)
--
-- 주의: psql 변수(:'name')는 dollar-quoted block($$...$$) 내부에서 치환되지 않음.
-- /docker-entrypoint-initdb.d/ 는 빈 PGDATA 에서만 1회 실행되므로 IF NOT EXISTS 가드 불필요.
-- qa-sdk-db.sql 의 CREATE ROLE 패턴과 동일하게 평문 statement 로 작성.
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD :'replicator_password';

-- physical replication slot — qa-sdk-db-replica 가 사용
SELECT pg_create_physical_replication_slot('sim_read_replica_slot')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_replication_slots WHERE slot_name = 'sim_read_replica_slot'
);
