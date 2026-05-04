-- read replica 토폴로지 부트스트랩 — qa-sdk-db (primary) 측
-- Plan A 단계 4 Task 4.1: replicator role + physical replication slot
--
-- 목적
-- - 신규 PGDATA(빈 볼륨) 첫 부팅: /docker-entrypoint-initdb.d/ 가 자동 실행.
-- - 기존 PGDATA(기존 볼륨) 재적용: scripts/apply-replication-runtime.sh 로
--   동일 SQL 을 명시 실행. 따라서 모든 statement 는 idempotent 해야 한다.
-- - .env 의 QA_SDK_REPLICATOR_PASSWORD 가 변경되면 ALTER 로 동기화.
--
-- 환경 변수 → psql 변수 로드 (psql 14+ \getenv) — qa-sdk-db.sql 컨벤션 동일
\getenv replicator_password QA_SDK_REPLICATOR_PASSWORD

-- psql 변수는 dollar-quoted block($$...$$) 내부에서 치환되지 않으므로
-- 세션 GUC 로 옮긴 뒤 DO 블록에서 current_setting() 으로 읽는다.
SELECT set_config('qa_sdk.replicator_password', :'replicator_password', false);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') THEN
    EXECUTE format('CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD %L',
                   current_setting('qa_sdk.replicator_password', true));
  ELSE
    -- 기존 role 이 있으면 패스워드/속성을 현재 env 값으로 동기화 (재적용 시 .env 변경 흡수).
    EXECUTE format('ALTER ROLE replicator WITH REPLICATION LOGIN PASSWORD %L',
                   current_setting('qa_sdk.replicator_password', true));
  END IF;
END
$$;

-- physical replication slot — qa-sdk-db-replica 가 사용 (idempotent)
SELECT pg_create_physical_replication_slot('sim_read_replica_slot')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_replication_slots WHERE slot_name = 'sim_read_replica_slot'
);
