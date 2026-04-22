-- Enterprise PM 시뮬 — 사용자 50명 seed
-- 의존: Plan 11a의 sim.user 테이블 (id BIGSERIAL, email TEXT UNIQUE, display_name TEXT, department_id BIGINT REFERENCES sim.department(id), primary_role_id BIGINT REFERENCES sim.role(id), created_at TIMESTAMPTZ DEFAULT now())
--
-- 분포:
--   Executive   (id=1): 2명 (admin 1, cfo 1)
--   Engineering (id=2): 12명 (director 1, PM 2, approver 1, member 8)
--   Marketing   (id=3): 8명 (director 1, PM 1, approver 1, member 5)
--   Finance     (id=4): 6명 (director 1, finance 4, approver 1)
--   Operations  (id=5): 8명 (director 1, PM 1, approver 1, member 5)
--   Sales       (id=6): 8명 (director 1, PM 1, approver 1, member 5)
--   HR          (id=7): 6명 (director 1, approver 1, member 4)

INSERT INTO sim.user (id, email, display_name, department_id, primary_role_id) VALUES
  -- Executive (2)
  (1,  'alice.admin@sim.local',     'Alice Kim',      1, 1),
  (2,  'bob.cfo@sim.local',         'Bob Park',       1, 2),

  -- Engineering (12)
  (3,  'carol.eng.dir@sim.local',   'Carol Lee',      2, 3),
  (4,  'dave.eng.pm1@sim.local',    'Dave Choi',      2, 4),
  (5,  'eve.eng.pm2@sim.local',     'Eve Han',        2, 4),
  (6,  'frank.eng.app@sim.local',   'Frank Yoon',     2, 5),
  (7,  'grace.eng.m1@sim.local',    'Grace Jung',     2, 6),
  (8,  'henry.eng.m2@sim.local',    'Henry Kang',     2, 6),
  (9,  'iris.eng.m3@sim.local',     'Iris Bae',       2, 6),
  (10, 'jack.eng.m4@sim.local',     'Jack Lim',       2, 6),
  (11, 'kate.eng.m5@sim.local',     'Kate Seo',       2, 6),
  (12, 'leo.eng.m6@sim.local',      'Leo Hwang',      2, 6),
  (13, 'mia.eng.m7@sim.local',      'Mia Cho',        2, 6),
  (14, 'noah.eng.m8@sim.local',     'Noah Jeon',      2, 6),

  -- Marketing (8)
  (15, 'olivia.mkt.dir@sim.local',  'Olivia Sim',     3, 3),
  (16, 'peter.mkt.pm@sim.local',    'Peter Oh',       3, 4),
  (17, 'quinn.mkt.app@sim.local',   'Quinn Yu',       3, 5),
  (18, 'rita.mkt.m1@sim.local',     'Rita Moon',      3, 6),
  (19, 'sam.mkt.m2@sim.local',      'Sam Ko',         3, 6),
  (20, 'tina.mkt.m3@sim.local',     'Tina Ryu',       3, 6),
  (21, 'ulysses.mkt.m4@sim.local',  'Ulysses Min',    3, 6),
  (22, 'vera.mkt.m5@sim.local',     'Vera An',        3, 6),

  -- Finance (6)
  (23, 'walt.fin.dir@sim.local',    'Walt Shin',      4, 3),
  (24, 'xena.fin1@sim.local',       'Xena Joo',       4, 7),
  (25, 'yuki.fin2@sim.local',       'Yuki Park',      4, 7),
  (26, 'zach.fin3@sim.local',       'Zach Lee',       4, 7),
  (27, 'amy.fin4@sim.local',        'Amy Kim',        4, 7),
  (28, 'ben.fin.app@sim.local',     'Ben Choi',       4, 5),

  -- Operations (8)
  (29, 'cleo.ops.dir@sim.local',    'Cleo Han',       5, 3),
  (30, 'dan.ops.pm@sim.local',      'Dan Park',       5, 4),
  (31, 'ellen.ops.app@sim.local',   'Ellen Kang',     5, 5),
  (32, 'finn.ops.m1@sim.local',     'Finn Yoon',      5, 6),
  (33, 'gina.ops.m2@sim.local',     'Gina Jung',      5, 6),
  (34, 'hugo.ops.m3@sim.local',     'Hugo Bae',       5, 6),
  (35, 'isla.ops.m4@sim.local',     'Isla Lim',       5, 6),
  (36, 'jude.ops.m5@sim.local',     'Jude Seo',       5, 6),

  -- Sales (8)
  (37, 'kara.sal.dir@sim.local',    'Kara Hwang',     6, 3),
  (38, 'liam.sal.pm@sim.local',     'Liam Cho',       6, 4),
  (39, 'maya.sal.app@sim.local',    'Maya Jeon',      6, 5),
  (40, 'nico.sal.m1@sim.local',     'Nico Sim',       6, 6),
  (41, 'opal.sal.m2@sim.local',     'Opal Oh',        6, 6),
  (42, 'paul.sal.m3@sim.local',     'Paul Yu',        6, 6),
  (43, 'qara.sal.m4@sim.local',     'Qara Moon',      6, 6),
  (44, 'rose.sal.m5@sim.local',     'Rose Ko',        6, 6),

  -- HR (6)
  (45, 'sven.hr.dir@sim.local',     'Sven Ryu',       7, 3),
  (46, 'tara.hr.app@sim.local',     'Tara Min',       7, 5),
  (47, 'umar.hr.m1@sim.local',      'Umar An',        7, 6),
  (48, 'vita.hr.m2@sim.local',      'Vita Shin',      7, 6),
  (49, 'wade.hr.m3@sim.local',      'Wade Joo',       7, 6),
  (50, 'xan.hr.m4@sim.local',       'Xan Park',       7, 6)
ON CONFLICT (id) DO NOTHING;

SELECT setval('sim.user_id_seq', (SELECT MAX(id) FROM sim.user));
