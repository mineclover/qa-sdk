// @def.boundary sim-service-catalog
import {
  parseServicePrefix,
  parseVersionTag,
  type VersionTag,
} from "sim-identifier-grammar";
import type { CatalogPrefixDefinition, Topology } from "./types.js";

export interface TopologyOptions {
  /** 호출 측(controller/gateway 부팅)이 관리하는 catalog revision. */
  revision: number;
}

/**
 * spec 02 §5: catalog refEntries → { stable, candidate, retired } 분류.
 *
 * version 문자열은 grammar canonical(parseVersionTag 통과)이지만,
 * 본 함수는 *entry.state* 값을 단일 진실로 사용한다 (refEntries의 state 필드).
 * 이유: spec 02 §2.1 fixture가 retired 항목에 bare `"v1"`/`"v2"` 표기를 쓰므로
 *      (parseVersionTag 결과 state="stable"), tag-string과 entry.state는 직교 차원.
 * tag-string은 image tag/url 보간용 canonical 표기일 뿐, role assignment의 SSOT가 아니다.
 * (state suffix 강제는 별도 게이트 — buildVersionTag 검증으로 충분.)
 */
export function getCurrentTopology(
  catalog: CatalogPrefixDefinition,
  options: TopologyOptions,
): Topology {
  const prefix = parseServicePrefix(catalog.prefix);
  const stables: VersionTag[] = [];
  const candidates: VersionTag[] = [];
  const retireds: VersionTag[] = [];

  for (const entry of catalog.refEntries) {
    const parsed = parseVersionTag(entry.version);
    // entry.state를 캐스팅한 VersionTag 객체로 정규화 (image tag/header 합성에 그대로 투입 가능)
    const tag: VersionTag = { axis: "version", value: parsed.value, state: entry.state };
    if (entry.state === "stable") stables.push(tag);
    else if (entry.state === "candidate") candidates.push(tag);
    else retireds.push(tag);
  }

  if (stables.length !== 1) {
    throw new Error(
      `getCurrentTopology: invariant — stable count=${stables.length} (정확히 1개, prefix=${catalog.prefix})`,
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `getCurrentTopology: invariant — candidate count=${candidates.length} (0 또는 1개, prefix=${catalog.prefix})`,
    );
  }

  retireds.sort((a, b) => a.value - b.value);
  return {
    prefix,
    stable: stables[0],
    candidate: candidates[0] ?? null,
    retired: retireds,
    revision: options.revision,
  };
}
