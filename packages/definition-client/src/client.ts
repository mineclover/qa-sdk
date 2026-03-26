/**
 * DefinitionClient — definition-service HTTP 클라이언트
 *
 * NestJS 무관한 순수 HTTP 클라이언트.
 * 어떤 런타임에서든 사용 가능 (Node, Bun, Cloudflare Workers, 브라우저).
 */

import type {
  DocRecord,
  DocHistoryRecord,
  DocListResponse,
  DocHistoryResponse,
  SliceIntentRecord,
  IntentListResponse,
  IntentResolveResponse,
  IntentCreateInput,
  ConsumptionSnapshot,
  ConsumptionRecordInput,
  ImpactResult,
  SyncResult,
} from "./types.js";

export interface DefinitionClientOptions {
  /** definition-service base URL (예: "http://localhost:3700") */
  baseUrl: string;
  /** fetch 구현 (기본: globalThis.fetch) */
  fetch?: typeof fetch;
  /** 요청 타임아웃 ms (기본: 5000) */
  timeoutMs?: number;
}

export class DefinitionClient {
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: DefinitionClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this._fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  // ─── 문서 ─────────────────────────────────────────────

  /** 문서 목록 조회 */
  async listDocs(filter?: { scope?: string; aspect?: string; lifecycle?: string }): Promise<DocListResponse> {
    const params = new URLSearchParams();
    if (filter?.scope) params.set("scope", filter.scope);
    if (filter?.aspect) params.set("aspect", filter.aspect);
    if (filter?.lifecycle) params.set("lifecycle", filter.lifecycle);
    const qs = params.toString();
    return this.get(`/docs${qs ? `?${qs}` : ""}`);
  }

  /** 단일 문서 조회 */
  async getDoc(docId: string): Promise<DocRecord> {
    return this.get(`/docs/${docId}`);
  }

  /** 문서 버전 이력 */
  async getDocHistory(docId: string, limit?: number): Promise<DocHistoryResponse> {
    const qs = limit ? `?limit=${limit}` : "";
    return this.get(`/docs/${docId}/history${qs}`);
  }

  /** 특정 버전 조회 (body 포함) */
  async getDocVersion(docId: string, version: number): Promise<DocHistoryRecord> {
    return this.get(`/docs/${docId}/history/${version}`);
  }

  // ─── 의도 ─────────────────────────────────────────────

  /** prefix의 모든 의도 조회 */
  async listIntents(prefixId: string): Promise<IntentListResponse> {
    return this.get(`/intents/${prefixId}`);
  }

  /** 주소에 매칭되는 의도 체인 해석 */
  async resolveIntents(prefixId: string, dims: Record<string, string>): Promise<IntentResolveResponse> {
    const dimsStr = Object.entries(dims).map(([k, v]) => `${k}:${v}`).join(",");
    return this.get(`/intents/${prefixId}/resolve?dims=${encodeURIComponent(dimsStr)}`);
  }

  /** 의도 등록 */
  async createIntent(prefixId: string, input: IntentCreateInput): Promise<{ id: number; prefixId: string }> {
    return this.post(`/intents/${prefixId}`, input);
  }

  /** 의도 수정 */
  async updateIntent(id: number, patch: { intent?: string; observationGoal?: string; owner?: string }): Promise<{ ok: boolean }> {
    return this.put(`/intents/${id}`, patch);
  }

  /** 의도 삭제 */
  async deleteIntent(id: number): Promise<{ ok: boolean }> {
    return this.del(`/intents/${id}`);
  }

  // ─── Prefix 공급 ───────────────────────────────────────

  /** prefix 목록 조회 */
  async listPrefixes(filter?: { category?: string }): Promise<{ prefixes: unknown[]; total: number }> {
    const qs = filter?.category ? `?category=${filter.category}` : "";
    return this.get(`/prefixes${qs}`);
  }

  /** prefix 상세 조회 */
  async getPrefix(prefixId: string): Promise<unknown> {
    return this.get(`/prefixes/${prefixId}`);
  }

  /** prefix 의존 체인 */
  async getPrefixDeps(prefixId: string): Promise<{ prefixId: string; depChain: string[]; depth: number }> {
    return this.get(`/prefixes/${prefixId}/deps`);
  }

  /** prefix를 참조하는 역방향 목록 */
  async getPrefixDependents(prefixId: string): Promise<{ prefixId: string; dependents: string[]; total: number }> {
    return this.get(`/prefixes/${prefixId}/dependents`);
  }

  // ─── 소비율 ───────────────────────────────────────────

  /** 소비율 스냅샷 기록 */
  async recordConsumption(prefixId: string, input: ConsumptionRecordInput): Promise<{ id: number; consumptionRate: number }> {
    return this.post(`/consumption/${prefixId}`, input);
  }

  /** 최신 소비율 조회 */
  async getConsumption(prefixId: string): Promise<ConsumptionSnapshot> {
    return this.get(`/consumption/${prefixId}`);
  }

  /** 소비율 시계열 */
  async getConsumptionHistory(prefixId: string, limit?: number): Promise<{ snapshots: ConsumptionSnapshot[]; total: number }> {
    const qs = limit ? `?limit=${limit}` : "";
    return this.get(`/consumption/${prefixId}/history${qs}`);
  }

  // ─── 그래프 ───────────────────────────────────────────

  /** 영향 분석 (blast radius) */
  async getImpact(docId: string): Promise<ImpactResult> {
    return this.get(`/graph/${docId}/impact`);
  }

  /** concern 전파 조회 */
  async getConcerns(docId: string): Promise<{ docId: string; concerns: unknown }> {
    return this.get(`/graph/${docId}/concerns`);
  }

  // ─── 동기화 ───────────────────────────────────────────

  /** 동기화 실행 */
  async triggerSync(): Promise<SyncResult> {
    return this.post("/sync", {});
  }

  /** 마지막 동기화 상태 */
  async getSyncStatus(): Promise<SyncResult> {
    return this.get("/sync");
  }

  // ─── 테스트 레지스트리 ─────────────────────────────────

  /** 문서 ↔ 테스트 매핑 등록 */
  async registerTest(input: { docId: string; testFile: string; suite?: string; description?: string; layer?: string }): Promise<{ id: number }> {
    return this.post("/tests/register", input);
  }

  /** 문서에 등록된 테스트 조회 */
  async getTests(docId: string): Promise<{ docId: string; tests: unknown[]; total: number }> {
    return this.get(`/tests/${docId}`);
  }

  /** 문서 테스트 상태 (pass rate, healthy) */
  async getTestStatus(docId: string): Promise<{ docId: string; healthy: boolean; passRate: number; registrations: number }> {
    return this.get(`/tests/${docId}/status`);
  }

  /** 문서 변경 시 실행해야 할 테스트 식별 */
  async getAffectedTests(docId: string): Promise<{ changedDoc: string; affectedTests: unknown[]; totalTests: number }> {
    return this.get(`/tests/affected/${docId}`);
  }

  /** 테스트 결과 기록 */
  async reportTestResult(result: { docId: string; testFile: string; suite?: string; passed: number; failed: number; skipped?: number; durationMs?: number; errorSummary?: string }): Promise<{ id: number }> {
    return this.post("/tests/results", result);
  }

  /** 테스트 결과 시계열 */
  async getTestHistory(docId: string, limit?: number): Promise<{ docId: string; results: unknown[]; total: number }> {
    const qs = limit ? `?limit=${limit}` : "";
    return this.get(`/tests/${docId}/history${qs}`);
  }

  /** 전체 테스트 커버리지 요약 */
  async getTestCoverage(): Promise<{ registeredDocs: number; totalRegistrations: number; healthyDocs: number; failingDocs: number }> {
    return this.get("/tests/coverage/summary");
  }

  // ─── 헬스 ─────────────────────────────────────────────

  async health(): Promise<{ status: string; service: string }> {
    return this.get("/health");
  }

  // ─── 내부 HTTP 헬퍼 ───────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DefinitionClientError(res.status, await res.text(), path);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DefinitionClientError(res.status, await res.text(), path);
    return res.json() as Promise<T>;
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DefinitionClientError(res.status, await res.text(), path);
    return res.json() as Promise<T>;
  }

  private async del<T>(path: string): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DefinitionClientError(res.status, await res.text(), path);
    return res.json() as Promise<T>;
  }
}

/** definition-service 통신 에러 */
export class DefinitionClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`definition-service ${path} → ${status}: ${body}`);
    this.name = "DefinitionClientError";
  }
}
