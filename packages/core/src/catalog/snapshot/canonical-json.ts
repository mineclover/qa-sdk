// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * canonicalJson — RFC 8785(JCS) 부분집합 직렬화.
 *
 * - object key: UTF-16 code unit 오름차순 (Array.prototype.sort 기본 비교)
 * - undefined 값을 가진 key는 생략, 배열 안의 undefined는 null
 * - number/string 표기는 ECMAScript JSON.stringify (JCS가 채택한 규칙과 동일)
 * - NaN·Infinity·bigint·function·symbol은 TypeError — digest 입력에서 조용한 손실 금지
 */
export function canonicalJson(value: unknown): string {
  return serialize(value, '$');
}

function serialize(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`canonicalJson: 유한하지 않은 숫자는 직렬화할 수 없습니다 (${path})`);
      }
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`canonicalJson: ${typeof value} 값은 직렬화할 수 없습니다 (${path})`);
  }

  if (Array.isArray(value)) {
    const items = value.map((item, i) =>
      item === undefined ? 'null' : serialize(item, `${path}[${i}]`),
    );
    return `[${items.join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serialize(record[key], `${path}.${key}`)}`);
  return `{${members.join(',')}}`;
}
