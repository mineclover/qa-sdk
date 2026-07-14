// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Transition Spec Registry — 인메모리 등록/조회.
 *
 * Map<name, Map<version, TransitionSpec>> 구조.
 */

import type { TransitionSpec, ValidationResult } from './transition.types.js';
import { validateTransitionSpec } from './transition.schema.js';

export class TransitionRegistry {
  private readonly specs = new Map<string, Map<string, TransitionSpec>>();

  /** spec 등록. 검증 실패 시 ValidationResult 반환 */
  register(spec: TransitionSpec): ValidationResult {
    const result = validateTransitionSpec(spec);
    if (!result.valid) return result;

    let versions = this.specs.get(spec.transition);
    if (!versions) {
      versions = new Map();
      this.specs.set(spec.transition, versions);
    }
    versions.set(spec.version, spec);
    return result;
  }

  /** 이름 + 버전으로 조회. 버전 생략 시 최신 */
  get(name: string, version?: string): TransitionSpec | undefined {
    const versions = this.specs.get(name);
    if (!versions) return undefined;

    if (version) return versions.get(version);

    // 버전 생략 시 마지막 등록된 것 반환
    let last: TransitionSpec | undefined;
    for (const spec of versions.values()) {
      last = spec;
    }
    return last;
  }

  /** 특정 transition의 모든 버전 */
  getVersions(name: string): TransitionSpec[] {
    const versions = this.specs.get(name);
    if (!versions) return [];
    return [...versions.values()];
  }

  /** 등록된 모든 spec */
  list(): TransitionSpec[] {
    const result: TransitionSpec[] = [];
    for (const versions of this.specs.values()) {
      for (const spec of versions.values()) {
        result.push(spec);
      }
    }
    return result;
  }

  /** 등록된 transition 이름 목록 */
  names(): string[] {
    return [...this.specs.keys()];
  }

  /** 등록 수 */
  get size(): number {
    let count = 0;
    for (const versions of this.specs.values()) {
      count += versions.size;
    }
    return count;
  }

  /** 특정 spec 삭제 */
  remove(name: string, version?: string): boolean {
    if (version) {
      const versions = this.specs.get(name);
      if (!versions) return false;
      const deleted = versions.delete(version);
      if (versions.size === 0) this.specs.delete(name);
      return deleted;
    }
    return this.specs.delete(name);
  }

  /** 전체 초기화 */
  clear(): void {
    this.specs.clear();
  }
}
