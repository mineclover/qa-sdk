-- Enterprise PM 시뮬 — 역할 부여 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_role_assignments 테이블
--   (user_id TEXT, role_id TEXT,
--    scope_type TEXT CHECK (scope_type IN ('global','department','project')),
--    scope_id TEXT,
--    assigned_at TEXT NOT NULL,
--    PRIMARY KEY (user_id, role_id, scope_type, scope_id))
--
-- scope_id 처리:
--   - global scope는 '' (빈 문자열) 사용 — composite PK의 NULL 비교 이슈 회피.
--   - department scope는 'd-eng', 'd-mkt' 등 auth_departments.id 참조.
--   - project scope는 동적 생성 — 시나리오 2 (프로젝트 생성)가 자동 시드.

INSERT INTO sim.auth_role_assignments (user_id, role_id, scope_type, scope_id, assigned_at) VALUES
  -- ── global scope ──
  ('u-admin-001', 'r-admin', 'global', '', '2026-04-22T00:00:00Z'),
  ('u-cfo-001',   'r-cfo',   'global', '', '2026-04-22T00:00:00Z'),

  -- ── department scope (director 6명) ──
  ('u-dir-eng-001', 'r-director', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-dir-mkt-001', 'r-director', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-dir-fin-001', 'r-director', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-dir-ops-001', 'r-director', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-dir-sal-001', 'r-director', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-dir-hr-001',  'r-director', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),

  -- ── department scope (approver) ──
  ('u-eng-appr-001', 'r-approver', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-mkt-appr-001', 'r-approver', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-fin-appr-001', 'r-approver', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-ops-appr-001', 'r-approver', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-sal-appr-001', 'r-approver', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-hr-appr-001',  'r-approver', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),

  -- ── department scope (finance) ──
  ('u-fin-001', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-fin-002', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-fin-003', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-fin-004', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),

  -- ── department scope (project_manager — 자기 부서 접근용) ──
  ('u-alice-001',   'r-project-manager', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-pm-002',  'r-project-manager', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-bob-001',     'r-project-manager', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-ops-pm-001',  'r-project-manager', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-sal-pm-001',  'r-project-manager', 'department', 'd-sal', '2026-04-22T00:00:00Z'),

  -- ── department scope (member) ──
  ('u-eng-m-001', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-002', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-003', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-004', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-005', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-006', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-007', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-008', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-001', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-002', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-003', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-004', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-005', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-ops-m-001', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-002', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-003', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-004', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-005', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-sal-m-001', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-002', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-003', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-004', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-005', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-hr-m-001',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),
  ('u-hr-m-002',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),
  ('u-hr-m-003',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),
  ('u-hr-m-004',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z')
ON CONFLICT DO NOTHING;
