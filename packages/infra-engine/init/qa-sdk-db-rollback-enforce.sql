-- 긴급 rollback — FORCE 만 제거. ENABLE 은 유지 (DISABLE 금지, spec §주의사항).
-- 실행 조건: shadow mode 복귀가 필요한 사고 상황. 반드시 runbook 승인 후.

\c qa_sdk

ALTER TABLE auth.resource_policies        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_entries           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observations       NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.key_observation_prefixes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ingest.event_records          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.rls_shadow_decisions    NO FORCE ROW LEVEL SECURITY;

-- qa_admin_bypass 역할은 유지 — 운영 CLI 가 계속 사용.
-- FORCE 만 해제되었으므로 table owner(postgres) + BYPASSRLS role 은 정책 통과.
-- 일반 auth_app / audit_app 등은 여전히 정책 적용됨.
