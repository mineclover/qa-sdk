// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain query port — graph-explorer 슬라이스의 snapshot read 표면.
 *
 * audit-explorer 의 context BFF 가 trace + graph snapshot 을 합성할 때 사용.
 * graph-explorer 도메인의 내부 구현(AuthorizationGraphStore)에 직접 의존하지 않고
 * 본 port 를 통해서만 접근한다.
 */
import type { AuthorizationGraphSnapshotRecord } from 'authorization-ontology';

export abstract class GraphSnapshotQueryPort {
  /** graphId 기준 가장 최신 snapshot. 없으면 null. */
  abstract latest(graphId: string): Promise<AuthorizationGraphSnapshotRecord | null>;
}
