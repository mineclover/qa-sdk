import { isAbsolute, resolve } from 'node:path';

/**
 * decisionLink 형식 분기 + 절대 경로 해소.
 *
 * 지원 형식:
 * 1. `decision:<id>` — 안정 식별자 (path 위치 변경에 강건). `<decisionsDir>/<id>.md`로 해소.
 * 2. relative/absolute path — 기존 호환 형식. yaml 파일 디렉토리 기준 상대 해소.
 * 3. `http(s)://` — external URL. fetch 불가, `kind: "external"` 반환.
 * 4. `decision-flow://` — 미지원. `kind: "unsupported"` 반환.
 * 5. `tax:` ref — registry 기반 해소 필요. `kind: "unsupported"` 반환.
 *
 * 입력:
 * - link: decisionLink 문자열
 * - yamlAbsDir: yaml 파일의 절대 디렉토리 경로 (path 형식 해소 기준)
 * - decisionsDir: decision 파일 루트 절대 경로 (default: `<repoRoot>/docs/decisions`).
 *   `decision:<id>` 형식 해소에만 사용.
 *
 * 출력: 형식 + 해소된 절대 경로(있는 경우) + 사유.
 */
export type ResolvedDecisionLink =
  | { kind: 'path'; absPath: string }
  | { kind: 'stable-id'; id: string; absPath: string }
  | { kind: 'external'; reason: string }
  | { kind: 'unsupported'; reason: string };

export function resolveDecisionLink(opts: {
  link: string;
  yamlAbsDir: string;
  decisionsDir: string;
}): ResolvedDecisionLink {
  const { link, yamlAbsDir, decisionsDir } = opts;

  if (link.startsWith('http://') || link.startsWith('https://')) {
    return { kind: 'external', reason: '외부 URL — fetch 안 함' };
  }
  if (link.startsWith('decision-flow://')) {
    return { kind: 'unsupported', reason: 'decision-flow:// — Stage 3 미지원' };
  }
  if (link.startsWith('tax:')) {
    return { kind: 'unsupported', reason: 'tax: ref — registry 통한 해소 필요' };
  }
  if (link.startsWith('decision:')) {
    const id = link.slice('decision:'.length);
    if (id.length === 0) {
      return { kind: 'unsupported', reason: 'decision: 식별자 비어있음' };
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      return {
        kind: 'unsupported',
        reason: `decision: 식별자 형식 오류 (영숫자/._- 만 허용): ${id}`,
      };
    }
    const absPath = resolve(decisionsDir, `${id}.md`);
    return { kind: 'stable-id', id, absPath };
  }

  const absPath = isAbsolute(link) ? link : resolve(yamlAbsDir, link);
  return { kind: 'path', absPath };
}
