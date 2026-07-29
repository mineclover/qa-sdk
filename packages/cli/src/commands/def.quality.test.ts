// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it, vi } from 'vitest';
import { useDefCliHarness } from './def-test-helpers.js';

describe('def quality commands', () => {
  const { getOutput, runDef } = useDefCliHarness();

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
});
