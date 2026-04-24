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

  let convertedCount = 0;
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) continue;

    let yamlStr = match[1];
    const body = match[2];

    // Knowledge 문서이거나 Plan/Todo 문서인 경우
    const isKnowledge = yamlStr.includes("type: knowledge");
    const isPlanTodo = file.endsWith(".plan.md") || file.endsWith(".todo.md");

    if (isKnowledge || isPlanTodo) {
      const newYamlStr = yamlStr.replace(/type:\s+refines/g, 'type: traces_to')
                                .replace(/type:\s+depends_on/g, 'type: traces_to');
      
      if (yamlStr !== newYamlStr) {
        const newContent = `---\n${newYamlStr}\n---\n${body}`;
        await fs.writeFile(file, newContent, "utf8");
        convertedCount++;
      }
    }
  }

  console.log(`Broke potential cycles in ${convertedCount} knowledge/plan docs.`);
}

run().catch(console.error);
