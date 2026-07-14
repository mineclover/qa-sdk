// @def.boundary platform-chain-system
/**
 * demo-bridge.ts — DEMO_CATALOG → 외부 시스템 변환 브릿지.
 *
 * - catalogToRegistryInput(): MetaRegistry 입력 형식
 * - catalogToPrefixCodecInput(): PrefixCodec 생성에 필요한 데이터
 */

import { DEMO_CATALOG, type DemoCatalog } from './demo-catalog.js';
import { decodePrefix } from '@qa-sdk/core/catalog';

// ── MetaRegistry 입력 ───────────────────────────────────────────────────────

function buildEntryRefs(count: number, indexId: string, versionId: string) {
  const refs: Record<number, { indexId: string; versionId: string }> = {};
  for (let i = 1; i <= count; i++) refs[i] = { indexId, versionId };
  return refs;
}

function getRegistryDimSize(
  catalog: DemoCatalog,
  prefixId: string,
  versionId: string,
  label: string,
): number {
  const prefix = catalog.prefixes[prefixId];
  const version = prefix.versions.find((candidate) => candidate.version === versionId);
  if (!version) {
    throw new Error(`Unknown prefix version: ${prefixId}/${versionId}`);
  }

  const dim = prefix.dims[label];
  if (dim.kind === 'axis') {
    return catalog.axes[dim.axisId].versions[version.axisVersions[label]].entries.length;
  }

  return version.refEntries?.[label]?.values.length ?? 0;
}

function toRegistryIndexRefValue(
  catalog: DemoCatalog,
  prefixId: string,
  versionId: string,
  rawValue: number,
): number {
  const prefix = catalog.prefixes[prefixId];
  const decoded = decodePrefix(catalog, prefixId, versionId, rawValue);

  let encoded = 0;
  let stride = 1;
  for (let index = prefix.labels.length - 1; index >= 0; index -= 1) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- for 루프 인덱스 범위 내 보장
    const label = prefix.labels[index]!;
    encoded += decoded[label].position * stride;
    stride *= getRegistryDimSize(catalog, prefixId, versionId, label);
  }
  return encoded;
}

/**
 * DEMO_CATALOG에서 MetaRegistry 생성에 필요한 순수 데이터 객체를 생성한다.
 * 기존 buildDemoRegistryInput()과 동일한 형식을 반환.
 */
export function catalogToRegistryInput(catalog: DemoCatalog = DEMO_CATALOG) {
  const svcPrefix = catalog.prefixes.service;
  const permPrefix = catalog.prefixes.permission;
  const evtPrefix = catalog.prefixes.event;

  // dims: 각 label을 MetaRegistry dim으로 변환
  const dims: Record<
    string,
    {
      kind: { type: string; indexId?: string };
      snapshots: Record<
        string,
        { entries: readonly (string | number)[]; entryRefs?: ReturnType<typeof buildEntryRefs> }
      >;
    }
  > = {};

  // service prefix의 axis dims
  for (const label of svcPrefix.labels) {
    const dim = svcPrefix.dims[label];
    if (dim.kind !== 'axis') continue;
    const axis = catalog.axes[dim.axisId];
    const snapshots: Record<string, { entries: (string | number)[] }> = {};
    for (const vdef of svcPrefix.versions) {
      const axisVer = vdef.axisVersions[label];
      const snap = axis.versions[axisVer];
      snapshots[vdef.version] = { entries: [...snap.entries] };
    }
    dims[label] = { kind: { type: 'string_enum' }, snapshots };
  }

  // permission prefix dims
  for (const label of permPrefix.labels) {
    const dim = permPrefix.dims[label];
    if (dim.kind === 'prefix_ref') {
      // index_ref dim (perm_svc)
      const snapshots: Record<
        string,
        { entries: (string | number)[]; entryRefs?: ReturnType<typeof buildEntryRefs> }
      > = {};
      for (const vdef of permPrefix.versions) {
        const ref = vdef.refEntries?.[label];
        if (ref) {
          snapshots[vdef.version] = {
            entries: ref.values.map((value) =>
              toRegistryIndexRefValue(catalog, dim.prefixId, ref.refVersion, value),
            ),
            entryRefs: buildEntryRefs(ref.values.length, dim.prefixId, ref.refVersion),
          };
        }
      }
      dims[label] = { kind: { type: 'index_ref', indexId: dim.prefixId }, snapshots };
    } else if (dim.kind === 'axis') {
      const axis = catalog.axes[dim.axisId];
      const snapshots: Record<string, { entries: (string | number)[] }> = {};
      for (const vdef of permPrefix.versions) {
        const axisVer = vdef.axisVersions[label];
        const snap = axis.versions[axisVer];
        snapshots[vdef.version] = { entries: [...snap.entries] };
      }
      dims[label] = { kind: { type: 'string_enum' }, snapshots };
    }
    // table_ref: MetaRegistry dims에 포함하지 않음 (동적 데이터)
  }

  // event prefix dims
  for (const label of evtPrefix.labels) {
    if (dims[label]) continue; // initiator는 이미 처리 가능
    const dim = evtPrefix.dims[label];
    if (dim.kind === 'prefix_ref') {
      const snapshots: Record<
        string,
        { entries: (string | number)[]; entryRefs?: ReturnType<typeof buildEntryRefs> }
      > = {};
      for (const vdef of evtPrefix.versions) {
        const ref = vdef.refEntries?.[label];
        if (ref) {
          snapshots[vdef.version] = {
            entries: ref.values.map((value) =>
              toRegistryIndexRefValue(catalog, dim.prefixId, ref.refVersion, value),
            ),
            entryRefs: buildEntryRefs(ref.values.length, dim.prefixId, ref.refVersion),
          };
        }
      }
      dims[label] = { kind: { type: 'index_ref', indexId: dim.prefixId }, snapshots };
    } else if (dim.kind === 'axis') {
      const axis = catalog.axes[dim.axisId];
      const snapshots: Record<string, { entries: (string | number)[] }> = {};
      for (const vdef of evtPrefix.versions) {
        const axisVer = vdef.axisVersions[label];
        const snap = axis.versions[axisVer];
        snapshots[vdef.version] = { entries: [...snap.entries] };
      }
      dims[label] = { kind: { type: 'string_enum' }, snapshots };
    }
    // table_ref: skip
  }

  // indices: 각 prefix → index 변환
  function buildIndexVersions(prefix: (typeof catalog.prefixes)[string]) {
    const versions: Record<string, { snapshots: Record<string, string> }> = {};
    for (const vdef of prefix.versions) {
      const snapshots: Record<string, string> = {};
      for (const label of prefix.labels) {
        const dim = prefix.dims[label];
        if (dim.kind === 'axis') {
          snapshots[label] = vdef.axisVersions[label];
        } else {
          // prefix_ref: use the version of the prefix itself
          snapshots[label] = vdef.version;
        }
      }
      versions[vdef.version] = { snapshots };
    }
    return versions;
  }

  return {
    dims,
    indices: {
      service: {
        dims: [...svcPrefix.labels],
        versions: buildIndexVersions(svcPrefix),
      },
      permission: {
        dims: [...permPrefix.labels],
        versions: buildIndexVersions(permPrefix),
      },
      event: {
        dims: [...evtPrefix.labels],
        versions: buildIndexVersions(evtPrefix),
      },
    },
  };
}

// ── PrefixCodec 입력 ────────────────────────────────────────────────────────

export interface LabelRegistryInput {
  [label: string]: { version: string; ids: string[] }[];
}

export interface PrefixCodecPrefixInput {
  labels: string[];
  versions: { version: string; labelVersions: Record<string, string> }[];
}

export interface PrefixCodecInput {
  labels: LabelRegistryInput;
  prefixes: Record<string, PrefixCodecPrefixInput>;
}

/**
 * DEMO_CATALOG에서 PrefixCodec 생성에 필요한 입력 데이터를 생성한다.
 * permission-engine의 createLabelRegistry + PrefixCodec 생성자에 직접 전달 가능.
 */
export function catalogToPrefixCodecInput(catalog: DemoCatalog = DEMO_CATALOG): PrefixCodecInput {
  // 사용되는 모든 axis label의 version별 ids 수집
  const labels: LabelRegistryInput = {};

  for (const prefix of Object.values(catalog.prefixes)) {
    for (const label of prefix.labels) {
      if (labels[label]) continue;
      const dim = prefix.dims[label];
      if (dim.kind !== 'axis') continue;

      const axis = catalog.axes[dim.axisId];
      const versionEntries: { version: string; ids: string[] }[] = [];
      for (const [ver, snap] of Object.entries(axis.versions)) {
        versionEntries.push({ version: ver, ids: [...snap.entries] });
      }
      labels[label] = versionEntries;
    }
  }

  // prefix별 PrefixCodec 입력
  const prefixes: Record<string, PrefixCodecPrefixInput> = {};

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    const axisLabels = prefix.labels.filter((l) => prefix.dims[l].kind === 'axis');
    const versions = prefix.versions.map((vdef) => ({
      version: vdef.version,
      labelVersions: Object.fromEntries(
        axisLabels.map((label) => [label, vdef.axisVersions[label]]),
      ),
    }));
    prefixes[prefixId] = { labels: [...axisLabels], versions };
  }

  return { labels, prefixes };
}
