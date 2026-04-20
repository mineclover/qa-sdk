import { promises as fs } from "node:fs";
import { join, relative } from "node:path";

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

  let migratedCount = 0;
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) continue;

    let yamlStr = match[1];
    const body = match[2];

    // Already has tier?
    if (yamlStr.includes("  tier:")) continue;

    const lines = yamlStr.split("\n");
    const metadata = {};
    let defIndex = -1;
    let defLines = [];

    let inDef = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "def:") {
        inDef = true;
        defIndex = i;
        continue;
      }
      if (inDef) {
        if (line.startsWith("  ") && line.trim().length > 0) {
          defLines.push(line);
        } else if (line.trim().length > 0) {
          inDef = false;
        }
      }
    }

    if (defIndex === -1) continue;

    const levelLine = defLines.find(l => l.startsWith("  level:"));
    const level = levelLine ? levelLine.split(":")[1].trim() : "leaf";
    const idLine = defLines.find(l => l.startsWith("  id:"));
    const id = idLine ? idLine.split(":")[1].trim() : "";

    let tier = "component";
    if (level === "group") tier = "layout";
    else if (level === "module") tier = "system";
    else if (id.endsWith("-system") || id.endsWith("-service")) tier = "system";
    else if (file.includes("/concepts/")) tier = "exempt"; // Concepts as knowledge? No, D-19 handled this.
    
    // Additional heuristics
    if (body.includes("interface ") || body.includes("type ") || body.includes("enum ")) {
       if (tier !== "system") tier = "component";
    }

    // Inject tier after level
    const newDefLines = [];
    let tierAdded = false;
    for (const line of defLines) {
      newDefLines.push(line);
      if (line.startsWith("  level:")) {
        newDefLines.push(`  tier: ${tier}`);
        tierAdded = true;
      }
    }
    if (!tierAdded) {
      newDefLines.unshift(`  tier: ${tier}`);
    }

    // Reconstruction
    const newYamlLines = [...lines];
    newYamlLines.splice(defIndex + 1, defLines.length, ...newDefLines);
    
    const newContent = `---\n${newYamlLines.join("\n")}\n---\n${body}`;
    if (content !== newContent) {
      await fs.writeFile(file, newContent, "utf8");
      migratedCount++;
    }
  }

  console.log(`Migrated ${migratedCount} files to STC tiers.`);
}

run().catch(console.error);
