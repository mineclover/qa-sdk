// @def.boundary sim-identifier-grammar
import { z } from 'zod';

export const HEADER_DOMAINS = ['service', 'canary', 'trace', 'sim'] as const;
export type HeaderDomain = (typeof HEADER_DOMAINS)[number];

export interface HttpHeader {
  kind: 'header';
  domain: HeaderDomain;
  attr: string; // kebab-case
}

// 입력 원형 검증
export const HttpHeaderSchema = z.object({
  kind: z.literal('header'),
  domain: z.enum(HEADER_DOMAINS),
  attr: z.string().regex(/^[a-z][a-z0-9-]*$/),
});

// 합성 결과 검증 (x-${domain}-${attr})
const HEADER_NAME_PATTERN = /^x-(service|canary|trace|sim)-([a-z][a-z0-9-]*)$/;
export const HttpHeaderNameSchema = z.string().regex(HEADER_NAME_PATTERN);

export function buildHttpHeader(input: HttpHeader): string {
  const v = HttpHeaderSchema.parse(input);
  const out = `x-${v.domain}-${v.attr}`;
  return HttpHeaderNameSchema.parse(out);
}

export function parseHttpHeader(s: string): HttpHeader {
  const m = HEADER_NAME_PATTERN.exec(s);
  if (!m) throw new Error(`invalid HTTP header name: ${s}`);
  return {
    kind: 'header',
    domain: m[1] as HeaderDomain,
    attr: m[2],
  };
}
