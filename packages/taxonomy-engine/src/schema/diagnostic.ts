import type { Severity } from "./ir.js";

export type DiagnosticCode =
  | `parse-${string}`
  | `structural-${string}`
  | `capacity-${string}`
  | `ref-${string}`
  | `constraint-${string}`
  | `axis-5q-${string}`
  | `version-${string}`
  | `codegen-${string}`;

export type Diagnostic = {
  severity: Severity;
  code: DiagnosticCode;
  message: string;
  ref?: string;
  location?: { file?: string; line?: number; column?: number };
  hint?: string;
  meta?: Record<string, unknown>;
};
