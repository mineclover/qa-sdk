// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
        bindings: Array<{ specId: string; definitionAddress: string; revision: number; bodyHash: string }>;
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
          bindingStatus: 'resolved',
          convention: 'compliant',
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

    it('알 수 없는 서브커맨드면 help 출력', async () => {
      await runDef(['nonexistent-command']);
      const output = getOutput();
      expect(output).toContain('qa-sdk def');
    });
  });
});
