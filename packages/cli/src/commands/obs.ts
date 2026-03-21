/**
 * obs — Obsidian spec-prefix 볼트 조회/수정 CLI.
 *
 * sync-obsidian이 전체 동기화라면, obs는 개별 노트 조회/수정 도구.
 */

import { execaSync, type ExecaSyncError } from "execa";

const DEFAULT_VAULT = "spec-prefix";

function isExecaError(err: unknown): err is ExecaSyncError {
  return err instanceof Error && "stderr" in err;
}

function obs(args: string[]): string {
  try {
    const { stdout } = execaSync("obsidian", args, { timeout: 10_000 });
    return stdout.trim();
  } catch (err: unknown) {
    if (isExecaError(err)) {
      console.error(err.stderr?.trim() || err.shortMessage);
    } else {
      console.error(err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  }
}

export function obsRead(path: string, vault?: string): void {
  const v = vault ?? DEFAULT_VAULT;
  console.log(obs(["read", `vault=${v}`, `path=${path}`]));
}

export function obsSearch(query: string, vault?: string, limit = 10): void {
  const v = vault ?? DEFAULT_VAULT;
  const result = obs(["search", `vault=${v}`, `query=${query}`, `limit=${limit}`]);
  console.log(result || "  결과 없음");
}

export function obsAppend(path: string, content: string, vault?: string): void {
  const v = vault ?? DEFAULT_VAULT;
  obs(["append", `vault=${v}`, `path=${path}`, `content=${content}`, "silent"]);
  console.log(`  ✓ ${path} 에 추가됨`);
}

export function obsBacklinks(name: string, vault?: string): void {
  const v = vault ?? DEFAULT_VAULT;
  const result = obs(["backlinks", `vault=${v}`, `file=${name}`]);
  console.log(result || "  백링크 없음");
}

export function obsList(folder: string, vault?: string): void {
  const v = vault ?? DEFAULT_VAULT;
  const code = `app.vault.getFiles().filter(f => f.path.startsWith('${folder}')).map(f => f.path).sort().join('\\n')`;
  const result = obs(["eval", `vault=${v}`, `code=${code}`]);
  const cleaned = result.replace(/^=>\s*/, "");
  console.log(cleaned || "  파일 없음");
}

export function obsStats(vault?: string): void {
  const v = vault ?? DEFAULT_VAULT;
  const total = obs(["eval", `vault=${v}`, "code=app.vault.getFiles().length"]).replace(/^=>\s*/, "");

  const code = [
    "var files = app.vault.getFiles();",
    "var byFolder = {};",
    "for (var i = 0; i < files.length; i++) {",
    "var p = files[i].path;",
    "var folder = p.indexOf('/') >= 0 ? p.split('/')[0] : '_root';",
    "if (!byFolder[folder]) byFolder[folder] = 0;",
    "byFolder[folder]++;",
    "}",
    "var keys = Object.keys(byFolder);",
    "keys.sort(function(a, b) { return byFolder[b] - byFolder[a]; });",
    "keys.map(function(k) { return k + ': ' + byFolder[k]; }).join('\\n');",
  ].join(" ");

  const result = obs(["eval", `vault=${v}`, `code=${code}`]);
  const cleaned = result.replace(/^=>\s*/, "");
  console.log(`\n══ ${v} 볼트 현황 ══`);
  console.log(`  총 ${total}개 노트\n`);
  console.log(cleaned.split("\n").map(l => `  ${l}`).join("\n"));
}
