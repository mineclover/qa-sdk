// @def.boundary observability-system-root
// @def.doc observability-system-root

import { newTraceId, newSpanId } from '@qa-sdk/core';

/**
 * Manages trace context for a QA session.
 * Holds current trace_id, span stack, and qa_session_id.
 */
export class TraceContext {
  readonly trace_id: string;
  private spanStack: string[] = [];
  qa_session_id?: string;

  constructor(options?: { trace_id?: string; qa_session_id?: string }) {
    this.trace_id = options?.trace_id ?? newTraceId();
    this.qa_session_id = options?.qa_session_id;
  }

  /** Push a new span onto the stack. Returns the new span_id. */
  pushSpan(span_id?: string): string {
    const id = span_id ?? newSpanId();
    this.spanStack.push(id);
    return id;
  }

  /** Pop the current span. Returns the popped span_id or undefined. */
  popSpan(): string | undefined {
    return this.spanStack.pop();
  }

  /** Current (deepest) span_id, or generates a new one if stack is empty. */
  get currentSpanId(): string {
    if (this.spanStack.length === 0) {
      return this.pushSpan();
    }
    return this.spanStack[this.spanStack.length - 1];
  }

  /** Parent span_id (one level above current), or undefined if at root. */
  get parentSpanId(): string | undefined {
    if (this.spanStack.length < 2) return undefined;
    return this.spanStack[this.spanStack.length - 2];
  }

  /** Current stack depth. */
  get depth(): number {
    return this.spanStack.length;
  }
}
