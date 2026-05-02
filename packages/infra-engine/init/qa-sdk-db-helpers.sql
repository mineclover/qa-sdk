-- qa-sdk RLS helper functions — spec §2 Helper functions 구현
-- 첫 부팅 시: 00-qa-sdk-db.sql 이후 실행 → auth schema 존재 확정.
-- 재적용 시: CREATE OR REPLACE로 idempotent (기존 volume 유지한 채 수동 재적용 가능).

\c qa_sdk

-- 1. auth.current_user_id — 세션에 주입된 app.user_id 반환.
--    미주입 시 NULL (default deny 유도). TEXT 그대로 반환.
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.user_id', true) $$;

-- 2. auth.has_bit — session에 주입된 bitmap_mask(hex TEXT)에서 pos 번째 비트 조회.
--    bytea 비교는 get_byte 로 byte 단위 꺼낸 뒤 bit AND.
--    mask 미주입·길이 부족 시 false → default deny.
CREATE OR REPLACE FUNCTION auth.has_bit(pos INTEGER) RETURNS BOOLEAN
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  hex_mask TEXT;
  mask BYTEA;
  byte_idx INTEGER := pos / 8;
  bit_idx INTEGER := pos % 8;
BEGIN
  hex_mask := current_setting('app.bitmap_mask', true);
  IF hex_mask IS NULL OR hex_mask = '' THEN
    RETURN false;
  END IF;
  BEGIN
    mask := decode(hex_mask, 'hex');
  EXCEPTION WHEN others THEN
    -- 잘못된 hex 주입은 default deny
    RETURN false;
  END;
  IF octet_length(mask) <= byte_idx THEN
    RETURN false;
  END IF;
  RETURN (get_byte(mask, byte_idx) & (1 << bit_idx)) <> 0;
END;
$$;

-- 3. auth.resource_state — 특정 resource_id 의 state 조회.
--    미존재 리소스는 NULL (정책 조건식에서 NULL은 false로 취급 → default deny).
--    plpgsql + EXECUTE 로 late-binding — auth.resource_policies 테이블이
--    helper 정의 시점에 없어도 생성 가능 (Plan 05b PG adapter 미배포 시 대비).
CREATE OR REPLACE FUNCTION auth.resource_state(rid TEXT) RETURNS TEXT
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  result TEXT;
BEGIN
  EXECUTE 'SELECT state FROM auth.resource_policies WHERE resource_id = $1'
    INTO result USING rid;
  RETURN result;
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
  -- 테이블 미존재 시 NULL — default deny 유도.
  RETURN NULL;
END;
$$;

-- 4. auth.current_role_tag — session의 app.role 값 (admin bypass 식별 용).
--    'admin' 일 때만 bypass 정책 매칭, 그 외엔 NULL.
--    spec §4 Admin bypass.
CREATE OR REPLACE FUNCTION auth.current_role_tag() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.role', true) $$;

-- 5. EXECUTE grant — 도메인 app role + qa_admin 모두 helper 호출 가능.
--    helper 정의 수정 자체는 superuser(postgres) 만 가능 → 경계 분리.
GRANT EXECUTE ON FUNCTION auth.current_user_id()          TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;
GRANT EXECUTE ON FUNCTION auth.has_bit(INTEGER)           TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;
GRANT EXECUTE ON FUNCTION auth.resource_state(TEXT)       TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;
GRANT EXECUTE ON FUNCTION auth.current_role_tag()         TO auth_app, audit_app, ingest_app, decision_app, definition_app, qa_admin;

-- 6. qa_sdk_test DB 도 helper 동일 정의 (random schema 테스트 격리 지원).
\c qa_sdk_test

CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.user_id', true) $$;

CREATE OR REPLACE FUNCTION auth.has_bit(pos INTEGER) RETURNS BOOLEAN
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  hex_mask TEXT;
  mask BYTEA;
  byte_idx INTEGER := pos / 8;
  bit_idx INTEGER := pos % 8;
BEGIN
  hex_mask := current_setting('app.bitmap_mask', true);
  IF hex_mask IS NULL OR hex_mask = '' THEN RETURN false; END IF;
  BEGIN
    mask := decode(hex_mask, 'hex');
  EXCEPTION WHEN others THEN RETURN false;
  END;
  IF octet_length(mask) <= byte_idx THEN RETURN false; END IF;
  RETURN (get_byte(mask, byte_idx) & (1 << bit_idx)) <> 0;
END;
$$;

CREATE OR REPLACE FUNCTION auth.resource_state(rid TEXT) RETURNS TEXT
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  result TEXT;
BEGIN
  EXECUTE 'SELECT state FROM auth.resource_policies WHERE resource_id = $1'
    INTO result USING rid;
  RETURN result;
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION auth.current_role_tag() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.role', true) $$;

GRANT EXECUTE ON FUNCTION auth.current_user_id()          TO qa_admin;
GRANT EXECUTE ON FUNCTION auth.has_bit(INTEGER)           TO qa_admin;
GRANT EXECUTE ON FUNCTION auth.resource_state(TEXT)       TO qa_admin;
GRANT EXECUTE ON FUNCTION auth.current_role_tag()         TO qa_admin;
