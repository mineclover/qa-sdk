// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEF_COMMAND_DESCRIPTORS } from '../command-groups/def.commands.js';
import { cliDef } from './def.js';

describe('def commands', () => {
  let tempRoot: string;
  let dbPath: string;
  const originalQaSdkHome = process.env.QA_SDK_HOME;

  beforeEach(() => {
    tempRoot = '';
    dbPath = '';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalQaSdkHome === undefined) {
      delete process.env.QA_SDK_HOME;
    } else {
      process.env.QA_SDK_HOME = originalQaSdkHome;
    }
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  function getOutput(): string {
    const spy = console.log as unknown as { mock: { calls: unknown[][] } };
    return spy.mock.calls.map((c) => String(c[0])).join('\n');
  }

  async function runDef(args: string[]): Promise<void> {
    if (args.length === 0) {
      await cliDef(args);
      return;
    }

    if (!dbPath) {
      tempRoot = await mkdtemp(join(tmpdir(), 'qa-sdk-def-cli-'));
      dbPath = join(tempRoot, 'definition-service.sqlite');
      process.env.QA_SDK_HOME = tempRoot;
    }

    await cliDef([...args, '--db', dbPath]);
  }

  describe('help', () => {
    it('서브커맨드 없으면 help 출력', async () => {
      await runDef([]);
      expect(getOutput()).toContain('qa-sdk def');
    });

    it('help 서브커맨드 명시', async () => {
      await runDef(['help']);
      expect(getOutput()).toContain('qa-sdk def');
    });
  });

  describe('command registry', () => {
    it('verification producer commands are reachable from the top-level command tree', () => {
      expect(DEF_COMMAND_DESCRIPTORS.map((descriptor) => descriptor.id)).toEqual(
        expect.arrayContaining(['def.verification-bindings', 'def.verification-artifact']),
      );
    });
  });

  describe('link-rules', () => {
    it('LinkType 규칙 출력', async () => {
      await runDef(['link-rules']);
      const output = getOutput();
      expect(output).toContain('contains');
      expect(output).toContain('depends_on');
    });
  });

  describe('sync', () => {
    it('docs → local DB 동기화', async () => {
      await runDef(['sync']);
      const output = getOutput();
      expect(output).toContain('동기화 완료');
      expect(output).toContain('DB:');
    });
  });

  describe('scan (= sync alias)', () => {
    it('scan은 sync와 동일하게 동작', async () => {
      await runDef(['scan']);
      const output = getOutput();
      expect(output).toContain('동기화 완료');
    });
  });

  describe('list (sync 후)', () => {
    it('sync 후 문서 목록 조회', async () => {
      // sync 먼저 실행
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['list']);
      const output = getOutput();
      // 문서가 존재해야 함
      expect(output.length).toBeGreaterThan(0);
    });

    it('--scope 필터', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['list', '--scope=system']);
      // system scope 문서만 출력 (에러 없이 실행)
      // 출력이 없을 수도 있음 (해당 scope 없으면)
    });
  });

  describe('stats (sync 후)', () => {
    it('분포 통계 출력', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['stats']);
      const output = getOutput();
      // 통계 출력 포함
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('scan-audit', () => {
    it('raw frontmatter 감사 실행', async () => {
      await runDef(['scan-audit']);
      const output = getOutput();
      // 감사 결과 출력
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('audit-db', () => {
    it('layout incoming refs를 유효한 연결로 판정한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['audit-db']);
      const output = getOutput();

      expect(output).toContain('✓ 이슈 없음');
      expect(output).not.toContain('data-structure-profile-00-design');
      expect(output).not.toContain('data-structure-profile-readme');
    });
  });

  describe('code-link-gaps', () => {
    it('explicit 문서 연결 없는 코드 목록을 JSON으로 출력한다', async () => {
      await runDef([
        'code-link-gaps',
        '--scope=packages/definition-catalog/src',
        '--limit=3',
        '--json',
      ]);
      const output = getOutput();
      const parsed = JSON.parse(output);

      expect(parsed).toEqual(
        expect.objectContaining({
          scopes: ['packages/definition-catalog/src'],
          totalFiles: expect.any(Number),
          linkedFiles: expect.any(Number),
          unlinkedFiles: expect.any(Number),
          coverageRate: expect.any(Number),
          listedFiles: expect.any(Array),
          truncated: expect.any(Number),
        }),
      );
      expect(parsed.totalFiles).toBeGreaterThan(0);
      expect(parsed.listedFiles.length).toBeLessThanOrEqual(3);
    });
  });

  describe('state', () => {
    it('전체 머신 상태 분포 출력', async () => {
      await runDef(['state']);
      const output = getOutput();
      expect(output.length).toBeGreaterThan(0);
    });

    it('verification artifact를 문서 상태 JSON read model에 조합한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      const artifactPath = join(tempRoot, 'verification-artifact.json');
      await writeFile(
        artifactPath,
        JSON.stringify({
          schemaVersion: 1,
          runStartedAt: '2026-01-01T00:00:00.000Z',
          runCompletedAt: '2026-01-01T00:01:00.000Z',
          reports: [],
        }),
      );

      await runDef([
        'state',
        'definition-management',
        '--verification-artifact',
        artifactPath,
        '--json',
      ]);

      const parsed = JSON.parse(getOutput()) as {
        verification?: { reportStatus?: string; convention?: string };
      };
      expect(parsed.verification?.reportStatus).toBe('no-report');
      expect(parsed.verification?.convention).toBe('unverified');
    });
  });

  describe('verification-artifact', () => {
    it('scan datasource도 bodyHash binding을 생성한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      const bindingsPath = join(tempRoot, 'scan-verification-bindings.json');
      await runDef([
        'verification-bindings',
        '--scan',
        '--spec-ids=definition-management',
        '--out',
        bindingsPath,
        '--captured-at=2026-01-01T00:00:00.000Z',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        bindings: Array<{ bodyHash?: string }>;
      };
      expect(output.bindings[0]?.bodyHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('producer 입력 오류는 실패 exit code를 설정한다', async () => {
      const previousExitCode = process.exitCode;
      process.exitCode = undefined;
      try {
        await runDef(['verification-artifact']);
        expect(process.exitCode).toBe(1);
      } finally {
        process.exitCode = previousExitCode;
      }
    });

    it('run-start binding 캡처부터 artifact consumer까지 연결한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      const bindingsPath = join(tempRoot, 'verification-bindings.json');
      const summaryPath = join(tempRoot, 'verification-summary.json');
      const artifactPath = join(tempRoot, 'verification-artifact.json');
      await runDef([
        'verification-bindings',
        '--spec-ids=definition-management',
        '--out',
        bindingsPath,
        '--captured-at=2026-01-01T00:00:00.000Z',
        '--json',
      ]);
      const bindingOutput = JSON.parse(getOutput()) as {
        bindings: Array<{
          specId: string;
          definitionAddress: string;
          revision: number;
          bodyHash: string;
        }>;
      };
      expect(bindingOutput.bindings[0]?.specId).toBe('definition-management');
      expect(bindingOutput.bindings[0]?.definitionAddress).toMatch(/^def_document:/);

      await writeFile(
        summaryPath,
        JSON.stringify({
          reports: [
            {
              specId: 'definition-management',
              evidences: 1,
              passed: 1,
              failed: 0,
              skipped: 0,
              markers: {},
              coverage: 1,
              lastVerified: '2026-01-01T00:01:00.000Z',
            },
          ],
          totalSpecs: 1,
          verifiedSpecs: 1,
          fullyPassed: 1,
          generatedAt: '2026-01-01T00:01:00.000Z',
        }),
      );
      vi.mocked(console.log).mockClear();
      await runDef([
        'verification-artifact',
        '--summary',
        summaryPath,
        '--bindings',
        bindingsPath,
        '--out',
        artifactPath,
        '--run-started-at=2026-01-01T00:00:00.000Z',
        '--run-completed-at=2026-01-01T00:02:00.000Z',
        '--json',
      ]);
      expect(JSON.parse(getOutput()).artifact.reports[0].binding.specId).toBe(
        'definition-management',
      );

      vi.mocked(console.log).mockClear();
      await runDef([
        'state',
        'definition-management',
        '--verification-artifact',
        artifactPath,
        '--verification-drift',
        '--json',
      ]);
      const state = JSON.parse(getOutput()) as {
        verification?: {
          bindingStatus?: string;
          convention?: string;
          driftReport?: { specId?: string };
        };
      };
      expect(state.verification).toEqual(
        expect.objectContaining({
          bindingStatus: 'ambiguous-address',
          convention: 'unverified',
        }),
      );
      expect(state.verification?.driftReport?.specId).toBe('definition-management');
    });

    it('summary와 run-start binding을 검증 아티팩트 파일로 생성한다', async () => {
      await runDef(['help']);
      vi.mocked(console.log).mockClear();

      const summaryPath = join(tempRoot, 'verification-summary.json');
      const bindingsPath = join(tempRoot, 'verification-bindings.json');
      const artifactPath = join(tempRoot, 'verification-artifact.json');
      await writeFile(
        summaryPath,
        JSON.stringify({
          reports: [
            {
              specId: 'spec-a',
              evidences: 1,
              passed: 1,
              failed: 0,
              skipped: 0,
              markers: {},
              coverage: 1,
              lastVerified: '2026-01-01T00:01:00.000Z',
            },
          ],
          totalSpecs: 1,
          verifiedSpecs: 1,
          fullyPassed: 1,
          generatedAt: '2026-01-01T00:01:00.000Z',
        }),
      );
      await writeFile(
        bindingsPath,
        JSON.stringify([
          {
            specId: 'spec-a',
            definitionAddress: 'def_document:v2:123',
            docIdAtRun: 'spec-a',
            docVersion: 'v1',
            revision: 3,
            bodyHash: 'sha256:abc',
            capturedAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      );

      await runDef([
        'verification-artifact',
        '--summary',
        summaryPath,
        '--bindings',
        bindingsPath,
        '--out',
        artifactPath,
        '--run-started-at=2026-01-01T00:00:00.000Z',
        '--run-completed-at=2026-01-01T00:02:00.000Z',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        out: string;
        artifact: { schemaVersion: number; reports: Array<{ binding?: { specId: string } }> };
      };
      expect(output.out).toBe(artifactPath);
      expect(output.artifact.schemaVersion).toBe(1);
      expect(output.artifact.reports[0]?.binding?.specId).toBe('spec-a');
      const persisted = JSON.parse(await readFile(artifactPath, 'utf8')) as typeof output.artifact;
      expect(persisted).toEqual(output.artifact);
    });
  });

  describe('validate (sync 후)', () => {
    it('그래프 검증 실행', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['validate']);
      // 검증 완료 (에러 없이 실행)
    });
  });

  describe('topdown (sync 후)', () => {
    it('기본 topdown은 구조 멤버만 보여주고 consumer는 숨긴다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['topdown', 'definition-management']);
      const output = getOutput();

      expect(output).toContain('Definition Frontmatter Metadata System');
      expect(output).toContain('via: refs');
      expect(output).not.toContain('## 관련 소비자/의존자 (incoming depends_on)');
      expect(output).not.toContain('## [flow] Vite+ Playbook Template 확장 흐름');
    });

    it('--with-consumers를 주면 incoming depends_on 소비자를 별도 섹션으로 보여준다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['topdown', 'definition-management', '--with-consumers']);
      const output = getOutput();

      expect(output).toContain('## 관련 소비자/의존자 (incoming depends_on)');
      expect(output).toContain('[depends_on←] viteplus-playbook-template-flow');
    });
  });

  describe('에러 처리', () => {
    it('get: ID 없이 호출하면 무시', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['get']);
      // 에러 없이 종료 (ID 미제공 시 빈 결과)
    });

    it('get: address로 단건 조회 가능', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['get', '--address=def_document:v2:342161']);
      const output = getOutput();
      expect(output).toContain('definition-addressing');
      expect(output).toContain('def_document:v2:342161');
    });

    it('incoming/outgoing: address로 링크 조회 가능', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['incoming', '--address=def_document:v2:342161']);
      const incomingOutput = getOutput();
      expect(incomingOutput).toContain('incoming');
      expect(incomingOutput).toContain('definition-taxonomy');

      vi.mocked(console.log).mockClear();
      await runDef(['outgoing', '--address=def_document:v2:342161']);
      const outgoingOutput = getOutput();
      expect(outgoingOutput).toContain('outgoing');
      expect(outgoingOutput).toContain('definition-taxonomy');
      expect(outgoingOutput).toContain('definition-addressing-plan');
    });

    it('boundary/boundary-context: address로 조회 가능', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['boundary', '--address=def_document:v2:342161']);
      const boundaryOutput = getOutput();
      expect(boundaryOutput).toContain('바운더리');
      expect(boundaryOutput).toContain('Definition Addressing');

      vi.mocked(console.log).mockClear();
      await runDef(['boundary-context', '--address=def_document:v2:342161']);
      const contextOutput = getOutput();
      expect(contextOutput).toContain('바운더리 컨텍스트');
      expect(contextOutput).toContain('blast radius');
    });

    it('[contract:docs-control-plane.definition-context.bounded-consumer.v1] 기존 context와 bounded context를 함께 제공한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef(['context', 'definition-addressing']);
      expect(getOutput()).toContain('# 컨텍스트:');

      vi.mocked(console.log).mockClear();
      await runDef(['context', 'definition-addressing', '--bounded', '--json']);
      const bounded = JSON.parse(getOutput()) as {
        mode: string;
        discovery: { selectedRouteKeys: string[] };
        workingContext: { status: string; facts: Array<{ factKey: string; revision: string }> };
        manifest: { digest: string; canonicalJson: string };
        observation: { eventName: string };
      };

      expect(bounded.mode).toBe('bounded');
      expect(bounded.discovery.selectedRouteKeys.length).toBeGreaterThan(0);
      expect(bounded.workingContext.status).toBe('closed');
      expect(bounded.workingContext.facts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ factKey: 'definition.document', revision: expect.any(String) }),
        ]),
      );
      expect(bounded.manifest.digest).toMatch(/^fnv1a64:/);
      expect(bounded.manifest.canonicalJson).not.toContain('Definition Addressing');
      expect(bounded.observation.eventName).toBe('context_runtime_observation');
    });

    it('[contract:docs-control-plane.definition-context.bounded-blocked.v1] Discovery cap에서 Working Context와 manifest를 차단한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--used-tokens',
        '100000',
        '--json',
      ]);
      const bounded = JSON.parse(getOutput()) as {
        discovery: {
          status: string;
          selectedRouteKeys: string[];
          workingReserveTokens: number;
          nextAction: string;
          decomposition?: { parentTaskKey: string; children: Array<{ routeKeys: string[] }> };
        };
        workingContext: { status: string; diagnostics: Array<{ code: string }> };
        manifest?: unknown;
        observation: { status: string; manifestDigest?: string };
      };

      expect(bounded.discovery.status).toBe('discovery-capped');
      expect(bounded.discovery.selectedRouteKeys).toHaveLength(0);
      expect(bounded.discovery.workingReserveTokens).toBe(100000);
      expect(bounded.discovery.nextAction).toBe('decompose');
      expect(bounded.discovery.decomposition).toMatchObject({
        parentTaskKey: 'definition-context:definition-addressing',
        children: expect.arrayContaining([
          expect.objectContaining({
            routeKeys: expect.arrayContaining(['definition.document.authoritative']),
          }),
        ]),
      });
      expect(bounded.workingContext.status).toBe('blocked');
      expect(bounded.workingContext.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'route-not-selected' })]),
      );
      expect(bounded.manifest).toBeUndefined();
      expect(bounded.observation.status).toBe('blocked');
      expect(bounded.observation.manifestDigest).toBeUndefined();
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] 외부 measured usage summary를 Discovery budget에 적용한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const usagePath = join(tempRoot, 'measured-usage.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          events: [
            {
              phase: 'discovery',
              tokens: 99_999,
              measurement: 'measured',
              sourceRef: 'provider:measured',
            },
          ],
          discoveryTokens: 99_999,
          workingTokens: 0,
          totalTokens: 99_999,
          measurement: 'measured',
        }),
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--initial-usage',
        usagePath,
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        discovery: { status: string; selectedRouteKeys: string[] };
        usage: { discoveryTokens: number; measurement: string };
      };
      expect(bounded.discovery.status).toBe('discovery-capped');
      expect(bounded.discovery.selectedRouteKeys).toHaveLength(0);
      expect(bounded.usage).toMatchObject({ discoveryTokens: 99_999, measurement: 'measured' });
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] usage summary 합계가 event와 다르면 주입을 거부한다', async () => {
      await runDef(['sync']);
      const usagePath = join(tempRoot, 'invalid-usage.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          events: [{ phase: 'discovery', tokens: 10, measurement: 'measured' }],
          discoveryTokens: 99_999,
          workingTokens: 0,
          totalTokens: 99_999,
          measurement: 'measured',
        }),
      );

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--initial-usage',
          usagePath,
          '--json',
        ]),
      ).rejects.toThrow('initialUsage summary');
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] provider response usage를 measured event로 연결한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const usagePath = join(tempRoot, 'openai-usage.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          provider: 'openai',
          phase: 'discovery',
          usage: { prompt_tokens: 99_999, completion_tokens: 0, total_tokens: 99_999 },
          bytes: 4_096,
          latency_ms: 12.5,
          sourceRef: 'provider:openai:response',
        }),
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--provider-usage',
        usagePath,
        '--provider',
        'openai',
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        discovery: { status: string };
        usage: {
          discoveryTokens: number;
          measurement: string;
          metrics: { bytes: number; latencyMs: number };
          events: Array<{ provider?: string; tokens: number }>;
        };
      };
      expect(bounded.discovery.status).toBe('discovery-capped');
      expect(bounded.usage).toMatchObject({
        discoveryTokens: 99_999,
        measurement: 'measured',
        metrics: { bytes: 4_096, latencyMs: 12.5 },
      });
      expect(bounded.usage.events[0]).toMatchObject({ provider: 'openai', tokens: 99_999 });
    });

    it('[contract:docs-control-plane.definition-context.usage-input.v1] provider phase가 없으면 override를 요구한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const usagePath = join(tempRoot, 'provider-usage-without-phase.json');
      await writeFile(
        usagePath,
        JSON.stringify({
          provider: 'generic',
          usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        }),
      );

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--provider-usage',
          usagePath,
          '--provider',
          'generic',
          '--json',
        ]),
      ).rejects.toThrow('--provider-phase');

      vi.mocked(console.log).mockClear();
      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--provider-usage',
        usagePath,
        '--provider',
        'generic',
        '--provider-phase',
        'working',
        '--json',
      ]);
      const bounded = JSON.parse(getOutput()) as {
        usage: { events: Array<{ phase: string; provider?: string }> };
      };
      expect(bounded.usage.events[0]).toMatchObject({ phase: 'working', provider: 'generic' });
    });

    it('[contract:docs-control-plane.definition-context.provider-tokenizer-module.v1] 외부 tokenizer module을 bounded runtime에 연결한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const modulePath = join(tempRoot, 'provider-tokenizer.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', tokenizerRevision: 'fixture-v1', count: () => 1 };\n`,
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--tokenizer-module',
        modulePath,
        '--tokenizer-provider',
        'generic',
        '--tokenizer-model',
        'fixture-model',
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        tokenCounter?: { provider: string; model: string; tokenizerRevision: string };
        usage: {
          measurement: string;
          events: Array<{
            measurement: string;
            provider?: string;
            model?: string;
            tokenizerRevision?: string;
          }>;
        };
      };
      expect(bounded.tokenCounter).toEqual({
        provider: 'generic',
        model: 'fixture-model',
        tokenizerRevision: 'fixture-v1',
      });
      expect(bounded.usage.measurement).toBe('measured');
      expect(bounded.usage.events.every((event) => event.measurement === 'measured')).toBe(true);
      expect(
        bounded.usage.events.every(
          (event) =>
            event.provider === 'generic' &&
            event.model === 'fixture-model' &&
            event.tokenizerRevision === 'fixture-v1',
        ),
      ).toBe(true);
    });

    it('[contract:docs-control-plane.definition-context.provider-tokenizer-module.invalid-selection.v1] tokenizer 선택 불일치 시 bounded 실행을 시작하지 않는다', async () => {
      await runDef(['sync']);
      const modulePath = join(tempRoot, 'provider-tokenizer-mismatch.mjs');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', count: () => 1 };\n`,
      );

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--tokenizer-module',
          modulePath,
          '--tokenizer-model',
          'wrong-model',
          '--json',
        ]),
      ).rejects.toMatchObject({ code: 'provider-tokenizer-selection-mismatch' });
    });

    it('[contract:docs-control-plane.definition-context.provider-tokenizer-registry.v1] provider/model registry에서 외부 tokenizer module을 선택한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const modulePath = join(tempRoot, 'provider-tokenizer-registry.mjs');
      const registryPath = join(tempRoot, 'provider-tokenizer-registry.json');
      await writeFile(
        modulePath,
        `export default { provider: 'generic', model: 'fixture-model', tokenizerRevision: 'fixture-v1', count: () => 1 };\n`,
      );
      await writeFile(
        registryPath,
        JSON.stringify({
          version: 'v1',
          entries: [
            {
              provider: 'generic',
              model: 'fixture-model',
              module: './provider-tokenizer-registry.mjs',
              tokenizerRevision: 'fixture-v1',
            },
          ],
        }),
      );

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--tokenizer-registry',
        registryPath,
        '--tokenizer-provider',
        'generic',
        '--tokenizer-model',
        'fixture-model',
        '--json',
      ]);

      const bounded = JSON.parse(getOutput()) as {
        tokenCounter?: { provider: string; model: string; tokenizerRevision: string };
        usage: { measurement: string };
      };
      expect(bounded.tokenCounter).toEqual({
        provider: 'generic',
        model: 'fixture-model',
        tokenizerRevision: 'fixture-v1',
      });
      expect(bounded.usage.measurement).toBe('measured');
    });

    it('[contract:docs-control-plane.definition-context.handoff-persistence.v1] 닫힌 bounded context의 Typed Handoff를 로컬 store에 저장한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(tempRoot, 'handoffs', 'definition.json');

      await runDef([
        'context',
        'definition-addressing',
        '--bounded',
        '--handoff-out',
        handoffPath,
        '--result-revision',
        'review:definition-addressing:1',
        '--unresolved-questions',
        'split-body,confirm-owner',
        '--next-task-key',
        'definition-review',
        '--next-task-objective',
        'Review the definition boundary',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        handoff: {
          taskKey: string;
          sourceRevision: string;
          resultRevision: string;
          unresolvedQuestions: string[];
          nextTask?: { taskKey: string };
        };
      };
      expect(output.handoff).toMatchObject({
        taskKey: 'definition-context:definition-addressing',
        sourceRevision: expect.stringContaining('definition-addressing:revision:'),
        resultRevision: 'review:definition-addressing:1',
        unresolvedQuestions: ['confirm-owner', 'split-body'],
        nextTask: { taskKey: 'definition-review' },
      });
      const persisted = JSON.parse(await readFile(handoffPath, 'utf8')) as {
        version: string;
        handoffs: Array<{ manifestDigest: string }>;
      };
      expect(persisted.version).toBe('v1');
      expect(persisted.handoffs).toHaveLength(1);
      expect(persisted.handoffs[0]?.manifestDigest).toMatch(/^fnv1a64:/);

      vi.mocked(console.log).mockClear();
      await runDef(['handoff', handoffPath, 'definition-context:definition-addressing', '--json']);
      const history = JSON.parse(getOutput()) as Array<{ resultRevision: string }>;
      expect(history).toHaveLength(1);
      expect(history[0]?.resultRevision).toBe('review:definition-addressing:1');
    });

    it('[contract:docs-control-plane.definition-context.handoff-persistence.v1] result revision과 닫힌 Working Context 없이는 Handoff를 저장하지 않는다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(tempRoot, 'handoffs', 'blocked.json');

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--handoff-out',
          handoffPath,
          '--json',
        ]),
      ).rejects.toThrow('--result-revision');

      await expect(
        runDef([
          'context',
          'definition-addressing',
          '--bounded',
          '--used-tokens',
          '100000',
          '--handoff-out',
          handoffPath,
          '--result-revision',
          'review:blocked',
          '--json',
        ]),
      ).rejects.toThrow('닫힌 Working Context');

      await expect(readFile(handoffPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('[contract:docs-control-plane.definition-context.handoff-aggregation.v1] child Handoff를 parent Handoff로 집계한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(tempRoot, 'handoffs', 'children.json');
      const decompositionPath = join(tempRoot, 'decomposition.json');
      const parentTaskKey = 'definition-context:parent';
      const childTaskKeys = [`${parentTaskKey}/discovery/a`, `${parentTaskKey}/discovery/b`];

      await mkdir(join(tempRoot, 'handoffs'), { recursive: true });

      await writeFile(
        decompositionPath,
        JSON.stringify({
          parentTaskKey,
          reason: 'budget-exhausted',
          children: childTaskKeys.map((taskKey, index) => ({
            taskKey,
            objective: `Inspect ${index}`,
            anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
            routeKeys: [`route.${index}`],
            estimatedCostTokens: 1_000,
            estimatedObjectCount: 1,
            estimatedRelationCount: 1,
          })),
        }),
      );
      await writeFile(
        handoffPath,
        JSON.stringify({
          version: 'v1',
          handoffs: childTaskKeys.map((taskKey, index) => ({
            version: 'v1',
            taskKey,
            sourceRevision: `source:${index}`,
            resultRevision: `result:${index}`,
            manifestDigest: `fnv1a64:child-${index}`,
            factRefs: [
              {
                factKey: `definition.fact.${index}`,
                revision: 'definition:42',
                evidenceRefs: [`definition:evidence:${index}`],
              },
            ],
            evidenceRefs: [`definition:evidence:${index}`],
            unresolvedQuestions: [`question:${index}`],
          })),
        }),
      );

      await runDef([
        'handoff-aggregate',
        handoffPath,
        decompositionPath,
        '--source-revision',
        'parent-source:42',
        '--result-revision',
        'parent-result:7',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        taskKey: string;
        childTaskKeys: string[];
        factRefs: Array<{ factKey: string }>;
      };
      expect(output).toMatchObject({
        taskKey: parentTaskKey,
        childTaskKeys,
        factRefs: [{ factKey: 'definition.fact.0' }, { factKey: 'definition.fact.1' }],
      });

      const persisted = JSON.parse(await readFile(handoffPath, 'utf8')) as {
        handoffs: Array<{ taskKey: string; childTaskKeys?: string[] }>;
      };
      expect(persisted.handoffs).toHaveLength(3);
      expect(persisted.handoffs.find((handoff) => handoff.taskKey === parentTaskKey)).toMatchObject(
        {
          childTaskKeys,
        },
      );
    });

    it('[contract:docs-control-plane.definition-context.discovery-result-policy.v1] discovery child는 refs로 분리하고 resolution child만 parent Handoff에 포함한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();
      const handoffPath = join(tempRoot, 'handoffs', 'mixed.json');
      const decompositionPath = join(tempRoot, 'mixed-decomposition.json');
      const discoveryResultsPath = join(tempRoot, 'discovery-results.json');
      const parentTaskKey = 'definition-context:mixed-parent';
      const discoveryTaskKey = `${parentTaskKey}/discovery/graph`;
      const resolutionTaskKey = `${parentTaskKey}/discovery/resolution`;

      await mkdir(join(tempRoot, 'handoffs'), { recursive: true });
      await writeFile(
        decompositionPath,
        JSON.stringify({
          parentTaskKey,
          reason: 'budget-exhausted',
          children: [
            {
              taskKey: discoveryTaskKey,
              objective: 'Inspect definition graph references',
              anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
              routeKeys: ['route.graph'],
              estimatedCostTokens: 1_000,
              estimatedObjectCount: 1,
              estimatedRelationCount: 1,
            },
            {
              taskKey: resolutionTaskKey,
              objective: 'Resolve authoritative definition facts',
              anchor: { anchorKey: 'definition:parent', ref: 'definition:parent', kind: 'entity' },
              routeKeys: ['route.resolution'],
              estimatedCostTokens: 1_000,
              estimatedObjectCount: 1,
              estimatedRelationCount: 1,
            },
          ],
        }),
      );
      await writeFile(
        discoveryResultsPath,
        JSON.stringify({
          discoveryRefs: [
            {
              taskKey: discoveryTaskKey,
              routeKeys: ['route.graph'],
              sourceRefs: ['definition:graph:42'],
              unresolvedQuestions: ['confirm-graph-owner'],
            },
          ],
          unresolvedQuestions: ['confirm-parent-owner'],
        }),
      );
      await writeFile(
        handoffPath,
        JSON.stringify({
          version: 'v1',
          handoffs: [
            {
              version: 'v1',
              taskKey: resolutionTaskKey,
              sourceRevision: 'source:resolution',
              resultRevision: 'result:resolution',
              manifestDigest: 'fnv1a64:resolution',
              factRefs: [
                {
                  factKey: 'definition.fact.resolution',
                  revision: 'definition:42',
                  evidenceRefs: ['definition:evidence:resolution'],
                },
              ],
              evidenceRefs: ['definition:evidence:resolution'],
              unresolvedQuestions: ['confirm-resolution-owner'],
            },
          ],
        }),
      );

      await runDef([
        'handoff-aggregate',
        handoffPath,
        decompositionPath,
        '--discovery-results',
        discoveryResultsPath,
        '--source-revision',
        'parent-source:mixed',
        '--result-revision',
        'parent-result:mixed',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        handoff: { taskKey: string; childTaskKeys: string[]; factRefs: Array<{ factKey: string }> };
        discoveryRefs: Array<{ taskKey: string; sourceRefs: string[] }>;
        unresolvedQuestions: string[];
      };
      expect(output.handoff).toMatchObject({
        taskKey: parentTaskKey,
        childTaskKeys: [resolutionTaskKey],
        factRefs: [{ factKey: 'definition.fact.resolution' }],
      });
      expect(output.discoveryRefs).toEqual([
        {
          taskKey: discoveryTaskKey,
          routeKeys: ['route.graph'],
          sourceRefs: ['definition:graph:42'],
        },
      ]);
      expect(output.unresolvedQuestions).toEqual([
        'confirm-graph-owner',
        'confirm-parent-owner',
        'confirm-resolution-owner',
      ]);
    });

    it('알 수 없는 서브커맨드면 help 출력', async () => {
      await runDef(['nonexistent-command']);
      const output = getOutput();
      expect(output).toContain('qa-sdk def');
    });
  });
});
