-- Enterprise PM 시뮬 — 역할 7개 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_roles 테이블
--   (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL,
--    scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
--    default_mask_hex TEXT NOT NULL, created_at TEXT NOT NULL)
--
-- id 컨벤션: "r-<slug>" (kebab-case).
-- default_mask_hex: Plan 11a의 computeUserBits + DisjointUnionIndex가 파생. AUTH_BITMASK_BYTES=2.

INSERT INTO sim.auth_roles (id, name, scope_type, default_mask_hex, created_at) VALUES
  ('r-admin',           'admin',           'global',     'ffff', '2026-04-22T00:00:00Z'),
  ('r-cfo',             'cfo',             'global',     'ffff', '2026-04-22T00:00:00Z'),
  ('r-director',        'director',        'department', '0101', '2026-04-22T00:00:00Z'),
  ('r-project-manager', 'project_manager', 'project',    '0100', '2026-04-22T00:00:00Z'),
  ('r-approver',        'approver',        'department', '0001', '2026-04-22T00:00:00Z'),
  ('r-member',          'member',          'project',    '0100', '2026-04-22T00:00:00Z'),
  ('r-finance',         'finance',         'department', '0101', '2026-04-22T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
