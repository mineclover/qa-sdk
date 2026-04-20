import { promises as fs } from "node:fs";
import { join } from "node:path";

async function walk(dir, fileList = []) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const p = join(dir, file.name);
    if (file.isDirectory()) {
      if (file.name === ".git" || file.name === "node_modules" || file.name === "archive") continue;
      await walk(p, fileList);
    } else if (file.name.endsWith(".md") && !file.name.includes("README.md")) {
      fileList.push(p);
    }
  }
  return fileList;
}

async function run() {
  const rootDir = process.cwd();
  const docsDir = join(rootDir, "docs/specs");
  const files = await walk(docsDir);

  // 1단계: 모든 문서의 티어 맵 구축
  const tierMap = new Map();
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) continue;
    const yaml = match[1];
    const idMatch = yaml.match(/  id:\s+([\w-]+)/);
    const tierMatch = yaml.match(/  tier:\s+([\w-]+)/);
    if (idMatch && tierMatch) {
      tierMap.set(idMatch[1], tierMatch[1]);
    }
  }

  let normalizedCount = 0;
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) continue;

    let yamlStr = match[1];
    const body = match[2];

    const sourceIdMatch = yamlStr.match(/  id:\s+([\w-]+)/);
    const sourceTierMatch = yamlStr.match(/  tier:\s+([\w-]+)/);
    if (!sourceIdMatch || !sourceTierMatch) continue;

    const sourceTier = sourceTierMatch[1];

    const lines = yamlStr.split("\n");
    const newLines = [];
    let currentTarget = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const targetMatch = line.match(/^\s+-\s+target:\s+([\w-]+)/);
      if (targetMatch) {
        currentTarget = targetMatch[1];
      }

      const typeMatch = line.match(/^(\s+type:\s+)([\w-]+)/);
      if (typeMatch && currentTarget) {
        const prefix = typeMatch[1];
        const oldType = typeMatch[2];
        const targetTier = tierMap.get(currentTarget);

        let newType = oldType;
        if (sourceTier === "layout") {
           if (oldType === "contains") newType = "refs";
        } else if (sourceTier === "system") {
           // System: System을 contains하면 안 됨 -> depends_on
           // 단, target이 system일 때만 전환. Component나 Leaf면 contains 유지.
           if (oldType === "depends_on" && targetTier !== "system") {
             // 이전 스크립트에서 잘못 바꾼 것 복구
             newType = "contains";
           }
           if (oldType === "contains" && targetTier === "system") {
             newType = "depends_on";
           }
        }

        newLines.push(`${prefix}${newType}`);
      } else {
        newLines.push(line);
      }
    }

    const newYamlStr = newLines.join("\n");

    if (yamlStr !== newYamlStr) {
      const newContent = `---\n${newYamlStr}\n---\n${body}`;
      await fs.writeFile(file, newContent, "utf8");
      normalizedCount++;
    }
  }

  console.log(`Re-normalized links in ${normalizedCount} files.`);
}

run().catch(console.error);
