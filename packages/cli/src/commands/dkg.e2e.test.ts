// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

import { DkgSqliteStore } from '../../../spec-core/src/store/index.js';

const originalHome = process.env.HOME;
const originalAuditIngestUrl = process.env.QA_CLI_AUDIT_INGEST_URL;
const originalAuditWarn = process.env.QA_CLI_AUDIT_WARN;
const tempHomes: string[] = [];
const runHeavySmoke = process.env.QA_SDK_RUN_HEAVY_SMOKE === '1';

describe('dkg CLI E2E', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalAuditIngestUrl === undefined) {
      delete process.env.QA_CLI_AUDIT_INGEST_URL;
    } else {
      process.env.QA_CLI_AUDIT_INGEST_URL = originalAuditIngestUrl;
    }
    if (originalAuditWarn === undefined) {
      delete process.env.QA_CLI_AUDIT_WARN;
    } else {
      process.env.QA_CLI_AUDIT_WARN = originalAuditWarn;
    }
    await Promise.all(
      tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })),
    );
  });

  it('dkg decide --type new-axis는 completed FlowInstance와 DecisionNode를 함께 남긴다', async () => {
    const { home, dkgDecide, dkgTrace, loadFlowInstanceMeta } = await loadIsolatedDkgModules();

    const decideOutput = await captureConsoleAsync(async () => {
      await dkgDecide({
        target: 'decision_event',
        type: 'new-axis',
        title: '새 axis 추가',
        rationale: 'decision_event에 새 차원을 확장한다.',
        confirmProceed: async () => true,
      });
    });

    expect(decideOutput.stdout).toContain('══ coordinate-design 브릿지 ══');
    expect(decideOutput.stdout).toContain('✓ 플로우 완료');

    const decisionId = extractLabeledValue(decideOutput.stdout, 'id');
    const flowInstanceId = extractLabeledValue(decideOutput.stdout, 'flow instance');
    const store = new DkgSqliteStore(join(home, '.qa-sdk', 'state.sqlite'), 'demo');
    const graph = store.loadGraph();
    const decision = graph.getNode(decisionId);

    expect(decision?.kind).toBe('decision');
    expect(decision && 'flowInstanceId' in decision ? decision.flowInstanceId : undefined).toBe(
      flowInstanceId,
    );

    const instance = loadFlowInstanceMeta(store, flowInstanceId);
    expect(instance?.status).toBe('completed');
    expect(instance?.context.dkgDecisionId).toBe(decisionId);
    expect(instance?.addressContext).toEqual(
      expect.objectContaining({
        decision_event: expect.stringMatching(/^decision_event:v1:\d+$/),
        decision_path: expect.stringMatching(/^decision_path:v1:\d+$/),
      }),
    );

    const traceOutput = captureConsole(() => {
      dkgTrace(decisionId);
    });

    expect(traceOutput.stdout).toContain(`flow:      ${flowInstanceId}`);
    expect(traceOutput.stdout).toContain('── 연결된 FlowInstance 코어 추적 ──');
    expect(traceOutput.stdout).toContain('flow-schema: coordinate-design');
    expect(traceOutput.stdout).toContain(`dkgDecisionId: ${decisionId}`);
    expect(traceOutput.stdout).toContain('★ axis-definition = new-axis');
  });

  it('dkg decide --type merge는 코어 gate 경고를 출력한다', async () => {
    const { dkgDecide } = await loadIsolatedDkgModules();

    const output = await captureConsoleAsync(async () => {
      await dkgDecide({
        target: 'decision_event',
        type: 'merge',
        title: 'prefix merge 검토',
        rationale: '중복 prefix 정리가 필요하다.',
        confirmProceed: async () => true,
      });
    });

    expect(output.stdout).toContain('══ 코어 gate 영향 경고 ══');
    expect(output.stdout).toContain('★ merge-split (merge/split 판정) ← merge');
    expect(output.stdout).toContain('무효화 cascade:');
    expect(output.stdout).toContain('⚠ 코어 gate 무효화 — 전체 재설계 필요');
  });

  it('dkg decide는 DecisionNode 기록 후 flow bridge를 시도한다', async () => {
    const { home, dkgDecide } = await loadIsolatedDkgModules();

    const decideOutput = await captureConsoleAsync(async () => {
      await dkgDecide({
        target: 'decision_event',
        type: 'new-axis',
        title: '새 axis 추가',
        rationale: 'bridge 시도 확인',
        confirmProceed: async () => true,
      });
    });

    // decision은 항상 기록됨
    const decisionId = extractLabeledValue(decideOutput.stdout, 'id');
    const store = new DkgSqliteStore(join(home, '.qa-sdk', 'state.sqlite'), 'demo');
    const graph = store.loadGraph();
    const decision = graph.getNode(decisionId);

    expect(decision?.kind).toBe('decision');
    // bridge 시도: 성공하면 flowInstanceId 존재, 실패하면 경고 출력
    const hasFlow = decision && 'flowInstanceId' in decision && !!decision.flowInstanceId;
    const hasBridgeWarning = decideOutput.stdout.includes('브릿지 시작 실패');
    expect(hasFlow || hasBridgeWarning).toBe(true);
  });

  it('dkg audit-events는 로컬 audit log를 남기고 ingest forwarding을 수행한다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'qa-dkg-audit-'));
    tempHomes.push(home);
    process.env.HOME = home;
    vi.resetModules();

    let resolveBody!: (body: string) => void;
    let rejectBody!: (err: Error) => void;
    const requestBody = new Promise<string>((resolve, reject) => {
      resolveBody = resolve;
      rejectBody = reject;
    });
    let requestPath = '';
    const timeout = setTimeout(() => rejectBody(new Error('audit forwarding timeout')), 5_000);
    const server = createServer((req, res) => {
      requestPath = req.url ?? '';
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        clearTimeout(timeout);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        server.close();
        resolveBody(Buffer.concat(chunks).toString('utf-8'));
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });
    const address = server.address();
    expect(address).toBeTruthy();
    expect(typeof address).not.toBe('string');
    process.env.QA_CLI_AUDIT_INGEST_URL = `http://127.0.0.1:${(address as { port: number }).port}/`;

    const { main } = await import('../index.js');
    const output = await captureConsoleAsync(async () => {
      await main(['dkg', 'audit-events', '--limit', '1']);
    });

    expect(output.stdout).toContain('CLI Audit Events');

    const envelope = JSON.parse(await requestBody);
    expect(requestPath).toBe('/v1/ingest');
    expect(envelope.records).toHaveLength(1);
    expect(envelope.records[0].event_key).toBe('cli.command.executed');
    expect(envelope.records[0].payload).toEqual(
      expect.objectContaining({
        command: 'dkg audit-events',
      }),
    );

    const store = new DkgSqliteStore(join(home, '.qa-sdk', 'state.sqlite'), 'demo');
    const events = store.listRecentCliAuditEvents(5, { command: 'dkg audit-events' });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.eventKey).toBe('cli.command.executed');
  });

  it('ingest HTTP 오류는 fail-open으로 격리하되 warning에서 상태를 진단한다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'qa-dkg-audit-http-error-'));
    tempHomes.push(home);
    process.env.HOME = home;
    process.env.QA_CLI_AUDIT_WARN = '1';
    vi.resetModules();

    const server = createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
        server.close();
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });
    const address = server.address();
    expect(address).toBeTruthy();
    expect(typeof address).not.toBe('string');
    process.env.QA_CLI_AUDIT_INGEST_URL = `http://127.0.0.1:${(address as { port: number }).port}`;

    const { main } = await import('../index.js');
    const output = await captureConsoleAsync(async () => {
      await main(['dkg', 'audit-events', '--limit', '1']);
    });

    expect(output.stdout).toContain('CLI Audit Events');
    expect(output.stderr).toContain('[cli-audit-ingest] 전송 실패');
    expect(output.stderr).toContain('HTTP 503');

    const store = new DkgSqliteStore(join(home, '.qa-sdk', 'state.sqlite'), 'demo');
    const events = store.listRecentCliAuditEvents(5, { command: 'dkg audit-events' });
    expect(events.length).toBeGreaterThan(0);
  });

  it('self-check는 최신 flow evidence를 재사용하고 stale evidence는 recovery에서 제외한다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'qa-dkg-flow-evidence-'));
    tempHomes.push(home);
    process.env.HOME = home;

    await mkdir(join(home, '.qa-sdk'), { recursive: true });
    const store = new DkgSqliteStore(join(home, '.qa-sdk', 'state.sqlite'), 'demo');
    store.saveFlowEvidence({
      runId: 'runtime-flow-fresh',
      observedAt: new Date().toISOString(),
      records: [
        {
          timestamp: new Date().toISOString(),
          traceId: 'trace-runtime-1',
          sessionId: 'session-runtime-1',
          addressContext: { page_view: 'page_view:v1:1', endpoint: 'endpoint:v1:2' },
        },
      ],
    });

    vi.resetModules();
    const { main } = await import('../index.js');
    const freshOutput = await captureConsoleAsync(async () => {
      await main(['dkg', 'self-check', '--fast']);
    });
    expect(freshOutput.stdout).toContain('persisted fresh evidence');
    expect(freshOutput.stdout).toContain('evidence scope: run=runtime-flow-fresh');

    const staleHome = await mkdtemp(join(tmpdir(), 'qa-dkg-flow-evidence-stale-'));
    tempHomes.push(staleHome);
    process.env.HOME = staleHome;
    await mkdir(join(staleHome, '.qa-sdk'), { recursive: true });
    const staleAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1_000).toISOString();
    const staleStore = new DkgSqliteStore(join(staleHome, '.qa-sdk', 'state.sqlite'), 'demo');
    staleStore.saveFlowEvidence({
      runId: 'runtime-flow-stale',
      observedAt: staleAt,
      records: [
        {
          timestamp: staleAt,
          traceId: 'trace-runtime-stale',
          addressContext: { page_view: 'page_view:v1:1' },
        },
      ],
    });

    vi.resetModules();
    const { main: staleMain } = await import('../index.js');
    const staleOutput = await captureConsoleAsync(async () => {
      await staleMain(['dkg', 'self-check', '--fast']);
    });
    expect(staleOutput.stdout).toContain('persisted stale evidence');
    expect(staleOutput.stdout).toContain('recovery 입력에서 제외');
  });

  it('self-check는 persisted runtime evidence가 없을 때 recovery 범위를 명시한다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'qa-dkg-flow-evidence-none-'));
    tempHomes.push(home);
    process.env.HOME = home;
    await mkdir(join(home, '.qa-sdk'), { recursive: true });

    vi.resetModules();
    const { main } = await import('../index.js');
    const output = await captureConsoleAsync(async () => {
      await main(['dkg', 'self-check', '--fast']);
    });

    expect(output.stdout).toContain('evidence scope: none');
    expect(output.stdout).toContain('recovery 입력은 self-check live records만 사용');
    expect(output.stdout).toContain('coverage metric: skipped');
  });

  const heavyIt = runHeavySmoke ? it : it.skip;

  heavyIt('dkg self-check full path는 별도 heavy smoke lane에서 실행된다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'qa-dkg-heavy-'));
    tempHomes.push(home);
    process.env.HOME = home;
    vi.resetModules();

    const { main } = await import('../index.js');
    const output = await captureConsoleAsync(async () => {
      await main(['dkg', 'self-check']);
    });

    expect(output.stdout).toContain('Self-Check');
    expect(output.stdout).toContain('Phase A: aggregate');
  });
});

async function loadIsolatedDkgModules() {
  const home = await mkdtemp(join(tmpdir(), 'qa-dkg-e2e-'));
  tempHomes.push(home);
  process.env.HOME = home;
  vi.resetModules();

  const [{ dkgDecide, dkgTrace }, { loadFlowInstanceMeta }] = await Promise.all([
    import('./dkg.js'),
    import('./dkg-decision-flow.js'),
  ]);

  return {
    home,
    dkgDecide,
    dkgTrace,
    loadFlowInstanceMeta,
  };
}

function captureConsole(run: () => void) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(' '));
  });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(' '));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(' '));
  });

  try {
    run();
  } finally {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  };
}

async function captureConsoleAsync(run: () => Promise<void>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(' '));
  });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(' '));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(' '));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  };
}

function extractLabeledValue(output: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`^\\s*${escaped}:\\s+(.+)$`, 'm'));
  expect(match).not.toBeNull();
  return match![1].trim();
}
