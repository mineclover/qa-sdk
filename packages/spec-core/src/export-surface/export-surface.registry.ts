import type { ExportSurface } from "./export-surface.types.js";
import { DuplicateRegistrationError, NotFoundError } from "spec-schema";

/**
 * prefix별 export surface를 등록하고 제목을 resolve하는 레지스트리.
 *
 * 순수 TypeScript 클래스 — NestJS 의존 없음.
 * CLI에서는 직접 new, 서버에서는 provider로 감싸서 사용.
 */
export class ExportSurfaceRegistry {
  private readonly surfaces = new Map<string, ExportSurface>();

  /** prefix의 export surface 등록 */
  register(prefixId: string, surface: ExportSurface): void {
    if (this.surfaces.has(prefixId)) {
      throw new DuplicateRegistrationError("ExportSurface", prefixId);
    }
    this.surfaces.set(prefixId, surface);
  }

  /** prefix의 export surface 조회 */
  get(prefixId: string): ExportSurface {
    const surface = this.surfaces.get(prefixId);
    if (!surface) throw new NotFoundError("ExportSurface", prefixId);
    return surface;
  }

  /** prefix가 등록되어 있는지 확인 */
  has(prefixId: string): boolean {
    return this.surfaces.has(prefixId);
  }

  /**
   * 좌표의 제목(title)을 생성한다.
   *
   * @param prefixId - prefix 식별자
   * @param values - entries lookup 결과 (차원 ID → entry 문자열)
   * @returns 제목 문자열
   *
   * @example
   * resolve("permission", { action: "add", role: "admin" }) → "add.admin"
   */
  resolve(prefixId: string, values: Record<string, string>): string {
    const surface = this.get(prefixId);
    return resolvePattern(surface.pattern, values);
  }

  /** 등록된 모든 prefix ID */
  keys(): IterableIterator<string> {
    return this.surfaces.keys();
  }

  /** 등록된 prefix 수 */
  get size(): number {
    return this.surfaces.size;
  }
}

/**
 * 패턴 문자열의 {dimId} 플레이스홀더를 values로 치환.
 *
 * @example resolvePattern("{action}.{role}", { action: "add", role: "admin" }) → "add.admin"
 */
function resolvePattern(
  pattern: string,
  values: Record<string, string>,
): string {
  return pattern.replace(/\{(\w+)\}/g, (_, dimId: string) => {
    const value = values[dimId];
    if (value === undefined) {
      throw new Error(`Missing value for dimension "${dimId}" in pattern "${pattern}"`);
    }
    return value;
  });
}
