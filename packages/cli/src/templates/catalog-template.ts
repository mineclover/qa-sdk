// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * 카탈로그 템플릿 함수.
 */

export interface CatalogTemplateInput {
  readonly name: string;
  readonly id: string;
  readonly axes?: readonly {
    readonly id: string;
    readonly name: string;
    readonly entries: readonly string[];
  }[];
  readonly prefixes?: readonly {
    readonly id: string;
    readonly name: string;
    readonly dims: readonly string[];
  }[];
}

/** .catalog.ts 파일 내용 생성 */
export function generateCatalogTs(input: CatalogTemplateInput): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * ${input.name} — 카탈로그 정의.`);
  lines.push(` *`);
  lines.push(` * qa-sdk가 사용하는 차원 압축 기반 DSL DB 스키마.`);
  lines.push(` */`);
  lines.push(``);

  // Axes
  lines.push(`export const CATALOG = {`);
  lines.push(`  id: "${input.id}",`);
  lines.push(`  name: "${input.name}",`);
  lines.push(`  axes: {`);

  for (const axis of input.axes ?? []) {
    const entriesStr = axis.entries.map((e) => `"${e}"`).join(', ');
    lines.push(`    ${axis.id}: {`);
    lines.push(`      id: "${axis.id}", name: "${axis.name}",`);
    lines.push(`      versions: {`);
    lines.push(`        v1: { entries: [${entriesStr}], capacity: 32 },`);
    lines.push(`      },`);
    lines.push(`    },`);
  }

  lines.push(`  },`);

  // Prefixes
  lines.push(`  prefixes: {`);

  for (const prefix of input.prefixes ?? []) {
    const labels = prefix.dims.map((d) => `"${d}"`).join(', ');
    lines.push(`    ${prefix.id}: {`);
    lines.push(`      id: "${prefix.id}", name: "${prefix.name}",`);
    lines.push(`      labels: [${labels}],`);
    lines.push(`      dims: {`);
    for (const dim of prefix.dims) {
      lines.push(`        ${dim}: { kind: "axis", axisId: "${dim}" },`);
    }
    lines.push(`      },`);
    lines.push(`      versions: [`);
    const axisVersions = prefix.dims.map((d) => `${d}: "v1"`).join(', ');
    lines.push(`        { version: "v1", axisVersions: { ${axisVersions} } },`);
    lines.push(`      ],`);
    lines.push(`    },`);
  }

  lines.push(`  },`);
  lines.push(`} as const;`);
  lines.push(``);

  return lines.join('\n');
}

/** DKG config 파일 내용 생성 (빈 템플릿) */
export function generateDkgConfigTs(input: CatalogTemplateInput): string {
  return `/**
 * ${input.name} — DKG 부트스트랩 설정.
 *
 * 도메인, 소비자, 제약, DSL 번들 등을 선언적으로 정의.
 */

export const DKG_CONFIG = {
  domains: [],
  consumers: [],
  constraints: [],
  dslBundles: [],
  intentLinks: [],
  skills: [],
} as const;
`;
}

/** qa-sdk.config.ts 파일 내용 생성 */
export function generateConfigTs(catalogFileName: string): string {
  return `/**
 * qa-sdk 프로젝트 설정.
 */

export default {
  catalog: "./${catalogFileName}",
};
`;
}
