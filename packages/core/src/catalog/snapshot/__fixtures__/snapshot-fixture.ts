// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { Catalog } from '../../catalog.types.js';

/** snapshot 테스트 주입 데이터 — env는 v2에서 entry 1개 append, capacity 유지 */
export const SNAPSHOT_FIXTURE: Catalog = {
  id: 'fixture',
  name: 'fixture',
  axes: {
    env: {
      id: 'env',
      name: 'env',
      versions: {
        v1: { entries: ['dev', 'prod'], capacity: 4, ko: { dev: '개발', prod: '운영' } },
        v2: { entries: ['dev', 'prod', 'stage'], capacity: 4 },
      },
    },
    role: {
      id: 'role',
      name: 'role',
      versions: { v1: { entries: ['viewer', 'editor', 'admin'] } },
    },
    qa_module: { id: 'qa_module', name: 'qa_module', versions: { v1: { entries: ['m1'] } } },
  },
  prefixes: {
    svc: {
      id: 'svc',
      name: 'svc',
      labels: ['env', 'role'],
      dims: { env: { kind: 'axis', axisId: 'env' }, role: { kind: 'axis', axisId: 'role' } },
      versions: [
        { version: 'v1', axisVersions: { env: 'v1', role: 'v1' } },
        { version: 'v2', axisVersions: { env: 'v2', role: 'v1' } },
      ],
    },
    /** R-11 재현: v2에서 추가된 qa_module이 v1 axisVersions에 없다 */
    build_event: {
      id: 'build_event',
      name: 'build_event',
      labels: ['env', 'qa_module'],
      dims: {
        env: { kind: 'axis', axisId: 'env' },
        qa_module: { kind: 'axis', axisId: 'qa_module' },
      },
      versions: [
        { version: 'v1', axisVersions: { env: 'v1' } },
        { version: 'v2', axisVersions: { env: 'v1', qa_module: 'v1' } },
      ],
    },
  },
};
