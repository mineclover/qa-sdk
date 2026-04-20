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

  let normalizedCount = 0;
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) continue;

    let yamlStr = match[1];
    const body = match[2];

    const tierMatch = yamlStr.match(/  tier:\s+(\w+)/);
    if (!tierMatch) continue;

    const tier = tierMatch[1];
    let newYamlStr = yamlStr;

    if (tier === "layout") {
      // layout: contains -> refs
      newYamlStr = yamlStr.replace(/type:\s+contains/g, 'type: refs');
    } else if (tier === "system") {
      // system: contains -> depends_on
      newYamlStr = yamlStr.replace(/type:\s+contains/g, 'type: depends_on');
    }

    if (yamlStr !== newYamlStr) {
      const newContent = `---\n${newYamlStr}\n---\n${body}`;
      await fs.writeFile(file, newContent, "utf8");
      normalizedCount++;
    }
  }

  console.log(`Normalized links in ${normalizedCount} files.`);
}

run().catch(console.error);
