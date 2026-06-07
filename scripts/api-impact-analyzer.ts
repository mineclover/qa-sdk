import { resolve, relative, basename } from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import chalk from "chalk";
import { resolveEndpointsFromDir } from "./oa-spec-resolver.js";
import { findImplementations, type ImplementationSite } from "./endpoint-mapper.js";

async function main() {
  const root = resolve(process.cwd());
  const specDirs = [
    "/Users/junwoobang/workflow/oa-sdk/packages/schemas/src/domains",
    join(root, "simulations/enterprise-pm/contracts/openapi/src/domains")
  ];
  
  console.log(chalk.bold(`\n🚀 API Impact Analysis Initializing...`));
  
  // 1. Resolve Endpoints
  const allEndpoints: any[] = [];
  for (const dir of specDirs) {
    console.log(`[1] Resolving endpoints from spec directory: ${chalk.dim(dir)}`);
    const endpoints = resolveEndpointsFromDir(dir);
    console.log(`    Found ${endpoints.length} endpoints in ${basename(dir)}.`);
    allEndpoints.push(...endpoints);
  }
  console.log(`    Total authoritative endpoints: ${allEndpoints.length}`);

  // 2. Map implementations
  console.log(`[2] Mapping endpoints to implementation sites in qa-sdk...`);
  const implementationMap = findImplementations(root, allEndpoints);
  console.log(`    Mapped ${implementationMap.size} implementations found in services.`);

  // Identify modified files via Git
  console.log(`[3] Identifying modified files via Git...`);
  let changedFiles: string[] = [];
  try {
    const output = execSync("git diff --name-only HEAD", { encoding: "utf-8" });
    changedFiles = output.split("\n").filter(f => f.trim().length > 0);
  } catch (err) {
    console.warn("⚠️ Git diff failed.");
  }

  if (changedFiles.length === 0) {
    console.log(chalk.green("✅ No files changed in git. Analysis skipped."));
    return;
  }
  
  console.log(`    Analyzing impact for ${changedFiles.length} files.`);

  // 4. Correlate impact
  console.log(`[4] Analyzing Impact Radius...\n`);

  const impactReport: any[] = [];

  for (const file of changedFiles) {
    const absPath = resolve(root, file);
    const fileName = basename(file);
    
    // A. Direct Controller Change
    for (const [api, site] of implementationMap.entries()) {
      if (site.filePath === absPath) {
        impactReport.push({
          file,
          api,
          reason: "Direct implementation change (Controller)",
          site
        });
      }
    }
    
    // B. Indirect Service/Repo Change
    if (file.endsWith(".service.ts") || file.endsWith(".repository.ts") || file.endsWith(".entity.ts")) {
      const className = fileName.replace(".ts", "").split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
      const simplifiedClassName = className.replace(/Service$/, "").replace(/Repository$/, "");
      
      for (const [api, site] of implementationMap.entries()) {
        const controllerContent = readFileSync(site.filePath, "utf-8");
        if (controllerContent.includes(simplifiedClassName)) {
          impactReport.push({
            file,
            api,
            reason: `Indirect impact via dependency: ${simplifiedClassName}`,
            site
          });
        }
      }
    }
  }

  if (impactReport.length === 0) {
    console.log(chalk.green("✅ No API impact detected from changes."));
  } else {
    const uniqueReportMap = new Map<string, any>();
    impactReport.forEach(r => uniqueReportMap.set(`${r.file}->${r.api}`, r));

    console.log(chalk.red(`⚠️ Found ${uniqueReportMap.size} potentially affected API paths:\n`));
    
    for (const report of uniqueReportMap.values()) {
      console.log(`${chalk.bold("API:")} ${chalk.red(report.api)}`);
      console.log(`├── ${chalk.bold("Reason:")} ${report.reason}`);
      console.log(`├── ${chalk.bold("Entry Point:")} ${report.site.className}.${report.site.methodName} (${relative(root, report.site.filePath)}:${report.site.lineNumber})`);
      console.log(`└── ${chalk.bold("Root Cause File:")} ${chalk.yellow(report.file)}`);
      
      // 5. Search for downstream consumers
      const apiPath = report.api.split(" ")[1];
      console.log(`    ${chalk.bold("Downstream Consumers (Scenarios/Tests):")}`);
      try {
        const grepOutput = execSync(`grep -r "${apiPath}" simulations/enterprise-pm/scenarios/src --exclude-dir=node_modules || true`, { encoding: "utf-8" });
        const consumers = grepOutput.split("\n").filter(l => l.trim().length > 0);
        
        if (consumers.length > 0) {
          const uniqueConsumerFiles = new Set<string>();
          consumers.forEach(c => uniqueConsumerFiles.add(c.split(":")[0]));
          
          uniqueConsumerFiles.forEach(cFile => {
            console.log(`    ➡️  ${chalk.cyan(relative(root, cFile))}`);
          });
        } else {
          console.log(chalk.dim("    (No direct scenario consumers found)"));
        }
      } catch {
        console.log(chalk.dim("    (Downstream scan failed)"));
      }
      console.log("");
    }
  }
}

import { join } from "node:path";
main().catch(err => {
  console.error(err);
  process.exit(1);
});
