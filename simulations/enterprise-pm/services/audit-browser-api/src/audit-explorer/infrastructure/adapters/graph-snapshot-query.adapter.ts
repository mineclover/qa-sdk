// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import type {
  AuthorizationGraphSnapshotRecord,
  AuthorizationGraphStore,
} from "authorization-ontology";
import { GraphSnapshotQueryPort } from "../../application/ports/graph-snapshot-query.port.js";

/**
 * GraphSnapshotQueryPort 의 어댑터.
 *
 * graph-explorer 슬라이스가 같은 프로세스 안에 있을 때는 AuthorizationGraphStore 를
 * 직접 위임 (in-process 로 다른 도메인 read API 를 호출하는 BFF 패턴). 추후
 * graph-explorer 가 별도 서비스로 분리되면 본 어댑터를 HTTP client 로 교체한다.
 */
export class GraphSnapshotQueryAdapter extends GraphSnapshotQueryPort {
  constructor(private readonly store: AuthorizationGraphStore) {
    super();
  }

  async latest(graphId: string): Promise<AuthorizationGraphSnapshotRecord | null> {
    const snapshots = await this.store.listSnapshots({ graphId });
    return snapshots[snapshots.length - 1] ?? null;
  }
}
