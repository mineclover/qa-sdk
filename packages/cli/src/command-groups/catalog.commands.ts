// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import { getCatalogRegistry } from "../commands/dkg.js";

export const CATALOG_COMMAND_DESCRIPTORS = [
  { id: "catalog.list", path: ["list"], usage: "qa-sdk catalog list                등록된 카탈로그 목록", handlerKey: "catalog.list" },
  { id: "catalog.info", path: ["info"], usage: "qa-sdk catalog info <id>           카탈로그 상세 정보", handlerKey: "catalog.info" },
] as const satisfies readonly CommandDescriptor[];

export const CATALOG_COMMAND_TREE =
  descriptorsToTree(CATALOG_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const CATALOG_COMMAND_SPECS =
  collectCommandUsageSpecs(["catalog"], CATALOG_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const CATALOG_HANDLER_REGISTRY = {
  "catalog.list": () => {
    const reg = getCatalogRegistry();
    const catalogs = reg.listCatalogs();
    if (catalogs.length === 0) {
      console.log("  등록된 카탈로그 없음");
    } else {
      console.log(`\n══ Catalogs (${catalogs.length}) ══\n`);
      for (const c of catalogs) {
        console.log(`  ${c.id.padEnd(15)} ${c.name.padEnd(20)} prefixes=${c.prefixCount}`);
      }
    }
  },
  "catalog.info": (rest: string[]) => {
    const infoId = rest[0];
    if (!infoId) {
      console.error("Usage: qa-sdk catalog info <id>");
      return;
    }
    const reg = getCatalogRegistry();
    if (!reg.has(infoId)) {
      console.error(
        `카탈로그 '${infoId}' 없음. 사용 가능: ${reg
          .listCatalogs()
          .map((c) => c.id)
          .join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }
    const cat = reg.getCatalog(infoId);
    console.log(`\n══ Catalog: ${cat.id} ══`);
    console.log(`  name:     ${cat.name}`);
    console.log(`  axes:     ${Object.keys(cat.axes).length}`);
    console.log(`  prefixes: ${Object.keys(cat.prefixes).length}`);
    console.log(`  tables:   ${cat.tables ? Object.keys(cat.tables).length : 0}`);
    console.log(`\n  Axes:`);
    for (const [id, a] of Object.entries(cat.axes)) {
      const versions = Object.keys(a.versions);
      console.log(`    ${id.padEnd(15)} versions=${versions.length}`);
    }
    console.log(`\n  Prefixes:`);
    for (const [id, p] of Object.entries(cat.prefixes)) {
      console.log(`    ${id.padEnd(15)} ${p.name.padEnd(15)} dims=${p.labels.length}`);
    }
  },
} satisfies Readonly<Record<string, RestCommandHandler>>;
