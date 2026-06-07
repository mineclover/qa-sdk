import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import yaml from "js-yaml";

export interface Endpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  tags?: string[];
  sourceFile: string;
}

export function resolveEndpointsFromDir(baseDir: string): Endpoint[] {
  if (!existsSync(baseDir)) {
    console.error(`❌ Base directory not found: ${baseDir}`);
    return [];
  }

  const endpoints: Endpoint[] = [];
  const files = findYamlFiles(baseDir);

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      const spec = yaml.load(content) as any;
      if (!spec || !spec.paths) continue;

      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, detail] of Object.entries(methods as any)) {
          if (["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) {
            endpoints.push({
              method: method.toUpperCase(),
              path,
              operationId: detail.operationId,
              summary: detail.summary,
              tags: detail.tags,
              sourceFile: file,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ Failed to parse ${file}: ${(err as Error).message}`);
    }
  }

  return endpoints;
}

function findYamlFiles(dir: string): string[] {
  let results: string[] = [];
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

export function resolveEndpointsFromSpec(specPath: string): Endpoint[] {
  // Original function kept for backward compatibility if needed, but redirects to dir logic if it's a dir
  if (existsSync(specPath) && statSync(specPath).isDirectory()) {
    return resolveEndpointsFromDir(specPath);
  }
  
  if (!existsSync(specPath)) return [];
  const content = readFileSync(specPath, "utf-8");
  const spec = yaml.load(content) as any;
  const endpoints: Endpoint[] = [];
  if (!spec || !spec.paths) return [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, detail] of Object.entries(methods as any)) {
      if (["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) {
        endpoints.push({
          method: method.toUpperCase(),
          path,
          operationId: detail.operationId,
          summary: detail.summary,
          tags: detail.tags,
          sourceFile: specPath
        });
      }
    }
  }
  return endpoints;
}

// For manual testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const specPath = "/Users/junwoobang/workflow/oa-sdk/packages/schemas/src/openapi.yaml";
  const endpoints = resolveEndpointsFromSpec(specPath);
  console.log(`Found ${endpoints.length} endpoints in ${specPath}`);
  endpoints.slice(0, 5).forEach(e => console.log(`- ${e.method} ${e.path} (${e.operationId})`));
}
