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

  let catalogJson: string;
  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    catalogJson = JSON.stringify(DEMO_CATALOG, null, 2);
  } catch {
    console.error("demo-snapshot 패키지를 로드할 수 없습니다. pnpm add demo-snapshot 을 실행하세요.");
    process.exit(1);
  }

  // JSON 카탈로그 (jiti/tsx 불필요) + TS 래퍼 (타입 안전)
  const files = [
    { path: "my-project.catalog.json", content: catalogJson },
    { path: "my-project.catalog.ts", content: `/**
 * 데모 카탈로그 TS 래퍼.
 * JSON을 수정하거나, 이 파일에서 프로그래밍 방식으로 확장하세요.
 * codegen은 JSON을 직접 사용: qa-sdk codegen --catalog my-project.catalog.json
 */
import catalog from "./my-project.catalog.json" with { type: "json" };
export default catalog;
` },
    { path: "qa-sdk.config.ts", content: generateConfigTs("my-project.catalog.json") },
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

  printNextSteps("my-project.catalog.json");
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

    printNextSteps(catalogFileName);
  } catch (err) {
    rl.close();
    throw err;
  }
}

// ── 다음 단계 안내 ──────────────────────────────────────

function printNextSteps(catalogFile: string) {
  console.log(`
✅ 프로젝트 초기화 완료

═══ 다음 단계 ═══

  1. 타입 생성 (codegen)
     $ qa-sdk codegen --output ./generated

  2. SDK 사용 (Node.js)
     import { sdk, GENERATION } from "./generated";
     const addr = sdk.encode("permission", { role: "admin" });
     const dims = sdk.decode("permission", addr);

  3. 브라우저 SDK (qa-browser-sdk.js)
     import { createQaMonitor } from './qa-browser-sdk.js';
     const monitor = createQaMonitor({
       ingestUrl: "http://localhost:3200",
       serviceConfig: { namespace: "shop", name: "my-web", env: "dev", region: "asia" },
     });
     monitor.emitWithCoords('page.home', {
       page_view: { page: 'home', locale: 'ko', userType: 'member' },
     });

  4. 레지스트리 연동 (선택)
     import { createRegistryConfigClient } from "@qa-sdk/registry-client";
     const registry = createRegistryConfigClient({
       registryUrl: "http://localhost:3300",
       env: "dev",
     });
     const urls = await registry.fetchServiceUrls();

  5. DKG 탐색
     $ qa-sdk dkg report
     $ qa-sdk dkg axes
     $ qa-sdk dkg prefixes

═══════════════════

  카탈로그: ${catalogFile}
  설정:     qa-sdk.config.ts
  문서:     https://github.com/anthropics/qa-sdk
`);
}
