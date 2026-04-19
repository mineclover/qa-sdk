// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * Relational Instance — relational prefix로 관계 인스턴스를 인코딩/조회.
 *
 * relational prefix (subjectKind × predicate × objectKind)의 좌표를 사용하여
 * "user:42 has role:admin" 같은 관계를 정수 주소로 표현한다.
 *
 * 주소는 관계 유형을 식별한다. 구체적 인스턴스(42, admin)는 좌표 밖.
 */

import type { Catalog } from "@qa-sdk/core";
import { encodePrefixByValue, decodePrefix } from "@qa-sdk/core";

export interface RelationTypeAddress {
  /** relational prefix 주소 */
  readonly address: string;
  /** 관계 유형 */
  readonly subjectKind: string;
  readonly predicate: string;
  readonly objectKind: string;
}

export interface RelationInstance {
  /** 관계 유형 주소 */
  readonly typeAddress: string;
  /** 주체 인스턴스 (좌표 밖) */
  readonly subjectId: string | number;
  /** 객체 인스턴스 (좌표 밖) */
  readonly objectId: string | number;
}

/**
 * 관계 유형을 인코딩한다.
 *
 * "user has role" → relational:v1:ADDRESS
 */
export function encodeRelationType(
  catalog: Catalog,
  subject: string,
  predicate: string,
  object: string,
  version?: string,
): RelationTypeAddress {
  const prefix = catalog.prefixes.relational;
  const ver = version ?? prefix.versions[prefix.versions.length - 1].version;

  const address = encodePrefixByValue(catalog, "relational", ver, {
    subjectKind: subject,
    predicate,
    objectKind: object,
  });

  return {
    address: `relational:${ver}:${address}`,
    subjectKind: subject,
    predicate,
    objectKind: object,
  };
}

/**
 * 관계 유형 주소를 디코딩한다.
 */
export function decodeRelationType(
  catalog: Catalog,
  serialized: string,
): RelationTypeAddress {
  const [, version, addrStr] = serialized.split(":");
  const address = Number(addrStr);
  const decoded = decodePrefix(catalog, "relational", version, address);

  return {
    address: serialized,
    subjectKind: String(decoded.subjectKind.value),
    predicate: String(decoded.predicate.value),
    objectKind: String(decoded.objectKind.value),
  };
}

/**
 * 관계 인스턴스를 생성한다.
 *
 * 관계 유형(좌표) + 구체적 인스턴스(좌표 밖)를 결합.
 * EventRecord의 payload에 넣을 형태.
 */
export function createRelationInstance(
  catalog: Catalog,
  subject: { kind: string; id: string | number },
  predicate: string,
  object: { kind: string; id: string | number },
): RelationInstance {
  const type = encodeRelationType(catalog, subject.kind, predicate, object.kind);

  return {
    typeAddress: type.address,
    subjectId: subject.id,
    objectId: object.id,
  };
}

/**
 * 특정 관계 유형의 모든 가능한 조합을 나열한다.
 * 예: "user × has × *" → role, permission, group, resource
 */
export function listRelationObjects(
  catalog: Catalog,
  subjectKind: string,
  predicate: string,
  version?: string,
): string[] {
  const axis = (catalog.axes as Record<string, { versions: Record<string, { entries: readonly string[] }> }>).objectKind;
  if (!axis) return [];

  const versions = Object.keys(axis.versions);
  const ver = version ?? versions[versions.length - 1];
  const entries = axis.versions[ver]?.entries ?? [];

  return entries.filter(e => e !== "_").map(e => String(e));
}
