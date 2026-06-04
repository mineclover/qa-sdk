import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// 헬퍼: 현재 날짜 문자열
export function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayCompactString(): string {
  return getTodayString().replace(/-/g, "");
}

// 재귀적으로 특정 패턴에 맞는 세션 파일 목록 수집
function findFilesRecursively(dir: string, filter: (filename: string) => boolean): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(d: string) {
    const list = readdirSync(d);
    for (const entry of list) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile() && filter(entry)) {
        results.push(entry);
      }
    }
  }
  walk(dir);
  return results;
}

// 오늘 날짜의 세션 파일 시퀀스 최댓값을 찾아 다음 시퀀스 번호 반환
export function calculateNextSessionSequence(docsRoot: string): string {
  const sessionsDir = join(docsRoot, "docs", "governance", "sessions");
  if (!existsSync(sessionsDir)) {
    return "001";
  }

  const today = getTodayString(); // YYYY-MM-DD
  const sessionPattern = new RegExp(`^session-${today}-(\\d{3})\\.md$`);

  // 세션 디렉토리 하위의 모든 파일 탐색
  const sessionFiles = findFilesRecursively(sessionsDir, (name) => sessionPattern.test(name));

  let maxSeq = 0;
  for (const file of sessionFiles) {
    const match = file.match(sessionPattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return String(nextSeq).padStart(3, "0");
}

export interface GeneratedMetadata {
  id: string;
  filename: string;
  relativeDir: string; // e.g. docs/governance/prd
  fullPath: string;
  title: string;
  date: string;
  scope?: string;
}

// 일관된 Naming 및 ID 매핑 엔진
export function generateMetadata(
  type: string,
  docsRoot: string,
  options: { title: string; scope?: string; seq?: string; date?: string }
): GeneratedMetadata {
  const date = options.date || getTodayString();
  const compactDate = date.replace(/-/g, "");
  const title = options.title;

  let id = "";
  let filename = "";
  let relativeDir = "";

  switch (type.toLowerCase()) {
    case "roadmap":
      id = `GOV-ROADMAP-${compactDate}`;
      filename = `roadmap-${date}.md`;
      relativeDir = join("docs", "governance", "roadmap");
      break;

    case "prd":
      const prdScope = (options.scope || "SCOPE-DSL").toUpperCase();
      id = `GOV-PRD-${compactDate}-${prdScope}`;
      // 파일명 패턴: {scope}-prd-YYYY-MM-DD.md (소문자 치환)
      const cleanScope = prdScope.replace(/^SCOPE-/, "").toLowerCase();
      filename = `${cleanScope}-prd-${date}.md`;
      relativeDir = join("docs", "governance", "prd");
      break;

    case "progress":
      id = `GOV-PROGRESS-${compactDate}`;
      filename = `progress-${date}.md`;
      relativeDir = join("docs", "governance", "progress");
      break;

    case "session":
      const seq = options.seq || calculateNextSessionSequence(docsRoot);
      id = `GOV-SESSION-${compactDate}-${seq}`;
      filename = `session-${date}-${seq}.md`;
      // 세션 폴더: YYYY/MM/ 세분화 구조 준수
      const [yyyy, mm] = date.split("-");
      relativeDir = join("docs", "governance", "sessions", yyyy, mm);
      break;

    case "handoff":
      id = `GOV-HANDOFF-${compactDate}`;
      filename = `handoff-${date}.md`;
      relativeDir = join("docs", "governance", "handoff");
      break;

    case "timeline":
      id = "GOV-TIMELINE";
      filename = "timeline.md";
      relativeDir = join("docs", "governance");
      break;

    case "historyindex":
    case "history-index":
      id = "GOV-HISTORY-INDEX";
      filename = "history-index.md";
      relativeDir = join("docs", "governance");
      break;

    default:
      throw new Error(`지원하지 않는 문서 타입입니다: ${type}`);
  }

  return {
    id,
    filename,
    relativeDir,
    fullPath: join(docsRoot, relativeDir, filename),
    title,
    date,
    scope: options.scope,
  };
}
