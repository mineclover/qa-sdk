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
 * - 블록 배열 (key:\n    - target: x\n      type: y)
 */
export function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let currentKey = "";
  let currentObj: Record<string, unknown> = result;
  let inArray = false;
  let arrayKey = "";
  let arrayItems: Record<string, string>[] = [];
  let currentArrayItem: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    // 빈 줄, 주석 무시
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // 배열 항목 처리 (- key: value)
    if (inArray && indent >= 4 && trimmed.startsWith("- ")) {
      if (Object.keys(currentArrayItem).length > 0) {
        arrayItems.push(currentArrayItem);
      }
      currentArrayItem = {};
      const kvMatch = trimmed.slice(2).match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        currentArrayItem[kvMatch[1]] = kvMatch[2].trim();
      }
      continue;
    }

    // 배열 항목 연속 키
    if (inArray && indent >= 6 && !trimmed.startsWith("- ")) {
      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        currentArrayItem[kvMatch[1]] = kvMatch[2].trim();
      }
      continue;
    }

    // 배열 끝 감지
    if (inArray && indent < 4) {
      if (Object.keys(currentArrayItem).length > 0) {
        arrayItems.push(currentArrayItem);
        currentArrayItem = {};
      }
      (currentObj as Record<string, unknown>)[arrayKey] = arrayItems;
      inArray = false;
      arrayItems = [];
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
        currentObj = result;
        continue;
      }
    }

    // 중첩 키 (indent 2)
    if (indent === 2 && currentKey) {
      const keyOnly = trimmed.match(/^(\w+):\s*$/);
      if (keyOnly) {
        inArray = true;
        arrayKey = keyOnly[1];
        arrayItems = [];
        currentArrayItem = {};
        continue;
      }

      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const value = kvMatch[2].trim();
        if (value.startsWith("[") && value.endsWith("]")) {
          currentObj[kvMatch[1]] = value
            .slice(1, -1)
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);
        } else {
          currentObj[kvMatch[1]] = parseScalar(value);
        }
        continue;
      }
    }
  }

  // 마지막 배열 항목 정리
  if (inArray) {
    if (Object.keys(currentArrayItem).length > 0) {
      arrayItems.push(currentArrayItem);
    }
    (currentObj as Record<string, unknown>)[arrayKey] = arrayItems;
  }

  return result;
}

/** 스칼라 값 타입 변환: true/false → boolean, 숫자 → number, 따옴표 제거 */
export function parseScalar(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
