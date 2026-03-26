import { Injectable } from "@nestjs/common";
import { resolve } from "node:path";
import {
  scanAndBuild,
  analyzeImpact,
  computeEffectiveConcerns,
  type ScanResult,
  type ImpactAnalysis,
  type EffectiveConcerns,
} from "definition-catalog";
import { env } from "../../config/env.js";

@Injectable()
export class GraphService {
  private cached: ScanResult | null = null;

  /** scanAndBuild 결과를 로딩/캐시한다 */
  async ensureLoaded(): Promise<ScanResult> {
    if (!this.cached) {
      this.cached = await scanAndBuild(env.ROOT_DIR, [resolve(env.ROOT_DIR, env.DOCS_DIR)]);
    }
    return this.cached;
  }

  /** sync 후 캐시 무효화 */
  invalidate(): void {
    this.cached = null;
  }

  async impact(docId: string): Promise<ImpactAnalysis | null> {
    const scan = await this.ensureLoaded();
    const entry = scan.registry.get(docId);
    if (!entry) return null;
    return analyzeImpact(
      docId,
      (id) => scan.registry.get(id),
      (id, dir) => scan.registry.getLinks(id, dir),
    );
  }

  async concerns(docId: string): Promise<{ docId: string; concerns: EffectiveConcerns } | null> {
    const scan = await this.ensureLoaded();
    const entry = scan.registry.get(docId);
    if (!entry) return null;
    const concerns = computeEffectiveConcerns(
      docId,
      (id) => scan.registry.get(id),
      (id, dir) => scan.registry.getLinks(id, dir),
    );
    return { docId, concerns };
  }
}
