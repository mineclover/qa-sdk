import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { README_TEMPLATE, SCHEMA_JSON, SEMANTIC_RULES_YAML, MODEL_YAML_TEMPLATE } from "../templates/resources.js";
import { TEMPLATE_REGISTRY } from "../templates/registry.js";
import { getTodayString } from "../engine/naming.js";

export function initProject(targetDir: string, options: { force?: boolean }) {
  const archRoot = resolve(targetDir, "architecture");

  if (existsSync(archRoot) && !options.force) {
    console.error(chalk.red(`❌ 이미 'architecture/' 폴더가 존재합니다. 덮어쓰려면 --force 옵션을 사용하세요.`));
    process.exit(1);
  }

  console.log(chalk.blue(`🚀 Architecture Definition OS v0.1 구조 초기화 시작...`));

  // 1. 디렉토리 구조 생성
  const dirs = [
    "",
    "docs",
    "docs/architecture",
    "docs/rules",
    "docs/adr",
    "docs/business",
    "docs/metadata",
    "docs/governance",
    "docs/governance/roadmap",
    "docs/governance/prd",
    "docs/governance/progress",
    "docs/governance/handoff",
    "docs/governance/sessions",
    "model",
    "validation",
    "generated",
    "generated/mermaid",
    "generated/reports",
    "generated/exports",
  ];

  for (const dir of dirs) {
    const fullPath = join(archRoot, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  // 2. 정적 템플릿 리소스 파일 작성
  writeFileSync(join(archRoot, "README.md"), README_TEMPLATE, "utf-8");
  writeFileSync(join(archRoot, "validation", "schema.json"), SCHEMA_JSON, "utf-8");
  writeFileSync(join(archRoot, "validation", "semantic-rules.yaml"), SEMANTIC_RULES_YAML, "utf-8");
  writeFileSync(join(archRoot, "model", "archi-adr.yaml"), MODEL_YAML_TEMPLATE, "utf-8");

  // 3. 거버넌스 current.md 초기화 작성
  const today = getTodayString();

  // Roadmap current
  const roadmapMeta = { id: `GOV-ROADMAP-${today.replace(/-/g, "")}`, title: "Initial Architecture Roadmap", date: today };
  const roadmapContent = `${TEMPLATE_REGISTRY.roadmap.generateFrontmatter(roadmapMeta)}\n\n${TEMPLATE_REGISTRY.roadmap.generateBody(roadmapMeta)}`;
  writeFileSync(join(archRoot, "docs", "governance", "roadmap", "current.md"), roadmapContent, "utf-8");

  // PRD current
  const prdMeta = { id: `GOV-PRD-${today.replace(/-/g, "")}-SCOPE-DSL`, title: "Initial System PRD", date: today, scope: "SCOPE-DSL" };
  const prdContent = `${TEMPLATE_REGISTRY.prd.generateFrontmatter(prdMeta)}\n\n${TEMPLATE_REGISTRY.prd.generateBody(prdMeta)}`;
  writeFileSync(join(archRoot, "docs", "governance", "prd", "current.md"), prdContent, "utf-8");

  // Progress current
  const progressMeta = { id: `GOV-PROGRESS-${today.replace(/-/g, "")}`, title: "Initial Progress Status", date: today };
  const progressContent = `${TEMPLATE_REGISTRY.progress.generateFrontmatter(progressMeta)}\n\n${TEMPLATE_REGISTRY.progress.generateBody(progressMeta)}`;
  writeFileSync(join(archRoot, "docs", "governance", "progress", "current.md"), progressContent, "utf-8");

  // Handoff current
  const handoffMeta = { id: `GOV-HANDOFF-${today.replace(/-/g, "")}`, title: "Initial Session Handoff", date: today };
  const handoffContent = `${TEMPLATE_REGISTRY.handoff.generateFrontmatter(handoffMeta)}\n\n${TEMPLATE_REGISTRY.handoff.generateBody(handoffMeta)}`;
  writeFileSync(join(archRoot, "docs", "governance", "handoff", "current.md"), handoffContent, "utf-8");

  // Timeline current
  const timelineMeta = { id: `GOV-TIMELINE`, title: "Initial Session History Record", date: today };
  const timelineContent = `${TEMPLATE_REGISTRY.timeline.generateFrontmatter(timelineMeta)}\n\n${TEMPLATE_REGISTRY.timeline.generateBody(timelineMeta)}`;
  writeFileSync(join(archRoot, "docs", "governance", "timeline.md"), timelineContent, "utf-8");

  // History Index current
  const historyIndexMeta = { id: `GOV-HISTORY-INDEX`, title: "Initial History Index Document", date: today };
  const historyIndexContent = `${TEMPLATE_REGISTRY.historyIndex.generateFrontmatter(historyIndexMeta)}\n\n${TEMPLATE_REGISTRY.historyIndex.generateBody(historyIndexMeta)}`;
  writeFileSync(join(archRoot, "docs", "governance", "history-index.md"), historyIndexContent, "utf-8");

  console.log(chalk.green(`\n✔ 아키텍처 거버넌스 운영 체제 v0.1 초기화 완료!`));
  console.log(chalk.dim(`생성 위치: ${archRoot}`));
  console.log(chalk.dim(`\n이제 'archi new <type>' 명령어로 일관된 문서를 생성하거나 'archi validate'로 검증을 실행할 수 있습니다.\n`));
}
