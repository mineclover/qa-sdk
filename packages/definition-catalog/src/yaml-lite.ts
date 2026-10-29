// @def.doc definition-catalog-spec

/**
 * yaml-lite — 경량 YAML 파서 (zero-dependency).
 *
 * frontmatter.ts에서 추출 — 범용 재사용 가능한 순수 함수.
 * frontmatter 수준의 YAML만 지원: 중첩 1단계, 인라인 배열, 블록 배열(object[]).
 */

/**
 * YAML 문자열 → Record 파싱.
 *
 * 지원 범위:
 * - 최상위 스칼라 (key: value)
 * - 중첩 1단계 (parent:\n  key: value)
 * - 인라인 배열 (key: [a, b, c])
 * - 블록 배열 — 최상위 키 바로 아래 indent 2 (key:\n  - f: v)
 * - 블록 배열 — 중첩 키 아래 indent 4+ (parent:\n  key:\n    - f: v)
 */
export function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  let currentKey = '';
  let currentObj: Record<string, unknown> = result;
  let inArray = false;
  let arrayIndent = 0; // indent level where array items (- ) appear
  let arrayKey = '';
  let arrayOwner: Record<string, unknown> = result;
  let arrayItems: Record<string, string>[] = [];
  let currentArrayItem: Record<string, string> = {};

  function flushArray(): void {
    if (Object.keys(currentArrayItem).length > 0) {
      arrayItems.push(currentArrayItem);
      currentArrayItem = {};
    }
    arrayOwner[arrayKey] = arrayItems;
    inArray = false;
    arrayItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    // 빈 줄, 주석 무시
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // 배열 항목 처리 (- key: value) — arrayIndent 수준
    if (inArray && indent === arrayIndent && trimmed.startsWith('- ')) {
      if (Object.keys(currentArrayItem).length > 0) {
        arrayItems.push(currentArrayItem);
      }
      currentArrayItem = {};
      const kvMatch = trimmed.slice(2).match(/^(\S[^:]*?):\s*(.+)$/);
      if (kvMatch) {
        currentArrayItem[kvMatch[1].trim()] = unquote(kvMatch[2].trim());
      }
      continue;
    }

    // 배열 항목 연속 키 (arrayIndent + 2 이상)
    if (inArray && indent > arrayIndent && !trimmed.startsWith('- ')) {
      const kvMatch = trimmed.match(/^(\S[^:]*?):\s*(.*)$/);
      if (kvMatch && kvMatch[2].trim().length > 0) {
        currentArrayItem[kvMatch[1].trim()] = unquote(kvMatch[2].trim());
      }
      continue;
    }

    // 배열 끝 감지 (indent가 arrayIndent보다 작거나 같지만 다른 구조)
    if (
      inArray &&
      (indent < arrayIndent || (indent === arrayIndent && !trimmed.startsWith('- ')))
    ) {
      flushArray();
    }

    // 최상위 키 (indent 0)
    if (indent === 0) {
      const keyMatch = trimmed.match(/^(\w+):\s*$/);
      if (keyMatch) {
        currentKey = keyMatch[1];
        const nested: Record<string, unknown> = {};
        result[currentKey] = nested;
        currentObj = nested;
        continue;
      }
      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        result[kvMatch[1]] = parseScalar(kvMatch[2]);
        currentKey = '';
        currentObj = result;
        continue;
      }
    }

    // 최상위 배열 항목 (indent 2, 최상위 키 직속 — currentObj가 nested object)
    // 최상위 키 바로 아래에 - 로 시작하면 최상위 키가 배열임
    if (indent === 2 && currentKey && trimmed.startsWith('- ') && !inArray) {
      // currentObj(nested object)를 배열로 교체
      inArray = true;
      arrayIndent = 2;
      arrayKey = currentKey;
      arrayOwner = result;
      arrayItems = [];
      currentArrayItem = {};
      result[currentKey] = []; // placeholder, flushArray가 덮어씀

      const kvMatch = trimmed.slice(2).match(/^(\S[^:]*?):\s*(.+)$/);
      if (kvMatch) {
        currentArrayItem[kvMatch[1].trim()] = unquote(kvMatch[2].trim());
      }
      continue;
    }

    // 중첩 키 (indent 2, 아직 배열이 아닌 경우)
    if (indent === 2 && currentKey && !inArray) {
      const keyOnly = trimmed.match(/^(\w+):\s*$/);
      if (keyOnly) {
        // 중첩 배열: indent 4에서 - 로 시작하는 항목
        inArray = true;
        arrayIndent = 4;
        arrayKey = keyOnly[1];
        arrayOwner = currentObj;
        arrayItems = [];
        currentArrayItem = {};
        continue;
      }

      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const value = kvMatch[2].trim();
        if (value.startsWith('[') && value.endsWith(']')) {
          currentObj[kvMatch[1]] = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        } else {
          currentObj[kvMatch[1]] = parseScalar(value);
        }
        continue;
      }
    }
  }

  // 마지막 배열 항목 정리
  if (inArray) {
    flushArray();
  }

  return result;
}

/** 스칼라 값 타입 변환: true/false → boolean, 숫자 → number, 따옴표 제거 */
export function parseScalar(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;
  return unquote(value);
}

/**
 * 따옴표로 감싼 스칼라의 따옴표를 벗긴다 (타입 변환 없음).
 * 배열 항목 값(`- key: value`)은 문자열로 유지하되, `'@scope/pkg'`처럼 YAML 규칙상 따옴표가 필요한 값도
 * 최상위 값과 같은 문자열이 되어야 한다.
 */
export function unquote(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
