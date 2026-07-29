// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it, vi } from 'vitest';
import { useDefCliHarness } from './def-test-helpers.js';

describe('def read and graph navigation commands', () => {
  const { getOutput, runDef } = useDefCliHarness();

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
  });
});
