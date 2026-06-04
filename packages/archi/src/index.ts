import { Command } from "commander";
import { initProject } from "./commands/init.js";
import { createDocument } from "./commands/new.js";
import { runValidation } from "./commands/validate.js";
import { buildTimeline } from "./commands/timeline.js";
import { showStatus } from "./commands/status.js";
import { renderMermaidViews } from "./commands/render.js";
import { exploreArchitecture } from "./commands/explore.js";

const program = new Command();

program
  .name("archi")
  .description("Architecture Definition Operating System CLI")
  .version("0.1.0");

// 1. init
program
  .command("init")
  .description("지정한 디렉토리에 architecture/ 구조와 표준 템플릿 초기화")
  .option("-f, --force", "이미 폴더가 존재할 때 강제로 덮어쓰고 재생성")
  .option("-d, --dir <path>", "작업할 루트 폴더 지정 (기본값: 현재 디렉토리)")
  .action((options) => {
    initProject(options.dir || process.cwd(), options);
  });

// 2. new
program
  .command("new <doc-type>")
  .description("명명 규칙을 준수하여 템플릿 기반의 신규 아키텍처 문서 생성")
  .option("-i, --interactive", "대화식 터미널 프롬프트를 사용하여 메타데이터 입력")
  .option("-t, --title <title>", "문서 제목")
  .option("-s, --scope <scope>", "연관 Scope Unit (PRD 타입 전용)")
  .option("-g, --tags <tags>", "콤마 구분 분류 태그")
  .option("-r, --refs <refs>", "콤마 구분 참조 문서 ID 목록")
  .option("-d, --dir <path>", "작업할 루트 폴더 지정 (기본값: 현재 디렉토리)")
  .action(async (type, options) => {
    await createDocument(type, options.dir || process.cwd(), options);
  });

// 3. validate
program
  .command("validate")
  .description("아키텍처 문서 사양 및 모델 정합성 검증")
  .option("-v, --verbose", "통과한 상세 검증 항목을 모두 출력")
  .option("-r, --rule <rule-id>", "특정 규칙 ID만 지정 검사")
  .option("-c, --category <category>", "특정 카테고리만 지정 검사")
  .option("-j, --json", "검증 상세 결과를 JSON 포맷으로 표준 출력")
  .option("-d, --dir <path>", "작업할 루트 폴더 지정 (기본값: 현재 디렉토리)")
  .action((options) => {
    runValidation(options.dir || process.cwd(), options);
  });

// 4. timeline
program
  .command("timeline")
  .description("모든 세션 문서를 수집하여 timeline.md 자동 재생성 및 인덱싱")
  .option("-d, --dir <path>", "작업할 루트 폴더 지정 (기본값: 현재 디렉토리)")
  .action((options) => {
    buildTimeline(options.dir || process.cwd());
  });

// 5. status
program
  .command("status")
  .alias("stats")
  .description("아키텍처 스펙 분포, 수명 주기 현황 및 검증 통계 리포트 요약")
  .option("-d, --dir <path>", "작업할 루트 폴더 지정 (기본값: 현재 디렉토리)")
  .action((options) => {
    showStatus(options.dir || process.cwd());
  });

// 6. render
program
  .command("render")
  .description("model/archi-adr.yaml 내의 모든 아키텍처 뷰를 Mermaid 파일(.mmd)로 개별 추출")
  .option("-d, --dir <path>", "작업할 루트 폴더 지정 (기본값: 현재 디렉토리)")
  .action((options) => {
    renderMermaidViews(options.dir || process.cwd());
  });

// 7. explore
program
  .command("explore")
  .description("아키텍처 스펙 구조 및 사양서 Contains 계층 그래프를 트리 뷰로 탐색")
  .option("-d, --dir <path>", "작업할 루트 폴더 지정 (기본값: 현재 디렉토리)")
  .action((options) => {
    exploreArchitecture(options.dir || process.cwd());
  });

program.parse(process.argv);
