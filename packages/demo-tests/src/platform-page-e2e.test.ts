// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * platform-page-e2e.test.ts — 플랫폼 데모 페이지별 API 호출 e2e 검증
 *
 * 각 페이지가 의존하는 API 엔드포인트를 호출하여 응답 구조와 데이터 정합성을 확인한다.
 * 기존 platform-api-contract.test.ts(features/grants/scenario/mask)와 겹치지 않는
 * 엔드포인트를 중심으로 커버한다.
 *
 * ── 시나리오 ──────────────────────────────────────────────────────────────
 *
 * [PAGE-1] /api/health — 헬스체크
 * [PAGE-2] /api/service/cells — 서비스 인덱스 그리드 (service 페이지)
 * [PAGE-3] /api/service/decode/:value — 서비스 값 디코드 (service 상세)
 * [PAGE-4] /api/permission/cells — 권한 인덱스 그리드 (permission 페이지)
 * [PAGE-5] /api/permission/decode/:value — 권한 값 디코드 (permission 상세)
 * [PAGE-6] /api/event/cells — 이벤트 인덱스 그리드 (event 페이지)
 * [PAGE-7] /api/event/decode/:value — 이벤트 값 디코드 (event 상세)
 * [PAGE-8] /api/prefix-meta — Prefix 메타 조회 (prefix-meta 페이지)
 * [PAGE-9] /api/logs + /api/logs/seed — 로그 CRUD (logging 페이지)
 * [PAGE-10] 버전 전환 — v1~v4 전 버전 permission/event cells 호출
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  DEMO_ENVS,
  DEMO_REGIONS,
  DEMO_SVCS,
  DEMO_NSS,
  DEMO_PERM_SVC_VALUES,
  DEMO_EVT_SVC_VALUES,
  DEMO_INITIATORS,
  demoRolesFor,
  demoEventsFor,
  demoRoleStride,
  demoEvtStride,
  type DemoVer,
} from 'demo-snapshot';

// ── API Base ──────────────────────────────────────────────────────────────

const API_BASE = process.env.DEMO_API_BASE ?? 'http://localhost:8788';
const describeDemoApi = process.env.DEMO_API_BASE ? describe : describe.skip;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────

interface ServiceCellsResponse {
  xDim: string;
  yDim: string;
  xLabels: Array<{ id: string; ko: string; pos: number }>;
  yLabels: Array<{ id: string; ko: string; pos: number }>;
  fixed: Record<string, { id: string; ko: string; pos: number }>;
  cells: Array<{ xPos: number; yPos: number; value: number }>;
}

interface ServiceDecodeResponse {
  env: string;
  region: string;
  svc_name: string;
  namespace: string;
  envKo: string;
  regionKo: string;
  svcNameKo: string;
  namespaceKo: string;
}

interface PermCellsResponse {
  ver: string;
  roleStride: number;
  prefix: string;
  maxValue: number;
  svcLabels: Array<{ pos: number; svcValue: number; svcName: string }>;
  roleLabels: Array<{ pos: number; id: string; ko: string }>;
  cells: Array<{ svcPos: number; rolePos: number; value: number }>;
}

interface PermDecodeResponse {
  permValue: number;
  perm_svc: number;
  role: string;
  svc: { env: string; region: string; svc_name: string; namespace: string };
  address: string;
}

interface EventCellsResponse {
  ver: string;
  svcStride: number;
  prefix: string;
  maxValue: number;
  initiator: string;
  svcLabels: Array<{ pos: number; svcValue: number; svcName: string }>;
  eventLabels: Array<{ pos: number; id: string; ko: string }>;
  cells: Array<{ svcPos: number; evtPos: number; value: number }>;
}

interface EventDecodeResponse {
  evtValue: number;
  event_svc: number;
  event_name: string;
  initiator: string;
  svc: { env: string; region: string; svc_name: string; namespace: string };
  address: string;
}

interface PrefixMetaResponse {
  dims: Array<{
    id: string;
    type: 'dim';
    snapshots: Array<{ snapshotId: string; entries: number; capacity: number; headroom: number }>;
  }>;
  indices: Array<{
    id: string;
    type: 'index';
    dims: string[];
    versions: Array<{
      versionId: string;
      dims: Array<{ dimId: string; snapshotId: string; entries: number; capacity: number }>;
      totalCapacity: number;
      totalEntries: number;
      utilization: number;
    }>;
  }>;
}

interface LogsResponse {
  results: Array<{
    id: number;
    ts: string;
    level: string;
    svcAddr: number;
    permAddr: number | null;
    evtAddr: number | null;
    action: string;
    message: string;
    latencyMs: number;
    userId: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-1] /api/health
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-1] GET /api/health', () => {
  it('ok: true', async () => {
    const data = await api<{ ok: boolean }>('/api/health');
    expect(data.ok).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-2] /api/service/cells — service 페이지 그리드
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-2] GET /api/service/cells — 서비스 그리드', () => {
  let data: ServiceCellsResponse;

  beforeAll(async () => {
    data = await api<ServiceCellsResponse>('/api/service/cells?xDim=env&yDim=svc_name');
  });

  it('xLabels가 DEMO_ENVS와 일치', () => {
    expect(data.xLabels.map((l) => l.id)).toEqual([...DEMO_ENVS]);
  });

  it('yLabels가 DEMO_SVCS와 일치', () => {
    expect(data.yLabels.map((l) => l.id)).toEqual([...DEMO_SVCS]);
  });

  it('cell 수 = xLabels × yLabels', () => {
    expect(data.cells.length).toBe(DEMO_ENVS.length * DEMO_SVCS.length);
  });

  it('모든 cell value가 0 이상 정수', () => {
    for (const cell of data.cells) {
      expect(cell.value).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(cell.value)).toBe(true);
    }
  });

  it('fixed 차원 정보 포함', () => {
    expect(data.fixed).toHaveProperty('region');
    expect(data.fixed).toHaveProperty('namespace');
  });

  it('축 조합 변경: region × namespace', async () => {
    const alt = await api<ServiceCellsResponse>('/api/service/cells?xDim=region&yDim=namespace');
    expect(alt.xLabels.map((l) => l.id)).toEqual([...DEMO_REGIONS]);
    expect(alt.yLabels.map((l) => l.id)).toEqual([...DEMO_NSS]);
    expect(alt.cells.length).toBe(DEMO_REGIONS.length * DEMO_NSS.length);
  });

  it('잘못된 xDim → 400', async () => {
    const res = await fetch(`${API_BASE}/api/service/cells?xDim=invalid&yDim=region`);
    expect(res.status).toBe(400);
  });

  it('동일 축 → 400', async () => {
    const res = await fetch(`${API_BASE}/api/service/cells?xDim=env&yDim=env`);
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-3] /api/service/decode/:value — 서비스 디코드
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-3] GET /api/service/decode/:value', () => {
  it('value 0 → dev/asia/shopping-web/shop', async () => {
    const data = await api<ServiceDecodeResponse>('/api/service/decode/0');
    expect(data.env).toBe('dev');
    expect(data.region).toBe('asia');
    expect(data.svc_name).toBe('shopping-web');
    expect(data.namespace).toBe('shop');
  });

  it('value 40 → prod/asia/shopping-web/shop', async () => {
    const data = await api<ServiceDecodeResponse>('/api/service/decode/40');
    expect(data.env).toBe('prod');
    expect(data.region).toBe('asia');
    expect(data.svc_name).toBe('shopping-web');
    expect(data.namespace).toBe('shop');
  });

  it('decode → encode 라운드트립 — cells에서 추출한 값', async () => {
    const cells = await api<ServiceCellsResponse>('/api/service/cells?xDim=env&yDim=region');
    // 첫 번째 cell 디코드
    const firstValue = cells.cells[0].value;
    const decoded = await api<ServiceDecodeResponse>(`/api/service/decode/${firstValue}`);
    expect(DEMO_ENVS).toContain(decoded.env);
    expect(DEMO_REGIONS).toContain(decoded.region);
    expect(DEMO_SVCS).toContain(decoded.svc_name);
    expect(DEMO_NSS).toContain(decoded.namespace);
  });

  it('ko 라벨 포함', async () => {
    const data = await api<ServiceDecodeResponse>('/api/service/decode/0');
    expect(typeof data.envKo).toBe('string');
    expect(typeof data.regionKo).toBe('string');
    expect(typeof data.svcNameKo).toBe('string');
    expect(typeof data.namespaceKo).toBe('string');
    expect(data.envKo.length).toBeGreaterThan(0);
  });

  it('잘못된 값 → 400', async () => {
    const res = await fetch(`${API_BASE}/api/service/decode/abc`);
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-4] /api/permission/cells — permission 페이지 그리드
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-4] GET /api/permission/cells — 권한 그리드', () => {
  let data: PermCellsResponse;

  beforeAll(async () => {
    data = await api<PermCellsResponse>('/api/permission/cells?ver=v2');
  });

  it('svcLabels 수 = DEMO_PERM_SVC_VALUES', () => {
    expect(data.svcLabels.length).toBe(DEMO_PERM_SVC_VALUES.length);
  });

  it('roleLabels 수 = demoRolesFor(v2)', () => {
    expect(data.roleLabels.length).toBe(demoRolesFor('v2').length);
  });

  it('cell 수 = svcLabels × roleLabels', () => {
    expect(data.cells.length).toBe(data.svcLabels.length * data.roleLabels.length);
  });

  it('roleStride = demoRoleStride(v2)', () => {
    expect(data.roleStride).toBe(demoRoleStride('v2'));
  });

  it('cell value 공식: (svcPos-1) × stride + (rolePos-1)', () => {
    for (const cell of data.cells) {
      const expected = (cell.svcPos - 1) * data.roleStride + (cell.rolePos - 1);
      expect(cell.value).toBe(expected);
    }
  });

  it('prefix = permission:v2', () => {
    expect(data.prefix).toBe('permission:v2');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-5] /api/permission/decode/:value — 권한 디코드
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-5] GET /api/permission/decode/:value', () => {
  it('value 0 → 첫 번째 perm_svc + 첫 번째 role', async () => {
    const data = await api<PermDecodeResponse>('/api/permission/decode/0?ver=v2');
    expect(data.permValue).toBe(0);
    expect(data.perm_svc).toBe(DEMO_PERM_SVC_VALUES[0]);
    expect(data.role).toBe(demoRolesFor('v2')[0]);
    expect(data.address).toBe('permission:v2:0');
  });

  it('디코드된 svc가 유효한 차원 값 포함', async () => {
    const data = await api<PermDecodeResponse>('/api/permission/decode/5?ver=v2');
    expect(DEMO_ENVS).toContain(data.svc.env);
    expect(DEMO_REGIONS).toContain(data.svc.region);
    expect(DEMO_SVCS).toContain(data.svc.svc_name);
    expect(DEMO_NSS).toContain(data.svc.namespace);
  });

  it('잘못된 값 → 400', async () => {
    const res = await fetch(`${API_BASE}/api/permission/decode/xyz?ver=v2`);
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-6] /api/event/cells — event 페이지 그리드
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-6] GET /api/event/cells — 이벤트 그리드', () => {
  let data: EventCellsResponse;

  beforeAll(async () => {
    data = await api<EventCellsResponse>('/api/event/cells?ver=v2&initiator=web');
  });

  it('svcLabels 수 = DEMO_EVT_SVC_VALUES', () => {
    expect(data.svcLabels.length).toBe(DEMO_EVT_SVC_VALUES.length);
  });

  it('eventLabels 수 = demoEventsFor(v2)', () => {
    expect(data.eventLabels.length).toBe(demoEventsFor('v2').length);
  });

  it('cell 수 = svcLabels × eventLabels', () => {
    expect(data.cells.length).toBe(data.svcLabels.length * data.eventLabels.length);
  });

  it('svcStride = demoEvtStride(v2)', () => {
    expect(data.svcStride).toBe(demoEvtStride('v2'));
  });

  it('initiator가 web', () => {
    expect(data.initiator).toBe('web');
  });

  it('cell value 공식: (svcPos-1)×stride + (evtPos-1)×2 + (initiator-1)', () => {
    const initiatorPos = 1; // web=1
    for (const cell of data.cells) {
      const expected =
        (cell.svcPos - 1) * data.svcStride + (cell.evtPos - 1) * 2 + (initiatorPos - 1);
      expect(cell.value).toBe(expected);
    }
  });

  it('mobile initiator — 모든 cell value가 web+1', async () => {
    const mobile = await api<EventCellsResponse>('/api/event/cells?ver=v2&initiator=mobile');
    expect(mobile.initiator).toBe('mobile');
    for (let i = 0; i < data.cells.length; i++) {
      expect(mobile.cells[i].value).toBe(data.cells[i].value + 1);
    }
  });

  it('잘못된 initiator → 400', async () => {
    const res = await fetch(`${API_BASE}/api/event/cells?ver=v2&initiator=invalid`);
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-7] /api/event/decode/:value — 이벤트 디코드
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-7] GET /api/event/decode/:value', () => {
  it('value 0 → 첫 번째 event_svc + 첫 번째 event + web', async () => {
    const data = await api<EventDecodeResponse>('/api/event/decode/0?ver=v2');
    expect(data.evtValue).toBe(0);
    expect(data.event_svc).toBe(DEMO_EVT_SVC_VALUES[0]);
    expect(data.event_name).toBe(demoEventsFor('v2')[0]);
    expect(data.initiator).toBe('web');
    expect(data.address).toBe('event:v2:0');
  });

  it('value 1 → mobile initiator', async () => {
    const data = await api<EventDecodeResponse>('/api/event/decode/1?ver=v2');
    expect(data.initiator).toBe('mobile');
  });

  it('디코드된 svc가 유효', async () => {
    const data = await api<EventDecodeResponse>('/api/event/decode/0?ver=v2');
    expect(DEMO_ENVS).toContain(data.svc.env);
    expect(DEMO_SVCS).toContain(data.svc.svc_name);
  });

  it('잘못된 값 → 400', async () => {
    const res = await fetch(`${API_BASE}/api/event/decode/abc?ver=v2`);
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-8] /api/prefix-meta — prefix-meta 페이지
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-8] GET /api/prefix-meta — Prefix 메타', () => {
  let data: PrefixMetaResponse;

  beforeAll(async () => {
    data = await api<PrefixMetaResponse>('/api/prefix-meta');
  });

  it('dims 배열에 기본 차원 포함', () => {
    const dimIds = data.dims.map((d) => d.id);
    expect(dimIds).toContain('env');
    expect(dimIds).toContain('region');
    expect(dimIds).toContain('svc_name');
    expect(dimIds).toContain('namespace');
    expect(dimIds).toContain('role');
    expect(dimIds).toContain('event_name');
    expect(dimIds).toContain('initiator');
  });

  it('indices 배열에 service/permission/event 포함', () => {
    const indexIds = data.indices.map((i) => i.id);
    expect(indexIds).toContain('service');
    expect(indexIds).toContain('permission');
    expect(indexIds).toContain('event');
  });

  it('service index — dims가 존재하고 1개 이상', () => {
    const svc = data.indices.find((i) => i.id === 'service')!;
    expect(svc.dims.length).toBeGreaterThanOrEqual(1);
    // 구조 검증: dims는 문자열 배열
    for (const d of svc.dims) expect(typeof d).toBe('string');
  });

  it('모든 dim snapshot에 entries/capacity/headroom 존재', () => {
    for (const dim of data.dims) {
      for (const snap of dim.snapshots) {
        expect(typeof snap.entries).toBe('number');
        expect(typeof snap.capacity).toBe('number');
        expect(typeof snap.headroom).toBe('number');
        expect(snap.capacity).toBeGreaterThanOrEqual(snap.entries);
        expect(snap.headroom).toBe(snap.capacity - snap.entries);
      }
    }
  });

  it('index version에 totalCapacity/totalEntries/utilization 존재', () => {
    for (const idx of data.indices) {
      for (const ver of idx.versions) {
        expect(typeof ver.totalCapacity).toBe('number');
        expect(typeof ver.totalEntries).toBe('number');
        expect(typeof ver.utilization).toBe('number');
        expect(ver.totalCapacity).toBeGreaterThanOrEqual(ver.totalEntries);
        expect(ver.utilization).toBeGreaterThanOrEqual(0);
        expect(ver.utilization).toBeLessThanOrEqual(100);
      }
    }
  });

  it('env dim — v1 snapshot entries = DEMO_ENVS 수', () => {
    const env = data.dims.find((d) => d.id === 'env')!;
    const v1 = env.snapshots.find((s) => s.snapshotId === 'v1')!;
    expect(v1.entries).toBe(DEMO_ENVS.length);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-9] /api/logs — logging 페이지
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-9] /api/logs — 로그 CRUD', () => {
  beforeAll(async () => {
    // seed로 초기 데이터 생성
    await api('/api/logs/seed?ver=v2&clear=true', { method: 'POST' });
  });

  it('seed 후 로그 목록 조회 — results 배열 반환', async () => {
    const data = await api<LogsResponse>('/api/logs');
    expect(data.results.length).toBeGreaterThan(0);
    expect(typeof data.total).toBe('number');
    expect(data.total).toBeGreaterThan(0);
  });

  it('로그 항목 구조 검증', async () => {
    const data = await api<LogsResponse>('/api/logs?limit=1');
    const log = data.results[0];
    expect(typeof log.id).toBe('number');
    expect(typeof log.ts).toBe('string');
    expect(['DEBUG', 'INFO', 'WARN', 'ERROR']).toContain(log.level);
    expect(typeof log.svcAddr).toBe('number');
    expect(typeof log.action).toBe('string');
    expect(typeof log.message).toBe('string');
    expect(typeof log.userId).toBe('string');
  });

  it('level 필터 — INFO만', async () => {
    const data = await api<LogsResponse>('/api/logs?level=INFO');
    for (const log of data.results) {
      expect(log.level).toBe('INFO');
    }
  });

  it('level 필터 — ERROR,WARN', async () => {
    const data = await api<LogsResponse>('/api/logs?level=ERROR,WARN');
    for (const log of data.results) {
      expect(['ERROR', 'WARN']).toContain(log.level);
    }
  });

  it('limit/offset 페이징', async () => {
    const page1 = await api<LogsResponse>('/api/logs?limit=2&offset=0');
    const page2 = await api<LogsResponse>('/api/logs?limit=2&offset=2');
    expect(page1.results.length).toBeLessThanOrEqual(2);
    expect(page2.results.length).toBeLessThanOrEqual(2);
    // 첫 페이지와 두 번째 페이지 id가 겹치지 않음
    const ids1 = new Set(page1.results.map((l) => l.id));
    for (const log of page2.results) {
      expect(ids1.has(log.id)).toBe(false);
    }
  });

  it('로그 생성 (POST /api/logs)', async () => {
    const before = await api<LogsResponse>('/api/logs');
    const beforeTotal = before.total;

    await api('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'INFO',
        svcAddr: 40,
        action: 'test.e2e',
        message: 'e2e 테스트 로그',
        userId: 'u-test',
      }),
    });

    const after = await api<LogsResponse>('/api/logs');
    expect(after.total).toBe(beforeTotal + 1);
  });

  it('잘못된 level → 400', async () => {
    const res = await fetch(`${API_BASE}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'INVALID',
        svcAddr: 40,
        action: 'test',
        message: 'test',
        userId: 'u-test',
      }),
    });
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  [PAGE-10] 버전 전환 — v1~v4 전 버전 cells 호출
// ═════════════════════════════════════════════════════════════════════════════

describeDemoApi('[PAGE-10] 전 버전(v1~v4) cells 호출', () => {
  const VERS: DemoVer[] = ['v1', 'v2', 'v3', 'v4'];

  for (const ver of VERS) {
    describe(`permission/cells?ver=${ver}`, () => {
      it(`roleLabels 수 = demoRolesFor(${ver})`, async () => {
        const data = await api<PermCellsResponse>(`/api/permission/cells?ver=${ver}`);
        expect(data.roleLabels.length).toBe(demoRolesFor(ver).length);
        expect(data.roleStride).toBe(demoRoleStride(ver));
        expect(data.prefix).toBe(`permission:${ver}`);
      });
    });

    describe(`event/cells?ver=${ver}`, () => {
      it(`eventLabels 수 = demoEventsFor(${ver})`, async () => {
        const data = await api<EventCellsResponse>(`/api/event/cells?ver=${ver}&initiator=web`);
        expect(data.eventLabels.length).toBe(demoEventsFor(ver).length);
        expect(data.svcStride).toBe(demoEvtStride(ver));
        expect(data.prefix).toBe(`event:${ver}`);
      });
    });
  }
});
