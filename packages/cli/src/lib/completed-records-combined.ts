// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  deduplicateCompletedRecords,
  detectCompletedRecords,
  type CompletedRecordDetectionOptions,
  type CompletedRecordState,
} from 'doc-envelope';
import { detectCompletedRalphPrdRecords } from 'ralph-tui-integration';

/**
 * cli에서 `doc-envelope`의 범용 `.todo.md` 감지와 `ralph-tui-integration`의
 * ralph PRD 완료 감지를 병합한다. `doc-envelope`과 `ralph-tui-integration`은
 * 서로 모르고, cli는 환경별 소비자로서 둘을 조립한다.
 */
export async function detectCompletedRecordsWithRalphIntegration(
  options: CompletedRecordDetectionOptions,
): Promise<readonly CompletedRecordState[]> {
  const [todoRecords, ralphRecords] = await Promise.all([
    detectCompletedRecords(options),
    Promise.resolve(detectCompletedRalphPrdRecords({ documents: options.documents })),
  ]);
  return deduplicateCompletedRecords([...todoRecords, ...ralphRecords]);
}
