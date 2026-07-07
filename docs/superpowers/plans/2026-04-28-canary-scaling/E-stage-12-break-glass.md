---
status: source-backed
sources:
  - scripts/sim-canary.ts
  - scripts/sim-canary.test.ts
  - scripts/sim-scale.ts
  - scripts/sim-scale.test.ts
  - simulations/enterprise-pm/scenarios/src/runner/sim-handles/fault-injector.ts
  - simulations/enterprise-pm/scenarios/src/runner/sim-handles/compose-handle.ts
---

## 단계 12: 운영자 escape hatch (break-glass CLI)

**Spec 참조:** `05-error-and-scenarios.md` §2

본 단계는 controller 자동 결정이 잘못 작동할 때 사람이 강제 개입할 수 있는 4개 채널 (`abort` / `force-promote` / `controller stop` / `replica pin`)을 두 commander CLI (`sim-canary`, `sim-scale`)로 노출한다. 모든 명령은 audit-recorder에 `operatorAction: true` + actor identity를 첨부해 자동 결정 사이클과 같은 trace 안에서 인접 노드로 추적 가능하다 (spec 05 §2 표).

### File Structure (단계 12)

| 종류 | 경로 |
|---|---|
| Create | `scripts/sim-canary.ts` |
| Create | `scripts/sim-canary.test.ts` |
| Create | `scripts/sim-scale.ts` |
| Create | `scripts/sim-scale.test.ts` |
| Create | `scripts/break-glass-shared/audit-recorder-client.ts` |
| Create | `scripts/break-glass-shared/audit-recorder-client.test.ts` |
| Create | `scripts/break-glass-shared/operator-identity.ts` |
| Create | `scripts/break-glass-shared/spec-script-drift.test.ts` |
| Modify | `package.json` (root) — `sim:canary` / `sim:scale` 등록 |

### Task 12.1: scripts/sim-canary.ts — abort / force-promote / controller stop

**Files:**
- Create: `scripts/sim-canary.ts`

본 task는 카나리 자동 결정을 무력화하는 3 subcommand를 한 진입점에 모은다. `abort`는 Plan C 단계 7 gateway의 `/admin/routing` 내부 API에 weight=0 + revision++를 push 하고 controller hold 모드를 거는 두 호출을 묶는다. `force-promote`는 Plan B 단계 3 sim-service-catalog의 `transitionState` 두 번 (candidate→stable, stable→retired) + weight=100 push를 순차 실행한다. `controller stop`은 Plan D 단계 9 controller에 `/admin/controller/stop`을 보내 PG advisory lock을 release 한다 (spec 01 §"controller 싱글톤 보장"). 모든 호출 직후 audit-recorder write가 일어나며, 실패는 fail-closed로 exit code 비-0를 남긴다.

- [ ] **Step 12.1.1: commander 골격 + 공통 옵션**

```typescript
#!/usr/bin/env node
// scripts/sim-canary.ts
import { Command } from "commander";
import { buildDecisionId, buildCycleId } from "@qa-sdk-sim/identifier-grammar";
import { transitionState, getCurrentTopology } from "sim-service-catalog";
import { recordOperatorAction } from "./break-glass-shared/audit-recorder-client.js";
import { resolveOperatorIdentity } from "./break-glass-shared/operator-identity.js";

interface CommonOpts {
  controllerUrl: string; gatewayAdminUrl: string; auditUrl: string;
  service: string; prefix: string; reason: string; dryRun: boolean;
}
function commonOptions(cmd: Command): Command {
  return cmd
    .requiredOption("--service <name>", "대상 서비스")
    .requiredOption("--prefix <id>", "catalog prefix")
    .requiredOption("--reason <text>", "운영자 사유 (audit evidence)")
    .option("--controller-url <url>", "controller admin URL", "http://localhost:7100")
    .option("--gateway-admin-url <url>", "gateway admin URL", "http://localhost:8889")
    .option("--audit-url <url>", "audit-recorder URL", "http://localhost:5100")
    .option("--dry-run", "실제 호출 없이 의도된 API call만 출력", false);
}
function newDecisionId(pass: "safety" | "resource"): string {
  return buildDecisionId({ cycleId: buildCycleId({ kind: "operator", at: new Date() }), pass, revision: Date.now() });
}
export function buildSimCanary(): Command {
  const cmd = new Command();
  cmd.name("sim-canary").description("카나리 break-glass 운영자 명령");
  // 12.1.2 ~ 12.1.4 subcommand 등록
  return cmd;
}
```

- [ ] **Step 12.1.2: abort — weight=0 push + controller hold**

```typescript
commonOptions(cmd.command("abort"))
  .description("카나리 즉시 중단 (weight=0 + controller hold)")
  .option("--hold-until <iso>", "hold 만료 ISO timestamp")
  .action(async (opts: CommonOpts & { holdUntil?: string }) => {
    const operator = resolveOperatorIdentity();
    const decisionId = newDecisionId("safety");
    const holdUntil = opts.holdUntil ?? new Date(Date.now() + 3600_000).toISOString();
    const action = { kind: "weight-update" as const, weight: 0, revision: Date.now() };
    if (opts.dryRun) {
      process.stdout.write(JSON.stringify({ call: "POST /admin/routing", body: { service: opts.service, ...action } }) + "\n");
      process.stdout.write(JSON.stringify({ call: "POST /admin/controller/hold", body: { service: opts.service, holdUntil } }) + "\n");
      return;
    }
    const r1 = await fetch(`${opts.gatewayAdminUrl}/admin/routing`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: opts.service, ...action }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!r1.ok) { process.stderr.write(`abort: gateway push failed ${r1.status}\n`); process.exitCode = 2; return; }
    await fetch(`${opts.controllerUrl}/admin/controller/hold`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: opts.service, holdUntil }),
      signal: AbortSignal.timeout(5_000),
    });
    await recordOperatorAction(opts.auditUrl, {
      decisionId, operatorAction: true, actor: operator,
      command: "sim-canary abort", service: opts.service, prefix: opts.prefix,
      action, holdUntil, reason: opts.reason,
    });
    process.stdout.write(`[OK] abort applied: ${opts.service} weight=0 holdUntil=${holdUntil}\n`);
  });
```

- [ ] **Step 12.1.3: force-promote — catalog 전이 + weight=100**

```typescript
commonOptions(cmd.command("force-promote"))
  .description("카나리 강제 승격 (위험) — catalog 전이 + 이전 stable retired")
  .action(async (opts: CommonOpts) => {
    const operator = resolveOperatorIdentity();
    const decisionId = newDecisionId("safety");
    const topo = await getCurrentTopology(opts.prefix);
    if (!topo.candidate) { process.stderr.write(`no candidate for ${opts.prefix}\n`); process.exitCode = 2; return; }
    const transitions = [
      { prefix: opts.prefix, from: "candidate", to: "stable", version: topo.candidate.version },
      { prefix: opts.prefix, from: "stable",    to: "retired", version: topo.stable.version },
    ] as const;
    if (opts.dryRun) {
      for (const t of transitions) process.stdout.write(JSON.stringify({ call: "transitionState", body: t }) + "\n");
      process.stdout.write(JSON.stringify({ call: "POST /admin/routing", body: { service: opts.service, weight: 100 } }) + "\n");
      return;
    }
    for (const t of transitions) {
      try { await transitionState(t); }
      catch { process.stdout.write(`[noop] ${t.from}->${t.to} already done\n`); }
    }
    await fetch(`${opts.gatewayAdminUrl}/admin/routing`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: opts.service, weight: 100, revision: Date.now() }),
      signal: AbortSignal.timeout(5_000),
    });
    await recordOperatorAction(opts.auditUrl, {
      decisionId, operatorAction: true, forcedBy: operator, actor: operator,
      command: "sim-canary force-promote", service: opts.service, prefix: opts.prefix,
      transitions, reason: opts.reason,
    });
    process.stdout.write(`[OK] force-promote applied: ${opts.prefix}\n`);
  });
```

- [ ] **Step 12.1.4: controller stop — advisory lock release**

```typescript
const ctrl = cmd.command("controller").description("controller process 제어");
commonOptions(ctrl.command("stop"))
  .description("controller standby 모드 — advisory lock release")
  .action(async (opts: CommonOpts) => {
    const operator = resolveOperatorIdentity();
    const decisionId = newDecisionId("safety");
    if (opts.dryRun) {
      process.stdout.write(JSON.stringify({ call: "POST /admin/controller/stop", target: opts.controllerUrl }) + "\n");
      return;
    }
    const res = await fetch(`${opts.controllerUrl}/admin/controller/stop`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: opts.reason }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) { process.stderr.write(`controller stop failed ${res.status}\n`); process.exitCode = 2; return; }
    await recordOperatorAction(opts.auditUrl, {
      decisionId, operatorAction: true, actor: operator,
      command: "sim-canary controller stop", service: opts.service, prefix: opts.prefix,
      reason: opts.reason,
    });
    process.stdout.write(`[OK] controller stop applied (advisory lock released)\n`);
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSimCanary().parseAsync(process.argv).catch((err) => {
    process.stderr.write(`sim-canary: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 12.1.5: Commit**

```bash
git add scripts/sim-canary.ts
git commit -m "feat(sim): scripts/sim-canary.ts — abort/force-promote/controller-stop break-glass"
```

### Task 12.2: scripts/sim-scale.ts — set --replicas, --pin/--unpin

**Files:**
- Create: `scripts/sim-scale.ts`

본 task는 Pass 2 자동 scale 결정을 우회하는 두 채널을 단일 commander CLI로 노출한다. `--replicas`는 `docker compose --scale`을 직접 spawn 하고, `--pin`은 controller에 service-level pin flag를 설정해 controller가 다음 사이클부터 해당 service의 Pass 2 결정을 SKIP 하면서 evidence에 `{kind:"external", source:"operator-pin"}` 객체를 기록하게 만든다 (spec 05 §2 4번째 단락). pin/unpin은 멱등이며 `--replicas`와 동시 사용은 거부한다.

- [ ] **Step 12.2.1: commander 골격**

```typescript
#!/usr/bin/env node
// scripts/sim-scale.ts
import { Command } from "commander";
import { spawn } from "node:child_process";
import { buildDecisionId, buildCycleId } from "@qa-sdk-sim/identifier-grammar";
import { recordOperatorAction } from "./break-glass-shared/audit-recorder-client.js";
import { resolveOperatorIdentity } from "./break-glass-shared/operator-identity.js";

interface ScaleSetOpts {
  service: string; replicas?: number; pin?: boolean; unpin?: boolean; reason: string;
  composeFile: string; composeProject: string; controllerUrl: string; auditUrl: string; dryRun: boolean;
}
async function runDocker(args: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}
export function buildSimScale(): Command {
  const cmd = new Command();
  cmd.name("sim-scale").description("스케일 break-glass 운영자 명령");
  // set subcommand 등록 (12.2.2 + 12.2.3)
  return cmd;
}
```

- [ ] **Step 12.2.2: set --replicas (docker compose --scale)**

```typescript
cmd.command("set")
  .description("replica 수동 고정 또는 controller scale 결정 pin")
  .requiredOption("--service <name>", "대상 서비스")
  .requiredOption("--reason <text>", "운영자 사유")
  .option("--replicas <n>", "강제 replica 수", (v) => Number.parseInt(v, 10))
  .option("--pin", "controller scale 결정 pin", false)
  .option("--unpin", "pin 해제 (멱등)", false)
  .option("--compose-file <p>", "compose yaml", "simulations/enterprise-pm/docker-compose.sim.yaml")
  .option("--compose-project <n>", "compose project", "enterprise-pm")
  .option("--controller-url <url>", "controller admin URL", "http://localhost:7100")
  .option("--audit-url <url>", "audit-recorder URL", "http://localhost:5100")
  .option("--dry-run", "실제 호출 없이 의도된 명령만 출력", false)
  .action(async (opts: ScaleSetOpts) => {
    const operator = resolveOperatorIdentity();
    const decisionId = buildDecisionId({
      cycleId: buildCycleId({ kind: "operator", at: new Date() }),
      pass: "resource", revision: Date.now(),
    });
    if (opts.replicas !== undefined && (opts.pin || opts.unpin)) {
      process.stderr.write("--replicas는 --pin/--unpin과 동시 사용 불가\n"); process.exitCode = 2; return;
    }
    if (opts.replicas !== undefined) {
      const args = ["compose", "-f", opts.composeFile, "-p", opts.composeProject,
        "up", "-d", "--no-deps", "--scale", `${opts.service}=${opts.replicas}`, opts.service];
      if (opts.dryRun) { process.stdout.write(JSON.stringify({ call: "docker", args }) + "\n"); return; }
      const code = await runDocker(args);
      if (code !== 0) { process.stderr.write(`docker compose --scale failed: exit ${code}\n`); process.exitCode = 2; return; }
      await recordOperatorAction(opts.auditUrl, {
        decisionId, operatorAction: true, actor: operator,
        command: "sim-scale set --replicas", service: opts.service,
        action: { kind: "scale-set", replicas: opts.replicas }, reason: opts.reason,
      });
      process.stdout.write(`[OK] scale set: ${opts.service} replicas=${opts.replicas}\n`);
      return;
    }
    return runPinUnpin(opts, operator, decisionId);
  });
```

- [ ] **Step 12.2.3: set --pin/--unpin (controller plug)**

```typescript
async function runPinUnpin(opts: ScaleSetOpts, operator: string, decisionId: string): Promise<void> {
  if (!opts.pin && !opts.unpin) {
    process.stderr.write("--replicas, --pin, --unpin 중 하나는 필수\n"); process.exitCode = 2; return;
  }
  const pinned = !!opts.pin;
  const path = pinned ? "/admin/controller/pin" : "/admin/controller/unpin";
  if (opts.dryRun) {
    process.stdout.write(JSON.stringify({ call: `POST ${path}`, body: { service: opts.service, reason: opts.reason } }) + "\n");
    return;
  }
  const res = await fetch(`${opts.controllerUrl}${path}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ service: opts.service, reason: opts.reason }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) { process.stderr.write(`pin/unpin failed: ${res.status}\n`); process.exitCode = 2; return; }
  await recordOperatorAction(opts.auditUrl, {
    decisionId, operatorAction: true, actor: operator,
    command: pinned ? "sim-scale set --pin" : "sim-scale set --unpin",
    service: opts.service, action: { kind: pinned ? "scale-pin" : "scale-unpin" }, reason: opts.reason,
  });
  process.stdout.write(`[OK] scale ${pinned ? "pin" : "unpin"} applied: ${opts.service}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSimScale().parseAsync(process.argv).catch((err) => {
    process.stderr.write(`sim-scale: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 12.2.4: 수동 dry-run 검증**

```bash
node --import tsx scripts/sim-scale.ts set --service approval-api-v2 --replicas 5 --reason "load test" --dry-run
node --import tsx scripts/sim-scale.ts set --service approval-api-v2 --pin --reason "manual investigation" --dry-run
```

기대: 첫 명령은 `{"call":"docker","args":[...,"--scale","approval-api-v2=5",...]}`, 두 번째는 `POST /admin/controller/pin` 본문이 출력. fetch/spawn 실제 호출 0건.

- [ ] **Step 12.2.5: Commit**

```bash
git add scripts/sim-scale.ts
git commit -m "feat(sim): scripts/sim-scale.ts — set --replicas/--pin/--unpin break-glass"
```

### Task 12.3: audit-recorder operatorAction + actor identity 첨부

**Files:**
- Create: `scripts/break-glass-shared/audit-recorder-client.ts`
- Create: `scripts/break-glass-shared/operator-identity.ts`
- Create: `scripts/break-glass-shared/audit-recorder-client.test.ts`

본 task는 12.1·12.2가 공유하는 audit-recorder write 클라이언트와 operator identity 추출기를 분리한다. spec 05 §2는 4 break-glass 명령이 모두 audit-recorder에 같은 grammar의 `decisionId`로 기록되어야 한다고 못 박는다 — 본 모듈이 SSOT이므로 12.1·12.2 어느 한쪽이 형식을 어기면 grep + drift 테스트로 잡는다. operator identity는 env > git > whoami fallback으로 결정.

- [ ] **Step 12.3.1: operator-identity.ts**

```typescript
// scripts/break-glass-shared/operator-identity.ts
import { execSync } from "node:child_process";

export function resolveOperatorIdentity(): string {
  const fromEnv = process.env.SIM_OPERATOR_ACTOR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    const email = execSync("git config user.email", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (email.length > 0) return email;
  } catch { /* git 없음 — fallthrough */ }
  try { return execSync("whoami", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return "unknown-operator"; }
}
```

- [ ] **Step 12.3.2: audit-recorder-client.ts (단일 write 함수)**

```typescript
// scripts/break-glass-shared/audit-recorder-client.ts
export interface OperatorActionRecord {
  decisionId: string; operatorAction: true; actor: string;
  forcedBy?: string; command: string; service: string; prefix?: string;
  action?: Record<string, unknown>; transitions?: ReadonlyArray<Record<string, unknown>>;
  holdUntil?: string; reason: string;
}
export async function recordOperatorAction(auditUrl: string, record: OperatorActionRecord): Promise<void> {
  const body = {
    ...record, recordedAt: new Date().toISOString(),
    evidence: [{ kind: "external", source: "break-glass-cli", content: { command: record.command, reason: record.reason } }],
  };
  const res = await fetch(`${auditUrl}/operator-actions`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5_000),
  });
  // spec 05 §2: 운영자 행동은 1회성, retry 없음. 실패 시 throw → 호출자 exit 1.
  if (!res.ok) throw new Error(`audit-recorder write failed: ${res.status}`);
}
```

- [ ] **Step 12.3.3: 12.1·12.2 호출부가 본 모듈만 사용하는지 grep 검증**

```bash
grep -nE "fetch.*audit|/operator-actions" scripts/sim-canary.ts scripts/sim-scale.ts
```

기대: 비어 있음. audit-recorder 직접 호출은 본 모듈에만 있어야 한다. 매치되면 PR reject.

- [ ] **Step 12.3.4: 단위 테스트**

```typescript
// scripts/break-glass-shared/audit-recorder-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordOperatorAction } from "./audit-recorder-client.js";
import { resolveOperatorIdentity } from "./operator-identity.js";

describe("operator-identity", () => {
  beforeEach(() => { delete process.env.SIM_OPERATOR_ACTOR; });
  it("env가 있으면 env 우선", () => {
    process.env.SIM_OPERATOR_ACTOR = "ops@example.com";
    expect(resolveOperatorIdentity()).toBe("ops@example.com");
  });
  it("env 없으면 fallback (non-empty)", () => {
    expect(resolveOperatorIdentity().length).toBeGreaterThan(0);
  });
});

describe("recordOperatorAction", () => {
  it("operatorAction:true + evidence break-glass-cli source", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await recordOperatorAction("http://audit:5100", {
      decisionId: "did:operator:1", operatorAction: true, actor: "ops@example.com",
      command: "sim-canary abort", service: "approval-api", reason: "schemaCompatRate spike",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://audit:5100/operator-actions");
    const body = JSON.parse(init.body as string);
    expect(body.operatorAction).toBe(true);
    expect(body.evidence[0]).toMatchObject({ kind: "external", source: "break-glass-cli" });
    vi.unstubAllGlobals();
  });
  it("audit write 실패 시 throw (retry 없음)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      recordOperatorAction("http://audit:5100", {
        decisionId: "did:operator:2", operatorAction: true, actor: "ops",
        command: "sim-scale set --pin", service: "approval-api-v2", reason: "manual",
      }),
    ).rejects.toThrow(/audit-recorder write failed: 500/);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 12.3.5: Commit**

```bash
git add scripts/break-glass-shared/operator-identity.ts \
        scripts/break-glass-shared/audit-recorder-client.ts \
        scripts/break-glass-shared/audit-recorder-client.test.ts
git commit -m "feat(sim): break-glass-shared — audit-recorder client + operator identity"
```

### Task 12.4: package.json (root) — sim:canary / sim:scale 등록

**Files:**
- Modify: `package.json`
- Create: `scripts/break-glass-shared/spec-script-drift.test.ts`

본 task는 두 CLI를 root pnpm script로 등록한다. spec 05 §2 표가 `pnpm sim:canary abort` / `pnpm sim:scale set ...` 형태를 직접 인용하므로 등록 이름은 spec 표와 1:1 일치해야 한다 (drift 시 spec-CLI 회귀가 silent하게 발생). tsx loader로 build 단계 없이 직접 실행 — 운영 응급 시 dist 빌드 의존을 줄인다.

- [ ] **Step 12.4.1: tsx devDependency 확인**

```bash
grep -E "\"tsx\":" package.json pnpm-lock.yaml | head -5
```

기대: tsx가 root devDependency 또는 lockfile에 잡힘. 없으면 `pnpm add -D -w tsx` 추가.

- [ ] **Step 12.4.2: scripts 블록에 두 entry 추가**

기존 `package.json`의 `"scripts"` 블록 끝 (sim:scenarios 다음)에:

```json
{
  "scripts": {
    "sim:smoke": "./simulations/enterprise-pm/scripts/smoke.sh",
    "sim:smoke:keep": "./simulations/enterprise-pm/scripts/smoke.sh --keep-up",
    "sim:scenarios": "node ./simulations/enterprise-pm/scenarios/dist/cli.js",
    "sim:canary": "tsx scripts/sim-canary.ts",
    "sim:scale":  "tsx scripts/sim-scale.ts"
  }
}
```

- [ ] **Step 12.4.3: spec 인용 호출 형태 dry-run 검증**

```bash
pnpm sim:canary abort --service approval-api --prefix sim.approval --reason "spec quote" --dry-run
pnpm sim:canary force-promote --service approval-api --prefix sim.approval --reason "spec quote" --dry-run
pnpm sim:canary controller stop --service approval-api --prefix sim.approval --reason "spec quote" --dry-run
pnpm sim:scale set --service approval-api-v2 --replicas 5 --reason "spec quote" --dry-run
pnpm sim:scale set --service approval-api-v2 --pin --reason "spec quote" --dry-run
pnpm sim:scale set --service approval-api-v2 --unpin --reason "spec quote" --dry-run
```

기대: spec 05 §2 표의 4개 명령 형태가 모두 dry-run 출력으로 통과. `--replicas + --pin` 동시 사용은 명시적으로 exit 2 (의미 충돌).

- [ ] **Step 12.4.4: spec 표와 root package.json drift 정적 검사**

```typescript
// scripts/break-glass-shared/spec-script-drift.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("spec 05 §2 ↔ package.json 동기화", () => {
  it("표에서 인용된 명령이 모두 root package.json scripts에 매핑되어 있다", () => {
    const root = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8"));
    expect(root.scripts["sim:canary"]).toBeDefined();
    expect(root.scripts["sim:scale"]).toBeDefined();
    const spec = readFileSync(
      resolve(__dirname, "../../docs/superpowers/specs/2026-04-28-canary-scaling/05-error-and-scenarios.md"),
      "utf8",
    );
    for (const literal of [
      "pnpm sim:canary abort",
      "pnpm sim:canary force-promote",
      "pnpm sim:canary controller stop",
      "pnpm sim:scale set",
    ]) {
      expect(spec.includes(literal)).toBe(true);
    }
  });
});
```

- [ ] **Step 12.4.5: Commit**

```bash
git add package.json scripts/break-glass-shared/spec-script-drift.test.ts
git commit -m "chore(sim): register sim:canary / sim:scale break-glass scripts"
```

### Task 12.5: dry-run 단위 테스트 — 의도된 API call 검증

**Files:**
- Create: `scripts/sim-canary.test.ts`
- Create: `scripts/sim-scale.test.ts`

본 task는 spec 05 §2의 4 명령이 dry-run에서 정확히 의도된 호출 셋을 만드는지 검증한다. dry-run은 fetch/spawn/transitionState 어떤 부수효과도 일으키지 않으므로 mock 없이 stdout 캡처만으로 충분하다 — 실제 호출 경로는 운영 응급 시 별도 통합 테스트(시나리오 9b)에서 다룬다.

- [ ] **Step 12.5.1: sim-canary abort dry-run**

```typescript
// scripts/sim-canary.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSimCanary } from "./sim-canary.js";

function captureStdout(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (s: string) => boolean) = ((s: string) => {
    lines.push(s.replace(/\n$/, "")); return true;
  }) as never;
  return fn().finally(() => { process.stdout.write = orig; }).then(() => lines);
}

describe("sim-canary dry-run", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("abort — weight=0 push + controller hold 두 호출", async () => {
    const lines = await captureStdout(() => buildSimCanary().parseAsync([
      "node", "sim-canary", "abort",
      "--service", "approval-api", "--prefix", "sim.approval",
      "--reason", "test", "--dry-run",
    ]));
    const calls = lines.map((l) => JSON.parse(l));
    expect(calls).toEqual([
      expect.objectContaining({ call: "POST /admin/routing", body: expect.objectContaining({ service: "approval-api", weight: 0 }) }),
      expect.objectContaining({ call: "POST /admin/controller/hold", body: expect.objectContaining({ service: "approval-api" }) }),
    ]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 12.5.2: force-promote / controller stop dry-run**

```typescript
it("force-promote — catalog 두 전이 + weight=100 push", async () => {
  const lines = await captureStdout(() => buildSimCanary().parseAsync([
    "node", "sim-canary", "force-promote",
    "--service", "approval-api", "--prefix", "sim.approval",
    "--reason", "test", "--dry-run",
  ]));
  expect(lines.map((l) => JSON.parse(l).call)).toEqual([
    "transitionState", "transitionState", "POST /admin/routing",
  ]);
});

it("controller stop — admin/controller/stop 한 호출", async () => {
  const lines = await captureStdout(() => buildSimCanary().parseAsync([
    "node", "sim-canary", "controller", "stop",
    "--service", "approval-api", "--prefix", "sim.approval",
    "--reason", "test", "--dry-run",
  ]));
  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0])).toMatchObject({ call: "POST /admin/controller/stop" });
});
```

- [ ] **Step 12.5.3: sim-scale set --replicas dry-run**

```typescript
// scripts/sim-scale.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSimScale } from "./sim-scale.js";

function captureStdout(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (s: string) => boolean) = ((s: string) => {
    lines.push(s.replace(/\n$/, "")); return true;
  }) as never;
  return fn().finally(() => { process.stdout.write = orig; }).then(() => lines);
}

describe("sim-scale dry-run", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("set --replicas — docker compose --scale args 출력", async () => {
    const lines = await captureStdout(() => buildSimScale().parseAsync([
      "node", "sim-scale", "set",
      "--service", "approval-api-v2", "--replicas", "5",
      "--reason", "test", "--dry-run",
    ]));
    const call = JSON.parse(lines[0]);
    expect(call.call).toBe("docker");
    expect(call.args).toEqual(expect.arrayContaining(["compose", "--scale", "approval-api-v2=5"]));
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 12.5.4: set --pin/--unpin + 충돌 거부 dry-run**

```typescript
it("set --pin — POST /admin/controller/pin", async () => {
  const lines = await captureStdout(() => buildSimScale().parseAsync([
    "node", "sim-scale", "set",
    "--service", "approval-api-v2", "--pin",
    "--reason", "test", "--dry-run",
  ]));
  expect(JSON.parse(lines[0])).toMatchObject({
    call: "POST /admin/controller/pin",
    body: expect.objectContaining({ service: "approval-api-v2" }),
  });
});

it("set --unpin — POST /admin/controller/unpin (멱등)", async () => {
  const lines = await captureStdout(() => buildSimScale().parseAsync([
    "node", "sim-scale", "set",
    "--service", "approval-api-v2", "--unpin",
    "--reason", "test", "--dry-run",
  ]));
  expect(JSON.parse(lines[0]).call).toBe("POST /admin/controller/unpin");
});

it("set --replicas + --pin 동시 사용은 exit 2", async () => {
  const prev = process.exitCode; process.exitCode = 0;
  await buildSimScale().parseAsync([
    "node", "sim-scale", "set",
    "--service", "approval-api-v2", "--replicas", "5", "--pin",
    "--reason", "test", "--dry-run",
  ]);
  expect(process.exitCode).toBe(2);
  process.exitCode = prev;
});
```

- [ ] **Step 12.5.5: 테스트 실행 + Commit**

```bash
pnpm vitest run \
  scripts/sim-canary.test.ts \
  scripts/sim-scale.test.ts \
  scripts/break-glass-shared/audit-recorder-client.test.ts \
  scripts/break-glass-shared/spec-script-drift.test.ts
```

기대: 모든 테스트 PASS. fetch/docker/transitionState 실제 호출 0건.

```bash
git add scripts/sim-canary.test.ts scripts/sim-scale.test.ts
git commit -m "test(sim): break-glass dry-run 단위 테스트 (sim-canary/sim-scale)"
```
