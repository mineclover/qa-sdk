// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design
//
// HTTP-mode legacy __simHandle factory — 시나리오 1~8 e2e HTTP 지원.
//
// 시나리오 1~8 은 in-process 부팅 시 NestJS Test 기반 globalThis.__simHandle 에 의존한다
// (fixtures + seedBudgetRequest + delegateProject + authApp.getHttpServer().address()).
// 본 factory 는 동일 인터페이스를 HTTP fetch 로 감싸서 SIM_SCENARIO_INPROC=1 + 외부 서비스
// (sim-auth-api / sim-approval-api / sim-pm-api / sim-gateway) 가 떠 있는 환경에서
// 시나리오 1~8 을 그대로 구동할 수 있게 한다.
//
// 핵심 정책:
//   - fixtures: seedTestData + seedExtendedUsers 의 결정론적 ID 컨벤션을 코드로 미러링
//     (deriveUserId/deriveDeptId/deriveRoleId). 실제 DB 시드는 외부 sim-up 가 책임.
//   - seedBudgetRequest: gateway 경유 POST /approvals/requests → /submit → /start-review.
//     자기 요청은 자기 자신이 승인하는 시나리오 3, requesterId 로 로그인해 시드한다.
//   - delegateProject: gateway 경유 POST /projects/:id/delegate. 시나리오 6 외부 setup 보조.
//   - authApp 호환: scenario-8 은 authApp.getHttpServer().address() 로 auth-api base URL 을
//     얻는다. HTTP 모드에서는 authApiUrl 의 host/port 를 분해해 동일 shape 로 노출한다.
//
// 구현 결정:
//   - fixture password: seedTestData 컨벤션 그대로 ("alice-pass", "bob-pass", ...).
//   - department/role ID: deriveDeptId/deriveRoleId 와 일치 (예: dept_Engineering, role_manager).
//   - fetchImpl 주입 가능 — unit test 에서 격리.

const ENG_DEPT_ID = 'dept_Engineering';
const MARKETING_DEPT_ID = 'dept_Marketing';
const ROLE_MANAGER_ID = 'role_manager';
const ROLE_MEMBER_ID = 'role_member';
const ROLE_ADMIN_ID = 'role_admin';
const ROLE_APPROVER_ID = 'role_approver';

/** seedTestData/seedExtendedUsers 의 deriveUserId 와 동일 규약. */
function deriveUserId(email: string): string {
  return `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/** scenario __simHandle 의 fixture 슬라이스 — InProcessFixtures 와 호환되는 부분만 노출. */
export interface SimHandleFixtureUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  departmentId: string | null;
}

export interface SimHandleFixtures {
  alice: SimHandleFixtureUser;
  bob: SimHandleFixtureUser;
  carol: SimHandleFixtureUser;
  david: SimHandleFixtureUser;
  eve: SimHandleFixtureUser;
  frank: SimHandleFixtureUser;
  admin: SimHandleFixtureUser;
  departments: { eng: string; marketing: string };
  roles: {
    manager: { id: string };
    member: { id: string };
    admin: { id: string };
    approver_role: { id: string };
  };
  /** 시나리오 3/4/5/8 — in_review 상태 budget request 시드. */
  seedBudgetRequest(args: {
    projectId: string;
    projectDepartmentId: string;
    amount: number;
    requesterId: string;
  }): Promise<{ id: string }>;
  /** 시나리오 6 보조 — gateway 경유 delegate. */
  delegateProject(args: {
    projectId: string;
    graphRootId: string;
    delegateUserId: string;
  }): Promise<void>;
}

/** scenario-8 의 handle.authApp.getHttpServer().address() 호환 shim. */
export interface SimHandleAuthAppShim {
  getHttpServer(): {
    address(): { port: number } | null;
  };
}

export interface SimHandle {
  fixtures: SimHandleFixtures;
  authApp: SimHandleAuthAppShim;
}

export type FetchLike = typeof fetch;

export interface SimHandleFactoryArgs {
  /** sim-gateway base URL — login + projects/approvals proxy. */
  gatewayUrl: string;
  /** sim-auth-api base URL — scenario-8 role-assignments + authApp.address shim. */
  authApiUrl: string;
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** fetch 주입 — 테스트용. 미지정 시 globalThis.fetch. */
  fetchImpl?: FetchLike;
  /** fixture override — 외부 시드와 다른 비밀번호/이메일 컨벤션이면 주입. */
  fixtures?: Partial<{
    alice: SimHandleFixtureUser;
    bob: SimHandleFixtureUser;
    carol: SimHandleFixtureUser;
    david: SimHandleFixtureUser;
    eve: SimHandleFixtureUser;
    frank: SimHandleFixtureUser;
    admin: SimHandleFixtureUser;
  }>;
}

/** 결정론적 ID/email/password 시드 — seedTestData/seedExtendedUsers SSOT. */
function buildDefaultUsers(): {
  alice: SimHandleFixtureUser;
  bob: SimHandleFixtureUser;
  carol: SimHandleFixtureUser;
  david: SimHandleFixtureUser;
  eve: SimHandleFixtureUser;
  frank: SimHandleFixtureUser;
  admin: SimHandleFixtureUser;
} {
  return {
    alice: {
      id: deriveUserId('alice@example.com'),
      email: 'alice@example.com',
      password: 'alice-pass',
      displayName: 'Alice',
      departmentId: ENG_DEPT_ID,
    },
    bob: {
      id: deriveUserId('bob@example.com'),
      email: 'bob@example.com',
      password: 'bob-pass',
      displayName: 'Bob',
      departmentId: MARKETING_DEPT_ID,
    },
    carol: {
      id: deriveUserId('carol@example.com'),
      email: 'carol@example.com',
      password: 'carol-pass',
      displayName: 'Carol',
      departmentId: ENG_DEPT_ID,
    },
    david: {
      id: deriveUserId('david@example.com'),
      email: 'david@example.com',
      password: 'david-pass',
      displayName: 'David',
      departmentId: ENG_DEPT_ID,
    },
    eve: {
      id: deriveUserId('eve@example.com'),
      email: 'eve@example.com',
      password: 'eve-pass',
      displayName: 'Eve',
      departmentId: ENG_DEPT_ID,
    },
    frank: {
      id: deriveUserId('frank@example.com'),
      email: 'frank@example.com',
      password: 'frank-pass',
      displayName: 'Frank',
      departmentId: ENG_DEPT_ID,
    },
    admin: {
      id: deriveUserId('admin@example.com'),
      email: 'admin@example.com',
      password: 'admin-pass',
      displayName: 'Admin',
      departmentId: ENG_DEPT_ID,
    },
  };
}

/** url host:port 를 추출해 scenario-8 authApp shim 으로 노출. */
function buildAuthAppShim(authApiUrl: string): SimHandleAuthAppShim {
  let port = 0;
  try {
    const parsed = new URL(authApiUrl);
    port = parseInt(parsed.port, 10);
    if (!Number.isFinite(port) || port <= 0) {
      // protocol 기본 포트 fallback (http=80, https=443).
      port = parsed.protocol === 'https:' ? 443 : 80;
    }
  } catch {
    port = 0;
  }
  return {
    getHttpServer() {
      return {
        address() {
          return port > 0 ? { port } : null;
        },
      };
    },
  };
}

/**
 * createSimHandle — scenarios 1~8 globalThis.__simHandle HTTP 구현체.
 *
 * @param args
 *   - gatewayUrl: sim-gateway base URL
 *   - authApiUrl: sim-auth-api base URL (scenario 8 직접 호출 + address shim)
 *   - timeoutMs: 외부 호출 timeout (기본 5_000)
 *   - fetchImpl: 테스트 주입 가능
 *   - fixtures: 비표준 시드 시 user override
 */
export function createSimHandle(args: SimHandleFactoryArgs): SimHandle {
  const fetchImpl: FetchLike = args.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = args.timeoutMs ?? 5_000;
  const gw = args.gatewayUrl.replace(/\/$/, '');

  const defaults = buildDefaultUsers();
  const users = {
    alice: args.fixtures?.alice ?? defaults.alice,
    bob: args.fixtures?.bob ?? defaults.bob,
    carol: args.fixtures?.carol ?? defaults.carol,
    david: args.fixtures?.david ?? defaults.david,
    eve: args.fixtures?.eve ?? defaults.eve,
    frank: args.fixtures?.frank ?? defaults.frank,
    admin: args.fixtures?.admin ?? defaults.admin,
  };

  /** gateway 경유 로그인 → JWT token 회수. fail-fast (외부 의존이 없으면 명확한 에러). */
  async function login(email: string, password: string): Promise<string> {
    const url = `${gw}/auth/login`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`sim-handle login ${email} failed: status=${res.status} body=${body}`);
    }
    const json = (await res.json()) as { token?: unknown };
    if (typeof json.token !== 'string' || json.token.length === 0) {
      throw new Error(`sim-handle login ${email} returned invalid token shape`);
    }
    return json.token;
  }

  const fixtures: SimHandleFixtures = {
    alice: users.alice,
    bob: users.bob,
    carol: users.carol,
    david: users.david,
    eve: users.eve,
    frank: users.frank,
    admin: users.admin,
    departments: {
      eng: ENG_DEPT_ID,
      marketing: MARKETING_DEPT_ID,
    },
    roles: {
      manager: { id: ROLE_MANAGER_ID },
      member: { id: ROLE_MEMBER_ID },
      admin: { id: ROLE_ADMIN_ID },
      approver_role: { id: ROLE_APPROVER_ID },
    },

    async seedBudgetRequest(input) {
      // requesterId 로부터 fixture user 를 역추적 — 로그인 자격 회수.
      const requester = Object.values(users).find((u) => u.id === input.requesterId);
      if (!requester) {
        throw new Error(
          `sim-handle seedBudgetRequest: unknown requesterId=${input.requesterId} (fixture lookup failed)`,
        );
      }
      const token = await login(requester.email, requester.password);
      const headers = {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      // 1. POST /approvals/requests
      const createRes = await fetchImpl(`${gw}/approvals/requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: input.projectId,
          projectDepartmentId: input.projectDepartmentId,
          amount: input.amount,
          requesterId: input.requesterId,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (createRes.status !== 201 && createRes.status !== 200) {
        const body = await createRes.text().catch(() => '');
        throw new Error(
          `sim-handle seedBudgetRequest create failed: status=${createRes.status} body=${body}`,
        );
      }
      const created = (await createRes.json()) as { id?: unknown };
      if (typeof created.id !== 'string') {
        throw new Error(
          `sim-handle seedBudgetRequest invalid create body: ${JSON.stringify(created)}`,
        );
      }
      const id = created.id;

      // 2. POST /approvals/requests/:id/submit (draft → submitted)
      const submitRes = await fetchImpl(`${gw}/approvals/requests/${id}/submit`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!submitRes.ok) {
        const body = await submitRes.text().catch(() => '');
        throw new Error(
          `sim-handle seedBudgetRequest submit failed: status=${submitRes.status} body=${body}`,
        );
      }

      // 3. POST /approvals/requests/:id/start-review (submitted → in_review)
      const reviewRes = await fetchImpl(`${gw}/approvals/requests/${id}/start-review`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!reviewRes.ok) {
        const body = await reviewRes.text().catch(() => '');
        throw new Error(
          `sim-handle seedBudgetRequest start-review failed: status=${reviewRes.status} body=${body}`,
        );
      }

      return { id };
    },

    async delegateProject(input) {
      // alice (project owner) 로 delegate — 시나리오 6 보조.
      const token = await login(users.alice.email, users.alice.password);
      const res = await fetchImpl(`${gw}/projects/${input.projectId}/delegate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          graphRootId: input.graphRootId,
          delegateUserId: input.delegateUserId,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`sim-handle delegateProject failed: status=${res.status} body=${body}`);
      }
    },
  };

  return {
    fixtures,
    authApp: buildAuthAppShim(args.authApiUrl),
  };
}

/**
 * createSimGatewayFetch — `__simGatewayFetch` HTTP 구현체.
 *
 * 시나리오 1~8 은 `new Request("http://sim/<path>")` 형태로 호출한다.
 * 본 함수는 host 부분을 gatewayUrl 로 치환해 외부 fetch 로 위임한다.
 *
 * 응답 통과 정책: 헤더/본문/상태 그대로 전달 — 시나리오 코드에서 .ok / .json() / .headers 사용.
 */
export function createSimGatewayFetch(args: {
  gatewayUrl: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): (req: Request) => Promise<Response> {
  const fetchImpl: FetchLike = args.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const gw = args.gatewayUrl.replace(/\/$/, '');
  const timeoutMs = args.timeoutMs ?? 5_000;

  return async (req: Request): Promise<Response> => {
    const original = new URL(req.url);
    const target = `${gw}${original.pathname}${original.search}`;
    // body 는 Request 가 stream 일 수 있으므로 clone 후 buffer 로 변환.
    const init: RequestInit = {
      method: req.method,
      headers: req.headers,
      // GET/HEAD 가 아닌 경우만 body 전달.
      body:
        req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.clone().arrayBuffer(),
      signal: AbortSignal.timeout(timeoutMs),
    };
    return fetchImpl(target, init);
  };
}
