-- Enterprise PM 시뮬 — 역할 부여 seed
-- 의존: Plan 11a의 sim.role_assignment 테이블
--   (id BIGSERIAL, user_id BIGINT REFERENCES sim.user(id), role_id BIGINT REFERENCES sim.role(id),
--    scope_type TEXT CHECK (scope_type IN ('global','department','project')),
--    scope_id BIGINT NULL,
--    granted_at TIMESTAMPTZ DEFAULT now())
--
-- 디자인 §3 권한 hierarchy 5계층:
--   global     — 모든 리소스 (admin, cfo)
--   department — 부서 전체 (director, finance, dept_approver)
--   project    — 단일 프로젝트 (PM, member) — 프로젝트는 Plan 11 후 별도 시드

INSERT INTO sim.role_assignment (user_id, role_id, scope_type, scope_id) VALUES
  -- ── global scope ──
  (1,  1, 'global',     NULL),  -- Alice → admin
  (2,  2, 'global',     NULL),  -- Bob → cfo

  -- ── department scope (director) ──
  (3,  3, 'department', 2),     -- Carol → Engineering director
  (15, 3, 'department', 3),     -- Olivia → Marketing director
  (23, 3, 'department', 4),     -- Walt → Finance director
  (29, 3, 'department', 5),     -- Cleo → Operations director
  (37, 3, 'department', 6),     -- Kara → Sales director
  (45, 3, 'department', 7),     -- Sven → HR director

  -- ── department scope (approver) ──
  (6,  5, 'department', 2),     -- Frank → Eng approver
  (17, 5, 'department', 3),     -- Quinn → Mkt approver
  (28, 5, 'department', 4),     -- Ben → Fin approver
  (31, 5, 'department', 5),     -- Ellen → Ops approver
  (39, 5, 'department', 6),     -- Maya → Sal approver
  (46, 5, 'department', 7),     -- Tara → HR approver

  -- ── department scope (finance) ──
  (24, 7, 'department', 4),     -- Xena → Fin
  (25, 7, 'department', 4),     -- Yuki → Fin
  (26, 7, 'department', 4),     -- Zach → Fin
  (27, 7, 'department', 4),     -- Amy → Fin

  -- ── department scope (PM이 자기 부서 접근권 — 프로젝트 외 리소스 조회용) ──
  (4,  4, 'department', 2),     -- Dave → Eng PM
  (5,  4, 'department', 2),     -- Eve → Eng PM
  (16, 4, 'department', 3),     -- Peter → Mkt PM
  (30, 4, 'department', 5),     -- Dan → Ops PM
  (38, 4, 'department', 6),     -- Liam → Sal PM

  -- ── department scope (member 역할 — 자기 부서 일반 조회) ──
  (7,  6, 'department', 2),  (8,  6, 'department', 2),  (9,  6, 'department', 2),
  (10, 6, 'department', 2),  (11, 6, 'department', 2),  (12, 6, 'department', 2),
  (13, 6, 'department', 2),  (14, 6, 'department', 2),
  (18, 6, 'department', 3),  (19, 6, 'department', 3),  (20, 6, 'department', 3),
  (21, 6, 'department', 3),  (22, 6, 'department', 3),
  (32, 6, 'department', 5),  (33, 6, 'department', 5),  (34, 6, 'department', 5),
  (35, 6, 'department', 5),  (36, 6, 'department', 5),
  (40, 6, 'department', 6),  (41, 6, 'department', 6),  (42, 6, 'department', 6),
  (43, 6, 'department', 6),  (44, 6, 'department', 6),
  (47, 6, 'department', 7),  (48, 6, 'department', 7),  (49, 6, 'department', 7),
  (50, 6, 'department', 7)
ON CONFLICT DO NOTHING;
