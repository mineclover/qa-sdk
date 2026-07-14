import { useMemo } from 'react';
import {
  parseDecisionFile,
  toFlowSchema,
  toMarkdownText,
  extractEvidence,
  extractOptionAnnotations,
  type DecisionFile,
} from 'taxonomy-decision-bridge';
import type { FlowSchema } from 'decision-flow';
import { verifyRoundtrip } from '../../lib/decisionDemo';

/**
 * 현재 file→schema에 대해 toMarkdown → reparse → toFlowSchema 결과의 의미 보존 여부를 표시.
 * useMemo로 schema 변경 시에만 재계산.
 */
export function RoundtripBadge({ file, schema }: { file: DecisionFile; schema: FlowSchema }) {
  const result = useMemo(() => {
    try {
      const md = toMarkdownText({
        schema,
        lifecycle: file.meta.lifecycle,
        evidence: extractEvidence(file),
        optionAnnotations: extractOptionAnnotations(file),
        outcome: file.markers.outcome,
        created: file.meta.created,
        updated: file.meta.updated,
      });
      const reparsed = toFlowSchema(parseDecisionFile(md));
      return verifyRoundtrip(schema, reparsed);
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }, [file, schema]);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono ${
        result.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
      title={result.ok ? '라운드트립 의미 보존' : result.reason}
    >
      {result.ok ? '✅ round-trip OK' : '⚠ round-trip drift'}
    </span>
  );
}
