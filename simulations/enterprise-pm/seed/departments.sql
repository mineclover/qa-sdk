-- Enterprise PM 시뮬 — 부서 7개 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_departments 테이블
--   (id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT,
--    manager_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
--
-- id 컨벤션: "d-<slug>" (kebab-case 부서 slug).
-- manager_id는 users.sql이 적용된 후 별도 UPDATE 단계에서 채움 (FK 참조 회피).

INSERT INTO sim.auth_departments (id, name, parent_id, manager_id, created_at, updated_at) VALUES
  ('d-exec', 'Executive',       NULL,    NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-eng',  'Engineering',     'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-mkt',  'Marketing',       'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-fin',  'Finance',         'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-ops',  'Operations',      'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-sal',  'Sales',           'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-hr',   'Human Resources', 'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
