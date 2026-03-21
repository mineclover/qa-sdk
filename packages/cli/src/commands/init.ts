/**
 * qa-sdk init — 새 카탈로그 프로젝트 스캐폴딩.
 *
 * Usage:
 *   qa-sdk init                      인터랙티브 프롬프트
 *   qa-sdk init --from demo          데모 카탈로그 복사 후 커스터마이징
 */

import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  generateCatalogTs,
  generateDkgConfigTs,
  generateConfigTs,
  type CatalogTemplateInput,
} from "../templates/catalog-template.js";

export interface InitOptions {
  readonly from?: string;
}

export async function init(options: InitOptions): Promise<void> {
  if (options.from === "demo") {
    return initFromDemo();
  }

  return initInteractive();
}

// ── 데모 기반 초기화 ─────────────────────────────────

async function initFromDemo(): Promise<void> {
  const cwd = process.cwd();

  // 데모 카탈로그 복사
  let demoCatalogSource: string;
  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    demoCatalogSource = `/**
 * 데모 카탈로그에서 복사됨.
 * 필요에 따라 수정하세요.
 */
import { DEMO_CATALOG } from "demo-snapshot";

export default DEMO_CATALOG;
`;
  } catch {
    console.error("demo-snapshot 패키지를 로드할 수 없습니다. pnpm add demo-snapshot 을 실행하세요.");
    process.exit(1);
  }

  const files = [
    { path: "my-project.catalog.ts", content: demoCatalogSource },
    { path: "qa-sdk.config.ts", content: generateConfigTs("my-project.catalog.ts") },
  ];

  for (const file of files) {
    const fullPath = resolve(cwd, file.path);
    if (existsSync(fullPath)) {
      console.log(`⏭ ${file.path} — 이미 존재합니다`);
      continue;
    }
    writeFileSync(fullPath, file.content, "utf-8");
    console.log(`✓ ${file.path}`);
  }

  console.log("\n완료. qa-sdk.config.ts를 수정하여 카탈로그를 커스터마이징하세요.");
}

// ── 인터랙티브 초기화 ────────────────────────────────

async function initInteractive(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  try {
    console.log("qa-sdk init — 새 카탈로그 프로젝트\n");

    // 카탈로그 이름
    const name = (await ask("카탈로그 이름 (예: logistics): ")).trim() || "my-project";
    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

    // 첫 번째 축
    const axisInput = (await ask("첫 번째 축 (이름:항목1,항목2,... 예: warehouse:tokyo,osaka,nagoya): ")).trim();
    const axes: CatalogTemplateInput["axes"] extends readonly (infer T)[] ? T[] : never = [];
    if (axisInput) {
      const [axisName, entriesStr] = axisInput.split(":");
      const entries = entriesStr?.split(",").map(e => e.trim()).filter(Boolean) ?? [];
      if (axisName && entries.length > 0) {
        axes.push({ id: axisName.trim(), name: axisName.trim(), entries });
      }
    }

    // 추가 축
    let addMore = true;
    while (addMore) {
      const more = (await ask("축 추가? (이름:항목1,항목2,... 또는 Enter로 완료): ")).trim();
      if (!more) {
        addMore = false;
      } else {
        const [axisName, entriesStr] = more.split(":");
        const entries = entriesStr?.split(",").map(e => e.trim()).filter(Boolean) ?? [];
        if (axisName && entries.length > 0) {
          axes.push({ id: axisName.trim(), name: axisName.trim(), entries });
        }
      }
    }

    // 첫 번째 prefix
    const prefixInput = (await ask(`첫 번째 prefix (이름:축1,축2,... 예: shipment:${axes.map(a => a.id).join(",")}): `)).trim();
    const prefixes: { id: string; name: string; dims: string[] }[] = [];
    if (prefixInput) {
      const [prefixName, dimsStr] = prefixInput.split(":");
      const dims = dimsStr?.split(",").map(d => d.trim()).filter(Boolean) ?? [];
      if (prefixName && dims.length > 0) {
        prefixes.push({ id: prefixName.trim(), name: prefixName.trim(), dims });
      }
    }

    rl.close();

    // 파일 생성
    const cwd = process.cwd();
    const catalogFileName = `${id}.catalog.ts`;
    const dkgConfigFileName = `${id}.dkg-config.ts`;

    const input: CatalogTemplateInput = { id, name, axes, prefixes };

    const files = [
      { path: catalogFileName, content: generateCatalogTs(input) },
      { path: dkgConfigFileName, content: generateDkgConfigTs(input) },
      { path: "qa-sdk.config.ts", content: generateConfigTs(catalogFileName) },
    ];

    console.log("\n생성할 파일:");
    for (const file of files) {
      const fullPath = resolve(cwd, file.path);
      if (existsSync(fullPath)) {
        console.log(`⏭ ${file.path} — 이미 존재합니다`);
        continue;
      }
      writeFileSync(fullPath, file.content, "utf-8");
      console.log(`✓ ${file.path}`);
    }

    console.log("\n완료.");
    console.log(`  카탈로그: ${catalogFileName}`);
    console.log(`  DKG 설정: ${dkgConfigFileName}`);
    console.log(`  프로젝트 설정: qa-sdk.config.ts`);
    console.log(`\n다음 단계: qa-sdk dkg report 로 확인`);
  } catch (err) {
    rl.close();
    throw err;
  }
}
