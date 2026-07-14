import { createHash } from 'node:crypto';
import type { TaxonomyIR } from '../schema/ir.js';
import type { Diagnostic } from '../schema/diagnostic.js';
import { validate } from '../validate/index.js';
import {
  renderAxes,
  renderAddresses,
  renderRegistry,
  renderRelations,
  renderMeta,
} from './render.js';

export type CodegenOptions = {
  taxonomyName?: string;
  generatedAt?: string;
  skipValidate?: boolean;
};

export type CodegenResult = {
  files: Record<string, string>;
  contentHash: string;
};

export class CodegenValidationError extends Error {
  constructor(public diagnostics: Diagnostic[]) {
    super(`codegen 거부: validate errors=${diagnostics.length} (spec §7.3 — errors=0 필수)`);
    this.name = 'CodegenValidationError';
  }
}

export function codegen(ir: TaxonomyIR, opts: CodegenOptions = {}): CodegenResult {
  if (!opts.skipValidate) {
    const errs = validate(ir).filter((d) => d.severity === 'error');
    if (errs.length > 0) {
      throw new CodegenValidationError(errs);
    }
  }

  // 결정론: generatedAt는 IR contentHash로부터 derive (실제 호출 시간 사용 X)
  const generatedAt = opts.generatedAt ?? `derived-from-${ir.contentHash}`;

  const filesNoMeta: Record<string, string> = {
    'axes.ts': renderAxes(ir),
    'addresses.ts': renderAddresses(ir),
    'registry.ts': renderRegistry(ir),
    'relations.ts': renderRelations(ir),
  };

  const contentHash = createHash('sha256')
    .update(
      Object.entries(filesNoMeta)
        .sort()
        .map(([k, v]) => `${k}\0${v}`)
        .join('\0'),
    )
    .digest('hex')
    .slice(0, 16);

  const files = {
    ...filesNoMeta,
    'meta.ts': renderMeta(ir, contentHash, generatedAt),
  };

  return { files, contentHash };
}
