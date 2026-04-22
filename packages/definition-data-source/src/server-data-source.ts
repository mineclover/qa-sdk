// @def.doc definition-data-source

/**
 * ServerDataSource — definition-service HTTP API로 데이터 접근
 *
 * DefinitionClient를 래핑하여 DefDataSource 인터페이스를 구현.
 */

import type {
  DefBoundaryContextResult,
  DefBoundaryResolutionCandidate,
  DefBoundaryResult,
  DefCodeReference,
  DefDataSource,
  DefDoc,
  DefDocBody,
  DefFileBoundaryResolution,
  DefFeedbackRequestSummary,
  DefIncomingLink,
  DefListFilter,
  DefOutgoingLink,
  DefSyntheticIncomingLink,
  DefValidateOptions,
  DefValidationResult,
} from "definition-catalog";

export class ServerDataSource implements DefDataSource {
  readonly mode = "server" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5_000,
  ) {}

  async get(docId: string): Promise<DefDoc | null> {
    try {
      return await this.fetchJson(`/docs/${docId}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw new Error(`서버 연결 실패 (${this.baseUrl}): ${(e as Error).message}`, { cause: e });
    }
  }

  async getByAddress(address: string): Promise<DefDoc | null> {
    try {
      return await this.fetchJson(`/docs/by-address/${encodeURIComponent(address)}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw new Error(`서버 연결 실패 (${this.baseUrl}): ${(e as Error).message}`, { cause: e });
    }
  }

  async getBody(docId: string): Promise<DefDocBody | null> {
    try {
      return await this.fetchJson(`/docs/${docId}/body`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw new Error(`서버 연결 실패 (${this.baseUrl}): ${(e as Error).message}`, { cause: e });
    }
  }

  async resolveByFile(filePath: string): Promise<DefFileBoundaryResolution> {
    const params = new URLSearchParams({ path: filePath });
    return this.fetchJson(`/docs/by-file?${params.toString()}`);
  }

  async list(filter?: DefListFilter): Promise<DefDoc[]> {
    const params = new URLSearchParams();
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
    }
    const qs = params.toString();
    const result = await this.fetchJson<{ docs: DefDoc[] }>(`/docs${qs ? `?${qs}` : ""}`);
    return result.docs;
  }

  async getChildren(docId: string): Promise<DefDoc[]> {
    const result = await this.fetchJson<{ children: DefDoc[] }>(`/docs/${docId}/children`);
    return result.children;
  }

  async getParent(docId: string): Promise<DefDoc | null> {
    const result = await this.fetchJson<{ parent: DefDoc | null }>(`/docs/${docId}/parent`);
    return result.parent;
  }

  async getIncomingLinks(docId: string): Promise<DefIncomingLink[]> {
    const result = await this.fetchJson<{ links: DefIncomingLink[] }>(`/docs/${docId}/incoming-links`);
    return result.links;
  }

  async getSyntheticIncomingLinks(docId: string): Promise<DefSyntheticIncomingLink[]> {
    const result = await this.fetchJson<{ links: DefSyntheticIncomingLink[] }>(`/docs/${docId}/synthetic-incoming-links`);
    return result.links;
  }

  async getOutgoingLinks(docId: string): Promise<DefOutgoingLink[]> {
    const result = await this.fetchJson<{ links: DefOutgoingLink[] }>(`/docs/${docId}/outgoing-links`);
    return result.links;
  }

  async getFeedbackRequestsByDocId(docId: string, limit = 10): Promise<DefFeedbackRequestSummary[]> {
    const result = await this.fetchJson<{ items: DefFeedbackRequestSummary[] }>(`/docs/${docId}/feedback-requests?limit=${limit}`);
    return result.items;
  }

  async getBoundary(
    docId: string,
    level: "purpose" | "overview" = "overview",
  ): Promise<DefBoundaryResult | null> {
    return this.fetchJson<DefBoundaryResult>(`/docs/${docId}/boundary?level=${level}`);
  }

  async getBoundaryContext(
    docId: string,
    level: "purpose" | "overview" = "overview",
    mode: "direct" | "transitive" = "transitive",
  ): Promise<DefBoundaryContextResult | null> {
    return this.fetchJson<DefBoundaryContextResult>(`/graph/${docId}/boundary-context?level=${level}&mode=${mode}`);
  }

  async validate(_options?: DefValidateOptions): Promise<DefValidationResult> {
    // 서버는 코드 정적 스캔 불가 — _options.includeCoordStorageCheck는 무시한다.
    return this.fetchJson("/graph/validate", "POST");
  }

  /** 서버 접근 가능 여부 */
  async ping(): Promise<boolean> {
    try {
      await this.fetchJson("/health");
      return true;
    } catch {
      return false;
    }
  }

  private async fetchJson<T>(path: string, method = "GET"): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }
}
