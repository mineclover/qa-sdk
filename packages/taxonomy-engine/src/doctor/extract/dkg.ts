import type { ExpectedTaxonomy } from '../index.js';
import { extractIdsFromMarkdownTable } from './helpers.js';

/**
 * extractDkgExpected — DKG spec markdown 두 파일에서 expected taxonomy 생성.
 *
 * node-kind: dkg-node-types.spec.md 두 번째 칼럼 (index 1) — "노드"
 * edge-kind: dkg-edge-types.spec.md 두 번째 칼럼 (index 1) — "엣지 타입"
 *
 * node-tier / edge-group 는 yaml slug 기반이라 spec 표에서 직접 파생 어려움 → skip.
 */
export function extractDkgExpected(nodeTypesMd: string, edgeTypesMd: string): ExpectedTaxonomy {
  const nodeIds = extractIdsFromMarkdownTable(nodeTypesMd, 1);
  const edgeIds = extractIdsFromMarkdownTable(edgeTypesMd, 1);

  return {
    taxonomy: 'dkg-schema',
    axes: {
      'node-kind': {
        entries: nodeIds.map((id) => ({ id })),
      },
      'edge-kind': {
        entries: edgeIds.map((id) => ({ id })),
      },
    },
  };
}
