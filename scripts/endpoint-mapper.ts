import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

export interface ImplementationSite {
  filePath: string;
  className: string;
  methodName: string;
  lineNumber: number;
}

export function findImplementations(root: string, endpoints: any[]): Map<string, ImplementationSite> {
  const mapping = new Map<string, ImplementationSite>();
  const files = findTsFiles(join(root, "simulations/enterprise-pm/services"));

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    let currentClass = "";
    let controllerBasePath = "";
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Controller base path extraction
      // Pattern: @Controller("base-path")
      const controllerMatch = line.match(/@Controller\((?:['"]([^'"]*)['"])?\)/i);
      if (controllerMatch) {
        controllerBasePath = controllerMatch[1] || "";
        if (controllerBasePath.startsWith("/")) controllerBasePath = controllerBasePath.substring(1);
      }

      // Class name extraction
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) currentClass = classMatch[1];

      // NestJS Decorator matching
      // Pattern: @Get("path") or @Post(":id")
      const decoratorMatch = line.match(/@(Get|Post|Put|Delete|Patch)\((?:['"]([^'"]*)['"])?\)/i);
      if (decoratorMatch) {
        const method = decoratorMatch[1].toUpperCase();
        let pathSuffix = decoratorMatch[2] || "";
        if (pathSuffix.startsWith("/")) pathSuffix = pathSuffix.substring(1);
        
        const fullImplPath = controllerBasePath 
          ? (pathSuffix ? `/${controllerBasePath}/${pathSuffix}` : `/${controllerBasePath}`)
          : (pathSuffix ? `/${pathSuffix}` : "/");

        // Find corresponding methodName (usually the next line)
        const nextLine = lines[i + 1] || "";
        const methodMatch = nextLine.match(/(?:async\s+)?(\w+)\s*\(/);
        const methodName = methodMatch ? methodMatch[1] : "unknown";

        for (const ep of endpoints) {
          // Normalizing both paths for comparison
          const normalizedEpPath = ep.path.startsWith("/") ? ep.path : `/${ep.path}`;
          const normalizedImplPath = fullImplPath.startsWith("/") ? fullImplPath : `/${fullImplPath}`;

          if (ep.method === method && (normalizedEpPath === normalizedImplPath || normalizedEpPath.endsWith(normalizedImplPath))) {
            mapping.set(`${method} ${ep.path}`, {
              filePath: file,
              className: currentClass,
              methodName,
              lineNumber: i + 1
            });
          }
        }
      }
    }
  }

  return mapping;
}

const EXCLUDED_SOURCE_DIRS = new Set(["node_modules", "dist", ".vite", "coverage"]);

function findTsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    file = join(dir, file);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) {
      return;
    }
    if (stat.isDirectory()) {
      if (EXCLUDED_SOURCE_DIRS.has(basename(file))) {
        return;
      }
      results = results.concat(findTsFiles(file));
    } else if (file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".d.ts")) {
      results.push(file);
    }
  });
  return results;
}
