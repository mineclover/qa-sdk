/**
 * Catalog Merge — 서비스별 분리된 카탈로그를 합치는 유틸.
 *
 * 각 서비스가 자기 카탈로그(axes + prefixes)를 정의하고,
 * mergeCatalogs()로 전체 DEMO_CATALOG 수준의 통합 카탈로그를 생성한다.
 *
 * 충돌 감지: 같은 ID의 axis/prefix가 다른 서비스에서 다르게 정의되면 에러.
 */

export interface PartialCatalog {
  readonly id: string;  // "shopping", "infra", "observation" 등
  readonly axes?: Record<string, unknown>;
  readonly prefixes?: Record<string, unknown>;
  readonly tables?: Record<string, unknown>;
}

export interface MergeResult {
  readonly catalog: {
    axes: Record<string, unknown>;
    prefixes: Record<string, unknown>;
    tables: Record<string, unknown>;
  };
  readonly sources: Record<string, string>;  // axisId/prefixId → sourceId
  readonly conflicts: readonly MergeConflict[];
}

export interface MergeConflict {
  readonly type: "axis" | "prefix" | "table";
  readonly id: string;
  readonly sources: readonly string[];
  readonly message: string;
}

/**
 * 여러 partial 카탈로그를 하나로 합친다.
 * 충돌이 있으면 conflicts에 기록 (에러를 던지지 않음).
 */
export function mergeCatalogs(catalogs: readonly PartialCatalog[]): MergeResult {
  const axes: Record<string, unknown> = {};
  const prefixes: Record<string, unknown> = {};
  const tables: Record<string, unknown> = {};
  const sources: Record<string, string> = {};
  const conflicts: MergeConflict[] = [];

  for (const cat of catalogs) {
    // axes
    if (cat.axes) {
      for (const [id, def] of Object.entries(cat.axes)) {
        if (axes[id]) {
          // 이미 있으면 충돌 검사
          if (JSON.stringify(axes[id]) !== JSON.stringify(def)) {
            conflicts.push({
              type: "axis",
              id,
              sources: [sources[`axis:${id}`], cat.id],
              message: `Axis "${id}" defined differently in ${sources[`axis:${id}`]} and ${cat.id}`,
            });
          }
          // 같으면 무시 (공유 축)
        } else {
          axes[id] = def;
          sources[`axis:${id}`] = cat.id;
        }
      }
    }

    // prefixes
    if (cat.prefixes) {
      for (const [id, def] of Object.entries(cat.prefixes)) {
        if (prefixes[id]) {
          conflicts.push({
            type: "prefix",
            id,
            sources: [sources[`prefix:${id}`], cat.id],
            message: `Prefix "${id}" defined in both ${sources[`prefix:${id}`]} and ${cat.id}`,
          });
        } else {
          prefixes[id] = def;
          sources[`prefix:${id}`] = cat.id;
        }
      }
    }

    // tables
    if (cat.tables) {
      for (const [id, def] of Object.entries(cat.tables)) {
        if (!tables[id]) {
          tables[id] = def;
          sources[`table:${id}`] = cat.id;
        }
      }
    }
  }

  return { catalog: { axes, prefixes, tables }, sources, conflicts };
}

/**
 * 전체 카탈로그에서 특정 서비스의 prefix만 추출한다.
 */
export function extractServiceCatalog(
  fullCatalog: { axes: Record<string, unknown>; prefixes: Record<string, unknown> },
  prefixIds: readonly string[],
): { axes: Record<string, unknown>; prefixes: Record<string, unknown> } {
  type PrefixLike = {
    readonly dims?: Record<string, { readonly kind?: string; readonly axisId?: string }>;
  };

  const prefixes: Record<string, unknown> = {};
  const usedAxes = new Set<string>();

  for (const id of prefixIds) {
    const prefix = fullCatalog.prefixes[id] as PrefixLike | undefined;
    if (!prefix) continue;
    prefixes[id] = prefix;

    // 이 prefix가 사용하는 축 추출
    if (prefix.dims) {
      for (const dimRef of Object.values(prefix.dims)) {
        if (dimRef.kind === "axis" && dimRef.axisId) {
          usedAxes.add(dimRef.axisId);
        }
      }
    }
  }

  const axes: Record<string, unknown> = {};
  for (const axisId of usedAxes) {
    if (fullCatalog.axes[axisId]) {
      axes[axisId] = fullCatalog.axes[axisId];
    }
  }

  return { axes, prefixes };
}
