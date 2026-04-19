// @def.doc definition-catalog-spec

/**
 * DB row → DefinitionEntryInput 변환 헬퍼.
 *
 * local-data-source (DefDoc)와 graph.service (NestJS entity) 양쪽에서
 * 동일한 매핑 로직을 사용한다. row 타입이 다르므로 공통 인터페이스로 받는다.
 */

import type { DefinitionEntry, DefinitionEntryInput } from "./types.js";
import type { QualityGateSpec } from "work-domain";

/** validate()용 DB row → DefinitionEntryInput 변환에 필요한 최소 필드 */
export interface DocRow {
  docId: string;
  title?: string | null;
  /** local-data-source는 `type`, graph.service는 `docType` */
  type?: string | null;
  docType?: string | null;
  knowledgeKind?: string | null;
  level?: string | null;
  scope: string;
  aspect: string;
  depth: string;
  lifecycle: string;
  layer?: string | null;
  tags: readonly string[];
  svc?: string | null;
  gate?: QualityGateSpec | null;
  sourcePath?: string | null;
  syncedAt?: string;
}

export function docRowToRegistryInput(doc: DocRow): DefinitionEntryInput {
  const docType = doc.docType ?? doc.type;
  return {
    id: doc.docId,
    title: doc.title ?? doc.docId,
    ...(docType ? { type: docType as DefinitionEntry["type"] } : {}),
    ...(doc.knowledgeKind ? { knowledgeKind: doc.knowledgeKind as DefinitionEntry["knowledgeKind"] } : {}),
    ...(doc.level ? { level: doc.level as DefinitionEntry["level"] } : {}),
    scope: doc.scope as DefinitionEntry["scope"],
    aspect: doc.aspect as DefinitionEntry["aspect"],
    depth: doc.depth as DefinitionEntry["depth"],
    lifecycle: doc.lifecycle as DefinitionEntry["lifecycle"],
    ...(doc.layer ? { layer: doc.layer as DefinitionEntry["layer"] } : {}),
    ...(doc.tags.length > 0 ? { tags: [...doc.tags] } : {}),
    ...(doc.svc ? { serviceId: doc.svc } : {}),
    ...(doc.gate ? { gate: doc.gate } : {}),
    ...(doc.sourcePath ? { ref: doc.sourcePath } : {}),
    createdAt: doc.syncedAt ?? "",
    updatedAt: doc.syncedAt ?? "",
  };
}
