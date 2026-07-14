// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * Registry DSL — Prefix 참조 구조 + 버전 고정 주소
 *
 * ── 핵심 컨셉 ──
 *
 *   1. 모든 prefix는 capacity를 가진다 (leaf든 composite든)
 *   2. composite는 다른 prefix를 "참조"할 뿐, 재귀적으로 펼치지 않는다
 *      → composite의 dim이 leaf든 composite든 capacity만 사용하므로 재귀 없음
 *   3. 주소는 schema:version에 고정된다
 *      → 같은 정수라도 버전이 다르면 다른 좌표를 가리킴
 *      → 버전이 capacity(=stride)를 결정하므로 주소의 의미는 버전에 종속
 *
 * ── 참조 깊이와 재귀 ──
 *
 *   composite A = [leaf X, leaf Y]           → A.capacity = X.cap × Y.cap
 *   composite B = [composite A, leaf Z]      → B.capacity = A.cap × Z.cap
 *   composite C = [composite B, composite A] → C.capacity = B.cap × A.cap
 *
 *   resolve(C)는 B.capacity와 A.capacity만 참조한다.
 *   B 내부의 X, Y를 다시 탐색하지 않는다.
 *   → 참조 깊이는 1단계. 재귀가 아니라 capacity 조회일 뿐.
 *
 * ── 버전과 주소 고정 ──
 *
 *   schema v1: role(cap=8), action(cap=4) → perm shape=[8,4] stride=[4,1]
 *   schema v2: role(cap=16), action(cap=4) → perm shape=[16,4] stride=[4,1]
 *
 *   v1에서 encode([3,2]) = 10, v2에서 encode([3,2]) = 10 (stride 동일이면)
 *   v1에서 encode([3,2]) = 10, v2에서 decode(10) = [3,2] (stride 동일이면 호환)
 *
 *   하지만 stride가 바뀌면:
 *   v1: role(8), action(4) → stride=[4,1] → encode([3,2])=10
 *   v2: role(8), action(8) → stride=[8,1] → encode([3,2])=18 ≠ 10
 *   → 같은 좌표가 다른 주소 → 버전 없이 주소는 무의미
 */

import { describe, it, expect } from 'vitest';
import { WeightedIndex, calcWeights } from 'weighted-index';

// ── 공통 타입 ───────────────────────────────────────────────

interface EnumAxis {
  readonly id: string;
  readonly entries: readonly string[];
  readonly capacity: number;
}

interface LeafPrefix {
  readonly kind: 'leaf';
  readonly id: string;
  readonly axis: EnumAxis;
}

interface CompositePrefix {
  readonly kind: 'composite';
  readonly id: string;
  readonly dims: readonly string[];
}

type Prefix = LeafPrefix | CompositePrefix;

interface Schema {
  readonly id: string;
  readonly version: string;
  readonly prefixes: readonly Prefix[];
}

interface Resolved {
  readonly id: string;
  readonly kind: 'leaf' | 'composite';
  readonly capacity: number;
  readonly shape: readonly number[];
  readonly strides: readonly number[];
}

function resolve(schema: Schema): Map<string, Resolved> {
  const map = new Map<string, Prefix>();
  for (const p of schema.prefixes) map.set(p.id, p);

  const result = new Map<string, Resolved>();
  const resolving = new Set<string>();

  const go = (id: string): Resolved => {
    if (result.has(id)) return result.get(id)!;
    if (resolving.has(id)) throw new Error(`순환 참조: ${id}`);
    resolving.add(id);

    const p = map.get(id)!;
    if (p.kind === 'leaf') {
      const r: Resolved = {
        id,
        kind: 'leaf',
        capacity: p.axis.capacity,
        shape: [p.axis.capacity],
        strides: [1],
      };
      result.set(id, r);
      resolving.delete(id);
      return r;
    }

    // composite: 각 dim의 capacity만 참조 — 내부를 펼치지 않음
    const dimCaps = p.dims.map((d) => go(d).capacity);
    const strides = calcWeights(dimCaps);
    const r: Resolved = {
      id,
      kind: 'composite',
      capacity: dimCaps.reduce((a, b) => a * b, 1),
      shape: dimCaps,
      strides,
    };
    result.set(id, r);
    resolving.delete(id);
    return r;
  };

  for (const p of schema.prefixes) go(p.id);
  return result;
}

// ── 팩토리 ──────────────────────────────────────────────────

const ax = (id: string, entries: readonly string[], capacity: number): EnumAxis => ({
  id,
  entries,
  capacity,
});
const lf = (id: string, axis: EnumAxis): LeafPrefix => ({ kind: 'leaf', id, axis });
const comp = (id: string, dims: readonly string[]): CompositePrefix => ({
  kind: 'composite',
  id,
  dims,
});

// ══════════════════════════════════════════════════════════════
//  §1. Prefix 참조는 capacity 조회일 뿐 — 재귀 없음
// ══════════════════════════════════════════════════════════════

describe('§1 Prefix 참조 = capacity 조회 (재귀 아님)', () => {
  const ROLE = ax('role', ['admin', 'editor', 'viewer'], 8);
  const ACTION = ax('action', ['read', 'write', 'delete'], 4);
  const RES = ax('resource', ['post', 'comment', 'user'], 16);
  const ENV = ax('env', ['dev', 'prod'], 4);

  it('leaf → composite: dim의 capacity만 사용', () => {
    const s: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [lf('role', ROLE), lf('action', ACTION), comp('perm', ['role', 'action'])],
    };
    const r = resolve(s);
    const perm = r.get('perm')!;
    expect(perm.shape).toEqual([8, 4]); // role.cap, action.cap
    expect(perm.capacity).toBe(32);
    expect(perm.strides).toEqual([4, 1]);
  });

  it('composite → composite: 내부를 펼치지 않고 capacity만 참조', () => {
    const s: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [
        lf('role', ROLE),
        lf('action', ACTION),
        lf('resource', RES),
        comp('perm', ['role', 'action']), // cap = 8×4 = 32
        comp('access', ['perm', 'resource']), // cap = 32×16 = 512
      ],
    };
    const r = resolve(s);

    const perm = r.get('perm')!;
    expect(perm.capacity).toBe(32);

    // access는 perm의 capacity(32)만 참조. role·action을 개별로 보지 않음.
    const access = r.get('access')!;
    expect(access.shape).toEqual([32, 16]); // [perm.cap, resource.cap]
    expect(access.capacity).toBe(512);
    expect(access.strides).toEqual([16, 1]);
  });

  it('3단계 체인: leaf → comp → comp → comp', () => {
    const s: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [
        lf('role', ROLE),
        lf('action', ACTION),
        lf('resource', RES),
        lf('env', ENV),
        comp('perm', ['role', 'action']), // 32
        comp('access', ['perm', 'resource']), // 32×16 = 512
        comp('scoped', ['access', 'env']), // 512×4 = 2048
      ],
    };
    const r = resolve(s);

    // scoped는 access.capacity(512)와 env.capacity(4)만 참조
    const scoped = r.get('scoped')!;
    expect(scoped.shape).toEqual([512, 4]);
    expect(scoped.capacity).toBe(2048);
    expect(scoped.strides).toEqual([4, 1]);

    // 인코딩: scoped 주소는 2차원 (access_pos, env_pos)
    const wi = new WeightedIndex(scoped.shape as number[]);
    const addr = wi.encode([1, 2]); // access 첫 번째, env 두 번째
    expect(addr).toBe(1); // (1-1)*4 + (2-1) = 1
    expect(wi.decode(addr)).toEqual([1, 2]);
  });

  it('같은 prefix를 여러 composite에서 참조해도 독립적', () => {
    const s: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [
        lf('role', ROLE),
        lf('action', ACTION),
        lf('resource', RES),
        comp('perm', ['role', 'action']), // 32
        comp('res_role', ['resource', 'role']), // 128
      ],
    };
    const r = resolve(s);
    expect(r.get('perm')!.capacity).toBe(32);
    expect(r.get('res_role')!.capacity).toBe(128);
    // role이 양쪽에서 참조되지만 capacity는 동일하게 8
  });

  it('순환 참조 감지', () => {
    const s: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [comp('a', ['b']), comp('b', ['a'])],
    };
    expect(() => resolve(s)).toThrow('순환 참조');
  });
});

// ══════════════════════════════════════════════════════════════
//  §2. 버전 고정 주소 — 같은 정수, 다른 버전, 다른 의미
// ══════════════════════════════════════════════════════════════

describe('§2 버전 고정 주소', () => {
  it('stride 불변 시: 같은 주소가 같은 좌표 (버전 호환)', () => {
    // v1: role(8), action(4) → stride=[4,1]
    const v1: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [
        lf('role', ax('role', ['admin', 'editor', 'viewer'], 8)),
        lf('action', ax('action', ['read', 'write', 'delete'], 4)),
        comp('perm', ['role', 'action']),
      ],
    };
    // v2: role(16), action(4) → stride=[4,1] (role이 첫 번째 축이므로 불변!)
    const v2: Schema = {
      id: 'test',
      version: 'v2',
      prefixes: [
        lf('role', ax('role', ['admin', 'editor', 'viewer', 'moderator'], 16)),
        lf('action', ax('action', ['read', 'write', 'delete'], 4)),
        comp('perm', ['role', 'action']),
      ],
    };

    const r1 = resolve(v1).get('perm')!;
    const r2 = resolve(v2).get('perm')!;

    // stride 동일
    expect(r1.strides).toEqual([4, 1]);
    expect(r2.strides).toEqual([4, 1]);

    // 같은 좌표 → 같은 주소
    const wi1 = new WeightedIndex(r1.shape as number[]);
    const wi2 = new WeightedIndex(r2.shape as number[]);
    const coords = [2, 3]; // editor, delete
    expect(wi1.encode(coords)).toBe(wi2.encode(coords)); // 동일!

    // → 첫 번째 축만 확장하면 기존 주소 그대로 유효
  });

  it('stride 변경 시: 같은 주소가 다른 좌표 (버전 비호환)', () => {
    // v1: role(8), action(4) → stride=[4,1]
    const v1: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [
        lf('role', ax('role', ['admin', 'editor', 'viewer'], 8)),
        lf('action', ax('action', ['read', 'write', 'delete'], 4)),
        comp('perm', ['role', 'action']),
      ],
    };
    // v2: role(8), action(8) → stride=[8,1] (action 확장 → stride 변경!)
    const v2: Schema = {
      id: 'test',
      version: 'v2',
      prefixes: [
        lf('role', ax('role', ['admin', 'editor', 'viewer'], 8)),
        lf('action', ax('action', ['read', 'write', 'delete', 'approve'], 8)),
        comp('perm', ['role', 'action']),
      ],
    };

    const r1 = resolve(v1).get('perm')!;
    const r2 = resolve(v2).get('perm')!;

    // stride 변경됨
    expect(r1.strides).toEqual([4, 1]);
    expect(r2.strides).toEqual([8, 1]);

    // 같은 좌표 [2,3] → 다른 주소
    const wi1 = new WeightedIndex(r1.shape as number[]);
    const wi2 = new WeightedIndex(r2.shape as number[]);
    const coords = [2, 3];
    expect(wi1.encode(coords)).toBe(6); // (2-1)*4 + (3-1) = 6
    expect(wi2.encode(coords)).toBe(10); // (2-1)*8 + (3-1) = 10
    expect(wi1.encode(coords)).not.toBe(wi2.encode(coords));

    // 같은 주소 6을 다른 버전으로 decode → 다른 좌표
    expect(wi1.decode(6)).toEqual([2, 3]); // editor, delete
    expect(wi2.decode(6)).toEqual([1, 7]); // admin, pos7(없음) ← 오역!
  });

  it('VersionedAddress로 버전 구분', () => {
    interface VersionedAddress {
      schema: string;
      version: string;
      prefix: string;
      address: number;
    }

    const serialize = (va: VersionedAddress) =>
      `${va.schema}:${va.version}:${va.prefix}:${va.address}`;
    const parse = (s: string): VersionedAddress => {
      const [schema, version, prefix, addr] = s.split(':');
      return { schema, version, prefix, address: Number(addr) };
    };

    const v1addr: VersionedAddress = { schema: 'rbac', version: 'v1', prefix: 'perm', address: 6 };
    const v2addr: VersionedAddress = { schema: 'rbac', version: 'v2', prefix: 'perm', address: 10 };

    // 같은 좌표 [2,3]이지만 버전이 다르므로 주소가 다름
    expect(serialize(v1addr)).toBe('rbac:v1:perm:6');
    expect(serialize(v2addr)).toBe('rbac:v2:perm:10');

    // 역직렬화 후 version으로 올바른 decoder 선택
    const parsed = parse('rbac:v1:perm:6');
    expect(parsed.version).toBe('v1');
    expect(parsed.address).toBe(6);
  });
});

// ══════════════════════════════════════════════════════════════
//  §3. Composite 참조 체인 — 실제 시나리오
// ══════════════════════════════════════════════════════════════

describe('§3 Composite 참조 체인 — 쇼핑 플랫폼', () => {
  // service(composite) = env × region × svc_name × ns → cap 100
  // permission = service(ref) × role → cap 100 × 8 = 800
  // audit_log = permission(ref) × event_type → cap 800 × 16 = 12800

  const ENV = ax('env', ['dev', 'stage', 'prod', 'test', 'local'], 5);
  const REGION = ax('region', ['asia', 'usa'], 2);
  const SVC_NAME = ax('svc_name', ['web', 'backend', 'auth', 'payment', 'gw'], 5);
  const NS = ax('namespace', ['shop', 'cms'], 2);
  const ROLE = ax('role', ['admin', 'dev', 'op', 'viewer', 'ro'], 8);
  const EVT_TYPE = ax('event_type', ['login', 'logout', 'order', 'payment', 'error'], 16);

  const SCHEMA: Schema = {
    id: 'shopping',
    version: 'v1',
    prefixes: [
      lf('env', ENV),
      lf('region', REGION),
      lf('svc_name', SVC_NAME),
      lf('namespace', NS),
      lf('role', ROLE),
      lf('event_type', EVT_TYPE),
      comp('service', ['env', 'region', 'svc_name', 'namespace']), // 5×2×5×2 = 100
      comp('permission', ['service', 'role']), // 100×8 = 800
      comp('audit_log', ['permission', 'event_type']), // 800×16 = 12800
    ],
  };

  it('3단계 참조 체인: service → permission → audit_log', () => {
    const r = resolve(SCHEMA);

    expect(r.get('service')!.capacity).toBe(100);
    expect(r.get('service')!.shape).toEqual([5, 2, 5, 2]);

    // permission은 service.capacity=100을 참조
    expect(r.get('permission')!.shape).toEqual([100, 8]);
    expect(r.get('permission')!.capacity).toBe(800);
    expect(r.get('permission')!.strides).toEqual([8, 1]);

    // audit_log는 permission.capacity=800을 참조
    expect(r.get('audit_log')!.shape).toEqual([800, 16]);
    expect(r.get('audit_log')!.capacity).toBe(12800);
    expect(r.get('audit_log')!.strides).toEqual([16, 1]);
  });

  it('service 주소를 permission의 dim으로 직접 사용', () => {
    const r = resolve(SCHEMA);

    // service 인코딩: prod/asia/auth/shop
    const svcWi = new WeightedIndex(r.get('service')!.shape as number[]);
    const svcAddr = svcWi.encode([3, 1, 3, 1]); // prod=3, asia=1, auth=3, shop=1
    expect(svcAddr).toBe(44); // (3-1)*20+(1-1)*10+(3-1)*2+(1-1) = 44

    // permission 인코딩: service=44번째 position, role=admin(1)
    const permWi = new WeightedIndex(r.get('permission')!.shape as number[]);
    // service position = svcAddr + 1 = 45 (1-based)
    const permAddr = permWi.encode([svcAddr + 1, 1]);
    expect(permAddr).toBe(44 * 8 + 0); // 352

    // decode 검증
    const [svcPos, rolePos] = permWi.decode(permAddr);
    expect(svcPos).toBe(45); // service의 45번째 위치 = 주소 44
    expect(rolePos).toBe(1); // admin
  });

  it('audit_log에서 permission 주소와 event를 추출', () => {
    const r = resolve(SCHEMA);
    const auditWi = new WeightedIndex(r.get('audit_log')!.shape as number[]);

    // permission 352번, event_type login(1)
    const addr = auditWi.encode([353, 1]); // 353번째 permission position
    expect(addr).toBe(352 * 16 + 0); // 5632

    const [permPos, evtPos] = auditWi.decode(addr);
    expect(permPos).toBe(353);
    expect(evtPos).toBe(1); // login
  });

  it('service capacity 확장 → permission, audit_log 영향 분석', () => {
    // v2: svc_name capacity 5→8 (새 서비스 추가)
    const SCHEMA_V2: Schema = {
      id: 'shopping',
      version: 'v2',
      prefixes: [
        lf('env', ENV),
        lf('region', REGION),
        lf(
          'svc_name',
          ax(
            'svc_name',
            ['web', 'backend', 'auth', 'payment', 'gw', 'search', 'notify', 'batch'],
            8,
          ),
        ),
        lf('namespace', NS),
        lf('role', ROLE),
        lf('event_type', EVT_TYPE),
        comp('service', ['env', 'region', 'svc_name', 'namespace']),
        comp('permission', ['service', 'role']),
        comp('audit_log', ['permission', 'event_type']),
      ],
    };

    const r1 = resolve(SCHEMA);
    const r2 = resolve(SCHEMA_V2);

    // service: shape 변경 [5,2,5,2]→[5,2,8,2], capacity 100→160
    expect(r2.get('service')!.capacity).toBe(160);

    // permission: service capacity가 바뀌었으므로 shape 변경
    expect(r2.get('permission')!.shape).toEqual([160, 8]);
    expect(r2.get('permission')!.capacity).toBe(1280);

    // stride 비교
    // service가 첫 번째 축 → stride[0] = role.cap = 8 → 불변!
    expect(r1.get('permission')!.strides).toEqual([8, 1]);
    expect(r2.get('permission')!.strides).toEqual([8, 1]); // 동일!

    // audit_log: permission capacity가 바뀌었으므로 shape 변경
    expect(r2.get('audit_log')!.shape).toEqual([1280, 16]);
    // audit_log stride도 불변 (permission이 첫 번째 축)
    expect(r1.get('audit_log')!.strides).toEqual([16, 1]);
    expect(r2.get('audit_log')!.strides).toEqual([16, 1]); // 동일!

    // → service capacity가 커져도 하위 composite의 stride는 불변
    //   (참조 대상이 항상 첫 번째 축이므로)
    // → 기존 주소가 그대로 유효. 마이그레이션 불필요.
  });
});

// ══════════════════════════════════════════════════════════════
//  §4. 역방향 조회 — composite에서 leaf까지 경로 추적
// ══════════════════════════════════════════════════════════════

describe('§4 역방향 조회 — 주소에서 원본 leaf까지', () => {
  const ENV = ax('env', ['dev', 'prod'], 4);
  const SVC = ax('svc', ['auth', 'payment', 'web'], 8);
  const ROLE = ax('role', ['admin', 'viewer'], 4);
  const ACTION = ax('action', ['read', 'write'], 4);

  const SCHEMA: Schema = {
    id: 'trace',
    version: 'v1',
    prefixes: [
      lf('env', ENV),
      lf('svc', SVC),
      lf('role', ROLE),
      lf('action', ACTION),
      comp('service', ['env', 'svc']), // 4×8 = 32
      comp('perm', ['service', 'role', 'action']), // 32×4×4 = 512
    ],
  };

  it('perm 주소 → service 주소 → env+svc 좌표까지 역추적', () => {
    const r = resolve(SCHEMA);

    // 인코딩: prod(2)/payment(2) service, admin(1), write(2)
    const svcWi = new WeightedIndex(r.get('service')!.shape as number[]);
    const svcAddr = svcWi.encode([2, 2]); // (2-1)*8+(2-1) = 9

    const permWi = new WeightedIndex(r.get('perm')!.shape as number[]);
    const permAddr = permWi.encode([svcAddr + 1, 1, 2]); // svc pos 10, admin, write
    // (10-1)*16 + (1-1)*4 + (2-1) = 145

    // 역추적 step 1: perm 주소 → [svcPos, rolePos, actionPos]
    const [svcPos, rolePos, actionPos] = permWi.decode(permAddr);
    expect(ROLE.entries[rolePos - 1]).toBe('admin');
    expect(ACTION.entries[actionPos - 1]).toBe('write');

    // 역추적 step 2: svcPos → service 주소 → [envPos, svcNamePos]
    const svcAddrFromPerm = svcPos - 1; // 0-based
    const [envPos, svcNamePos] = svcWi.decode(svcAddrFromPerm);
    expect(ENV.entries[envPos - 1]).toBe('prod');
    expect(SVC.entries[svcNamePos - 1]).toBe('payment');

    // 전체 경로: permAddr 145 → prod/payment/admin/write
  });

  it('같은 leaf를 여러 경로로 도달 가능', () => {
    const r = resolve(SCHEMA);

    // env="prod"(2)는 다음을 통해 도달:
    // 1. 직접: env prefix에서 position 2
    // 2. service를 통해: service 주소의 첫 번째 좌표가 2
    // 3. perm을 통해: perm → service → env

    // 경로 1: env 직접
    expect(ENV.entries[1]).toBe('prod'); // 0-based index 1 = position 2

    // 경로 2: service 주소에서 추출
    const svcWi = new WeightedIndex(r.get('service')!.shape as number[]);
    const svcAddr = svcWi.encode([2, 3]); // prod, web
    expect(svcWi.decode(svcAddr)[0]).toBe(2); // env position = 2 = prod

    // 경로 3: perm → service → env
    const permWi = new WeightedIndex(r.get('perm')!.shape as number[]);
    const permAddr = permWi.encode([svcAddr + 1, 1, 1]);
    const [svcPos] = permWi.decode(permAddr);
    const [envPos] = svcWi.decode(svcPos - 1);
    expect(envPos).toBe(2); // prod

    // 모든 경로에서 같은 결과: env=prod
  });
});

// ══════════════════════════════════════════════════════════════
//  §5. 주소 공간 안전성 — Number 한계 내에서의 체인
// ══════════════════════════════════════════════════════════════

describe('§5 주소 공간 안전성', () => {
  it('composite 체인이 Number.MAX_SAFE_INTEGER를 넘지 않는 한 안전', () => {
    // 각 축 2^13 = 8192, 4축 composite → 2^52 < 2^53 ✓
    const A = ax('a', ['x'], 8192);
    const B = ax('b', ['x'], 8192);
    const C = ax('c', ['x'], 8192);
    const D = ax('d', ['x'], 8192);
    const s: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [lf('a', A), lf('b', B), lf('c', C), lf('d', D), comp('big', ['a', 'b', 'c', 'd'])],
    };
    const r = resolve(s);
    expect(r.get('big')!.capacity).toBe(8192 ** 4); // 2^52
    expect(r.get('big')!.capacity).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it('composite→composite 체인도 capacity 곱이 한계 내이면 안전', () => {
    const X = ax('x', ['a'], 1024);
    const Y = ax('y', ['a'], 1024);
    const Z = ax('z', ['a'], 1024);
    const s: Schema = {
      id: 'test',
      version: 'v1',
      prefixes: [
        lf('x', X),
        lf('y', Y),
        lf('z', Z),
        comp('xy', ['x', 'y']), // 1024^2 = 1M
        comp('xyz', ['xy', 'z']), // 1M × 1024 = 1G
      ],
    };
    const r = resolve(s);
    expect(r.get('xy')!.capacity).toBe(1024 * 1024);
    expect(r.get('xyz')!.capacity).toBe(1024 ** 3);
    expect(r.get('xyz')!.capacity).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it('참조 깊이가 아무리 깊어도 resolve는 O(prefix 수)', () => {
    // 10단계 체인: L0 → C1 → C2 → ... → C9
    const base = ax('base', ['a'], 4);
    const prefixes: Prefix[] = [lf('base', base)];
    for (let i = 1; i <= 9; i++) {
      prefixes.push(comp(`c${i}`, [i === 1 ? 'base' : `c${i - 1}`, 'base']));
    }
    const s: Schema = { id: 'deep', version: 'v1', prefixes };
    const r = resolve(s);

    // c9 capacity = 4^10 = 1,048,576
    expect(r.get('c9')!.capacity).toBe(4 ** 10);
    // resolve는 각 prefix를 1번만 방문 (메모이제이션)
    expect(r.size).toBe(10); // base + c1~c9
  });
});
