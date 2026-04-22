// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// .env.docker 평문 파일 reader — Plan 04d Task 2
// QA_SDK_*_PASSWORD 등 PG 도메인 비밀번호를 로드한다.
// gitignored 평문 파일이며, sops rotate 대상은 아니다.

import { readFile } from "node:fs/promises";

/**
 * .env 포맷 파일을 파싱하여 key=value dict로 반환.
 *
 * 지원 포맷:
 *   - 빈 줄, `#` 시작 주석 무시
 *   - `KEY=VALUE` (양쪽 공백 trim)
 *   - VALUE에 `=`이 있으면 첫 번째 `=` 기준 split
 *   - VALUE 주변 따옴표("/')는 제거
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // 따옴표 제거 ("..." 또는 '...')
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) result[key] = value;
  }
  return result;
}

/**
 * .env.docker 파일을 읽어 dict로 반환.
 *
 * 파일 없으면 fail-fast — 비밀번호가 필요한 호출에서 skip 방지.
 */
export async function readEnvDockerSecrets(path: string): Promise<Record<string, string>> {
  const content = await readFile(path, "utf-8");
  return parseEnvFile(content);
}
