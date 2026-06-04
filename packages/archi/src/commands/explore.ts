import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import chalk from "chalk";
import { parseModel, findFilesRecursively, parseFrontmatter } from "../engine/validator.js";

interface TreeNode {
  name: string;
  type: string;
  state?: string;
  children: TreeNode[];
}

export function exploreArchitecture(targetDir: string) {
  const archRoot = resolve(targetDir, "architecture");
  const modelPath = join(archRoot, "model", "archi-adr.yaml");
  const govRoot = join(archRoot, "docs", "governance");

  if (!existsSync(archRoot)) {
    console.error(chalk.red(`❌ 'architecture/' 폴더를 찾을 수 없습니다. 먼저 'archi init'를 실행해 주세요.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n🌳 아키텍처 지식 그래프 탐색 콘솔 (Explore Architecture OS)`));
  console.log(chalk.dim(`Root: ${archRoot}\n`));

  // ===========================================================================
  // 1. model/archi-adr.yaml 스펙 트리 구조 분석
  // ===========================================================================
  console.log(chalk.bold.underline(`[1] Core Architecture DSL Specification (SSOT)`));

  if (existsSync(modelPath)) {
    try {
      const modelYaml = readFileSync(modelPath, "utf-8");
      const model = parseModel(modelYaml);

      console.log(`📂 ${chalk.blue("archi-adr-v0.1")} (아키텍처 스펙)`);
      
      // Scopes 계층 출력
      if (model.scopes.length > 0) {
        console.log(`  ├── 📂 Scopes (${model.scopes.length}개)`);
        model.scopes.forEach((s, idx) => {
          const char = idx === model.scopes.length - 1 ? "└──" : "├──";
          console.log(`  │     ${char} 📄 ${chalk.green(s)}`);
        });
      }

      // Elements 계층 출력
      if (model.elements.length > 0) {
        console.log(`  ├── 📂 Elements (${model.elements.length}개)`);
        const maxToShow = 8;
        const elementsToShow = model.elements.slice(0, maxToShow);
        elementsToShow.forEach((e, idx) => {
          const isLast = idx === elementsToShow.length - 1 && model.elements.length <= maxToShow;
          const char = isLast ? "└──" : "├──";
          console.log(`  │     ${char} 🏷️  ${chalk.yellow(e)}`);
        });
        if (model.elements.length > maxToShow) {
          console.log(`  │     └── 💬 ... ${model.elements.length - maxToShow}개 요소 생략됨`);
        }
      }

      // Views 계층 출력
      if (model.views.length > 0) {
        const lastChar = "└──";
        console.log(`  ${lastChar} 📂 Views (${model.views.length}개)`);
        model.views.forEach((v, idx) => {
          const char = idx === model.views.length - 1 ? "└──" : "├──";
          console.log(`        ${char} 🖼️  ${chalk.cyan(v.id)} ${chalk.dim(`(${v.elements.length}E + ${v.relations.length}R)`)}`);
        });
      }
    } catch (err) {
      console.warn(chalk.yellow(`⚠ 아키텍처 모델 스펙을 분석하는 중 오류가 발생했습니다.`), err);
    }
  } else {
    console.log(chalk.yellow(`  ⚠ archi-adr.yaml 파일이 존재하지 않아 아키텍처 스펙 분석을 스킵합니다.`));
  }

  // ===========================================================================
  // 2. docs/governance/ 문서 간 'contains' 링크 추적 트리 렌더링
  // ===========================================================================
  console.log(chalk.bold.underline(`\n[2] Governance Document Contains Tree (E/C/I/S + L/P 계층구조)`));

  const govFiles = findFilesRecursively(govRoot, ".md");
  const docsMap = new Map<string, { id: string; file: string; level: string; state: string; children: string[] }>();
  const allChildIds = new Set<string>();

  // 문서 메타데이터 정보 수집
  for (const file of govFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const fm = parseFrontmatter(content);
      if (fm) {
        const id = fm.id || basename(file);
        const def = fm.def || fm;
        const level = def?.level || "leaf";
        const state = fm.lifecycle?.state || "unknown";
        
        // contains 링크 파싱
        const links = fm.links || def?.links || [];
        const children: string[] = [];
        if (Array.isArray(links)) {
          links.forEach((l: any) => {
            if (l.type === "contains" && l.target) {
              children.push(l.target);
              allChildIds.add(l.target);
            }
          });
        }

        docsMap.set(id, {
          id,
          file,
          level,
          state,
          children
        });
      }
    } catch {
      // ignore
    }
  }

  // 루트 노드(어떤 부모의 contains 자식으로도 참조되지 않는 문서들) 필터링
  const rootDocs = Array.from(docsMap.values()).filter((d) => !allChildIds.has(d.id));

  if (rootDocs.length === 0 && docsMap.size > 0) {
    // 순환 참조가 있거나 고아가 없을 경우, 편의상 최상위 doc들 나열
    console.log(chalk.yellow(`  ⚠ 순환 참조가 발견되거나 최상위 루트 문서를 규명할 수 없습니다. 전체 문서를 단순 나열합니다.`));
    docsMap.forEach((d) => {
      console.log(`  📄 ${chalk.bold(d.id)} [${d.level}] (${d.state})`);
    });
  } else {
    // 트리식 그리기 도우미 함수
    function drawTree(id: string, prefix = "") {
      const doc = docsMap.get(id);
      if (!doc) {
        console.log(`${prefix}└── 📄 ${chalk.red(id)} ${chalk.dim("(미생성 고아 노드)")}`);
        return;
      }

      const stateColor = doc.state === "active" ? chalk.green : doc.state === "draft" ? chalk.yellow : chalk.dim;
      const levelLabel = chalk.dim(`[${doc.level}]`);
      const filename = chalk.gray(`(${relative(govRoot, doc.file)})`);

      console.log(`${prefix}📄 ${chalk.bold(id)} ${levelLabel} ${stateColor(`(${doc.state})`)} ${filename}`);

      const childLength = doc.children.length;
      doc.children.forEach((childId, idx) => {
        const isLastChild = idx === childLength - 1;
        const newPrefix = prefix + (isLastChild ? "    " : "│   ");
        const connector = isLastChild ? "└── " : "├── ";
        drawTree(childId, prefix + connector);
      });
    }

    if (rootDocs.length === 0) {
      console.log(chalk.dim("  * 분석된 거버넌스 사양서 파일이 존재하지 않습니다."));
    } else {
      rootDocs.forEach((root) => {
        drawTree(root.id, "  ");
      });
    }
  }

  console.log("\n💡 " + chalk.dim("도움말: 'def.level: group | module'인 문서는 반드시 다른 자식 문서를 contains 링크로 포함해야 하며,\n" +
                        "        'leaf' 수준의 최종 종단 사양서는 150줄 이하의 복잡도를 준수하여 작성되어야 아키텍처 정합성이 유지됩니다."));
  console.log();
}
