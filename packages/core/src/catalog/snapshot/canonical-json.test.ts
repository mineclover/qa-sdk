import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical-json.js';

describe('canonicalJson', () => {
  it('object key를 UTF-16 code unit 순서로 정렬한다 (localeCompare 아님)', () => {
    expect(canonicalJson({ é: 1, a: 2, _: 3, B: 4 })).toBe('{"B":4,"_":3,"a":2,"é":1}');
  });

  it('중첩 구조와 배열 순서를 보존한다', () => {
    expect(canonicalJson({ b: [3, 1, { d: true, c: null }], a: 'x' })).toBe(
      '{"a":"x","b":[3,1,{"c":null,"d":true}]}',
    );
  });

  it('undefined 값을 가진 key는 생략하고 배열의 undefined는 null로 쓴다', () => {
    expect(canonicalJson({ a: undefined, b: [undefined, 1] })).toBe('{"b":[null,1]}');
  });

  it('숫자는 ECMAScript 표준 표기를 쓴다', () => {
    expect(canonicalJson([1e21, 0.1, -0, 1.5])).toBe('[1e+21,0.1,0,1.5]');
  });

  it('JSON으로 표현할 수 없는 값은 조용히 버리지 않고 TypeError를 던진다', () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    expect(() => canonicalJson({ a: 1n })).toThrow(TypeError);
    expect(() => canonicalJson({ a: () => 1 })).toThrow(TypeError);
  });

  it('오류 메시지에 값의 경로를 포함한다', () => {
    expect(() => canonicalJson({ a: [{ b: Number.NaN }] })).toThrow('$.a[0].b');
  });
});
