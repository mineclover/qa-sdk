-- Enterprise PM 시뮬 — 부서 7개 seed
-- 의존: Plan 11a의 sim.department 테이블 (id BIGSERIAL, name TEXT, parent_id BIGINT NULL, manager_id BIGINT NULL, created_at TIMESTAMPTZ DEFAULT now())

INSERT INTO sim.department (id, name, parent_id, manager_id) VALUES
  (1, 'Executive',           NULL, NULL),
  (2, 'Engineering',          1,   NULL),
  (3, 'Marketing',            1,   NULL),
  (4, 'Finance',              1,   NULL),
  (5, 'Operations',           1,   NULL),
  (6, 'Sales',                1,   NULL),
  (7, 'Human Resources',      1,   NULL)
ON CONFLICT (id) DO NOTHING;

-- BIGSERIAL sequence를 수동 INSERT 이후로 진행 — 다음 INSERT가 id=8부터
SELECT setval('sim.department_id_seq', (SELECT MAX(id) FROM sim.department));
