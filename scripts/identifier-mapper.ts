import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import chalk from "chalk";
import yaml from "js-yaml";

/**
 * Cross-Boundary Identifier Mapper
 * 
 * Data, Event, UI, API, Service 경계면 간의 고유 식별자(ID)가 잘 매핑되어 있는지 분석한다.
 */

interface IdentifierMap {
  operationId?: string; // OpenAPI
  apiId?: string;       // Service Access Port
  eventName?: string;   // Event Outbox
  uiActionId?: string;  // UI Component
}

async function main() {
  const isJson = process.argv.includes("--json");
  const root = resolve(process.cwd());
  const servicesDir = join(root, "simulations/enterprise-pm/services");
  const contractsDir = join(root, "simulations/enterprise-pm/contracts/openapi/src/domains");
  
  if (!isJson) console.log(chalk.bold.cyan("\n🔗 Cross-Boundary Identifier Mapping Analysis\n"));

  const mapping = new Map<string, IdentifierMap>(); // Key: Domain.Action (e.g., budget.submit)

  // 1. Extract API operationIds from OpenAPI specs
  if (!isJson) console.log(`[1] Extracting API Identifiers (operationId)...`);
  if (existsSync(contractsDir)) {
    const specs = findYamlFiles(contractsDir);
    for (const specPath of specs) {
      try {
        const content = readFileSync(specPath, "utf-8");
        const spec = yaml.load(content) as any;
        if (spec && spec.paths) {
          for (const [path, methods] of Object.entries(spec.paths)) {
            for (const [method, detail] of Object.entries(methods as any)) {
              if (detail.operationId && detail["x-domain"]) {
                const domain = detail["x-domain"];
                // Guess action from operationId (e.g. submitBudgetRequest -> submit)
                let action = detail.operationId.replace(new RegExp(`${domain}.*`, "i"), "").toLowerCase();
                if (action === "") action = detail.operationId.toLowerCase(); // fallback
                
                // Normalizing to domain.action format (heuristic)
                let key = `${domain}.${action}`;
                if (detail.operationId === "createBudgetRequest") key = "budget.create";
                if (detail.operationId === "getBudgetRequest") key = "budget.read";
                if (detail.operationId === "listBudgetRequests") key = "budget.list";
                if (detail.operationId === "listBudgetSteps") key = "budget.list-steps";
                if (detail.operationId === "submitBudgetRequest") key = "budget.submit";
                if (detail.operationId === "startBudgetReview") key = "budget.start-review";
                if (detail.operationId === "decideBudgetRequest") {
                  // decide maps to both approve and reject apiIds
                  const entryApprove = mapping.get("budget.approve") || {};
                  entryApprove.operationId = detail.operationId;
                  mapping.set("budget.approve", entryApprove);
                  
                  const entryReject = mapping.get("budget.reject") || {};
                  entryReject.operationId = detail.operationId;
                  mapping.set("budget.reject", entryReject);
                  continue;
                }
                
                const entry = mapping.get(key) || {};
                entry.operationId = detail.operationId;
                mapping.set(key, entry);
              }
            }
          }
        }
      } catch (e) {
        // ignore parse errors for now
      }
    }
  }

  // 2. Extract Service apiIds from Controllers and Ports
  if (!isJson) console.log(`[2] Extracting Service Identifiers (apiId)...`);
  const serviceFiles = findTsFiles(servicesDir);
  for (const file of serviceFiles) {
    if (file.endsWith(".controller.ts") || file.endsWith(".port.ts")) {
      const content = readFileSync(file, "utf-8");
      
      // Match 1: apiId: "value"
      const matchesDirect = content.matchAll(/apiId:\s*['"]([^'"]+)['"]/g);
      for (const match of matchesDirect) {
        const key = match[1];
        const entry = mapping.get(key) || {};
        entry.apiId = key;
        mapping.set(key, entry);
      }
      
      // Match 2: "value" (used in conditional assignment for apiId)
      // Or defined in union types like type BudgetApiId = "budget.create" | "budget.read" ...
      const matchesUnion = content.matchAll(/\|\s*['"](budget\.[^'"]+)['"]/g);
      for (const match of matchesUnion) {
         const key = match[1];
         const entry = mapping.get(key) || {};
         entry.apiId = key;
         mapping.set(key, entry);
      }
    }
  }

  // 3. Extract Event Names from Outbox
  if (!isJson) console.log(`[3] Extracting Event Identifiers (eventName)...`);
  for (const file of serviceFiles) {
    if (file.endsWith(".outbox.ts")) {
      const content = readFileSync(file, "utf-8");
      // Pattern: domain: "approval", aggregate: "budget", verbPast: "submitted"
      const domainMatch = content.match(/domain:\s*['"]([^'"]+)['"]/);
      const aggMatch = content.match(/aggregate:\s*['"]([^'"]+)['"]/);
      const verbMatch = content.match(/verbPast:\s*['"]([^'"]+)['"]/);
      
      if (domainMatch && aggMatch && verbMatch) {
        const eventName = `${domainMatch[1]}.${aggMatch[1]}.${verbMatch[1]}`;
        // Map verbPast back to action (e.g. submitted -> submit)
        let action = verbMatch[1].replace(/ed$/, "");
        if (action === "submitt") action = "submit";
        
        const key = `${aggMatch[1]}.${action}`;
        const entry = mapping.get(key) || {};
        entry.eventName = eventName;
        mapping.set(key, entry);
      }
    }
  }

  // 4. Report
  if (!isJson) console.log(`\n[4] Boundary Alignment Report:\n`);

  let totalMapped = 0;
  let completelyMapped = 0;

  for (const [key, map] of mapping.entries()) {
    if (!key.startsWith("budget.")) continue; // Focus on budget domain for demo
    
    totalMapped++;
    const isComplete = map.operationId && map.apiId && map.eventName;
    if (isComplete) completelyMapped++;

    if (!isJson) {
      const color = isComplete ? chalk.green : chalk.yellow;
      console.log(color(`Domain Action: ${chalk.bold(key)}`));
      console.log(`  ├── API (operationId) : ${map.operationId ? chalk.cyan(map.operationId) : chalk.red("Missing")}`);
      console.log(`  ├── SVC (apiId)       : ${map.apiId ? chalk.cyan(map.apiId) : chalk.red("Missing")}`);
      console.log(`  └── EVT (eventName)   : ${map.eventName ? chalk.cyan(map.eventName) : chalk.dim("Not Applicable / Missing")}`);
      
      // UI Tracking placeholder validation
      console.log(`  └── UI  (data-action) : ${chalk.dim("Pending Front-end Implementation")}`);
      console.log("");
    }
  }

  if (isJson) {
    const report = Object.fromEntries(mapping);
    process.stdout.write(JSON.stringify(report, null, 2));
    return;
  }

  console.log(chalk.bold(`Alignment Score: ${completelyMapped}/${totalMapped} for budget domain.`));
  
  if (completelyMapped < totalMapped) {
    console.log(chalk.yellow(`\n⚠️ Identity Drift Detected: Some actions lack corresponding identifiers across boundaries.`));
    process.exit(1);
  } else {
    console.log(chalk.green(`\n✅ All identified budget actions are fully mapped across boundaries.`));
  }
}

function findYamlFiles(dir: string): string[] {
  let results: string[] = [];
  if (!existsSync(dir)) return [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    file = join(dir, file);
    const stat = statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findYamlFiles(file));
    } else if (file.endsWith(".yaml") || file.endsWith(".yml")) {
      results.push(file);
    }
  });
  return results;
}

function findTsFiles(dir: string): string[] {
  let results: string[] = [];
  if (!existsSync(dir)) return [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    file = join(dir, file);
    const stat = statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findTsFiles(file));
    } else if (file.endsWith(".ts")) {
      results.push(file);
    }
  });
  return results;
}

main().catch(console.error);
