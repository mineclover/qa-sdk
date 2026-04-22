-- Enterprise PM 시뮬 — 사용자 52명 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_users 테이블
--   (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
--    department_id TEXT, primary_role_id TEXT,
--    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
--
-- id 컨벤션: "u-<slug>-<seq>" (u-alice-001, u-bob-001, ...).
--
-- Plan 13 시나리오 fixture (본 52명 안에 포함):
--   alice@example.com     → u-alice-001   (d-eng, r-project-manager) — 시나리오 1/2/3/5/7/8
--   bob@example.com       → u-bob-001     (d-mkt, r-project-manager) — 시나리오 4
--   admin@example.com     → u-admin-001   (d-exec, r-admin)          — 시나리오 8 권한 변경 trigger
--   director-eng@example.com → u-dir-eng-001 (d-eng, r-director)     — 시나리오 5 2단계
--
-- password는 sim.auth_users schema에 없음 — Plan 11a의 /auth/authenticate가
-- email 존재 여부만 검증 (simulation scope). 시나리오 runner의 password 필드는
-- 무시됨.

INSERT INTO sim.auth_users (id, email, display_name, department_id, primary_role_id, created_at, updated_at) VALUES
  ('u-admin-001', 'admin@example.com',        'System Admin',   'd-exec', 'r-admin', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-cfo-001',   'cfo@example.com',          'Chief Finance',  'd-exec', 'r-cfo',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  ('u-dir-eng-001',  'director-eng@example.com',  'Carol Lee',      'd-eng', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-alice-001',    'alice@example.com',         'Alice Kim',      'd-eng', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-pm-002',   'dave.eng.pm2@example.com',  'Dave Choi',      'd-eng', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-appr-001', 'frank.eng.appr@example.com','Frank Yoon',     'd-eng', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-001',    'grace.eng@example.com',     'Grace Jung',     'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-002',    'henry.eng@example.com',     'Henry Kang',     'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-003',    'iris.eng@example.com',      'Iris Bae',       'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-004',    'jack.eng@example.com',      'Jack Lim',       'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-005',    'kate.eng@example.com',      'Kate Seo',       'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-006',    'leo.eng@example.com',       'Leo Hwang',      'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-007',    'mia.eng@example.com',       'Mia Cho',        'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-008',    'noah.eng@example.com',      'Noah Jeon',      'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  ('u-dir-mkt-001',  'director-mkt@example.com',  'Olivia Sim',     'd-mkt', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-bob-001',      'bob@example.com',           'Bob Park',       'd-mkt', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-appr-001', 'quinn.mkt@example.com',     'Quinn Yu',       'd-mkt', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-001',    'rita.mkt@example.com',      'Rita Moon',      'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-002',    'sam.mkt@example.com',       'Sam Ko',         'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-003',    'tina.mkt@example.com',      'Tina Ryu',       'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-004',    'ulysses.mkt@example.com',   'Ulysses Min',    'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-005',    'vera.mkt@example.com',      'Vera An',        'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  ('u-dir-fin-001',  'director-fin@example.com',  'Walt Shin',      'd-fin', 'r-director', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-001',      'xena.fin@example.com',      'Xena Joo',       'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-002',      'yuki.fin@example.com',      'Yuki Park',      'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-003',      'zach.fin@example.com',      'Zach Lee',       'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-004',      'amy.fin@example.com',       'Amy Kim',        'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-appr-001', 'ben.fin.appr@example.com',  'Ben Choi',       'd-fin', 'r-approver', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  ('u-dir-ops-001',  'director-ops@example.com',  'Cleo Han',       'd-ops', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-pm-001',   'dan.ops.pm@example.com',    'Dan Park',       'd-ops', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-appr-001', 'ellen.ops.appr@example.com','Ellen Kang',     'd-ops', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-001',    'finn.ops@example.com',      'Finn Yoon',      'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-002',    'gina.ops@example.com',      'Gina Jung',      'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-003',    'hugo.ops@example.com',      'Hugo Bae',       'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-004',    'isla.ops@example.com',      'Isla Lim',       'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-005',    'jude.ops@example.com',      'Jude Seo',       'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  ('u-dir-sal-001',  'director-sal@example.com',  'Kara Hwang',     'd-sal', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-pm-001',   'liam.sal.pm@example.com',   'Liam Cho',       'd-sal', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-appr-001', 'maya.sal.appr@example.com', 'Maya Jeon',      'd-sal', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-001',    'nico.sal@example.com',      'Nico Sim',       'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-002',    'opal.sal@example.com',      'Opal Oh',        'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-003',    'paul.sal@example.com',      'Paul Yu',        'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-004',    'qara.sal@example.com',      'Qara Moon',      'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-005',    'rose.sal@example.com',      'Rose Ko',        'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  ('u-dir-hr-001',  'director-hr@example.com',  'Sven Ryu',       'd-hr', 'r-director', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-appr-001', 'tara.hr.appr@example.com', 'Tara Min',       'd-hr', 'r-approver', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-001',    'umar.hr@example.com',      'Umar An',        'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-002',    'vita.hr@example.com',      'Vita Shin',      'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-003',    'wade.hr@example.com',      'Wade Joo',       'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-004',    'xan.hr@example.com',       'Xan Park',       'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ── 부서 manager_id 갱신 (user 생성 후 FK 충족) ──
UPDATE sim.auth_departments SET manager_id = 'u-admin-001',       updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-exec';
UPDATE sim.auth_departments SET manager_id = 'u-dir-eng-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-eng';
UPDATE sim.auth_departments SET manager_id = 'u-dir-mkt-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-mkt';
UPDATE sim.auth_departments SET manager_id = 'u-dir-fin-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-fin';
UPDATE sim.auth_departments SET manager_id = 'u-dir-ops-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-ops';
UPDATE sim.auth_departments SET manager_id = 'u-dir-sal-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-sal';
UPDATE sim.auth_departments SET manager_id = 'u-dir-hr-001',      updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-hr';
