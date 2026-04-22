-- Enterprise PM 시뮬 — 역할 7개 seed
-- 의존: Plan 11a의 sim.role 테이블 (id BIGSERIAL, name TEXT UNIQUE, description TEXT, created_at TIMESTAMPTZ DEFAULT now())

INSERT INTO sim.role (id, name, description) VALUES
  (1, 'admin',           '시스템 관리자 — global scope, 전체 권한'),
  (2, 'cfo',             '재무 책임자 — global scope, 모든 budget 승인'),
  (3, 'director',        '부서장 — department scope, 부서 내 모든 리소스'),
  (4, 'project_manager', '프로젝트 매니저 — project scope, 프로젝트 lead'),
  (5, 'approver',        '승인자 — department scope, 일반 승인 단계'),
  (6, 'member',          '구성원 — project scope, 일반 작업'),
  (7, 'finance',         '재무 담당자 — department scope (Finance), 비용 처리')
ON CONFLICT (id) DO NOTHING;

SELECT setval('sim.role_id_seq', (SELECT MAX(id) FROM sim.role));
