/**
 * ServerDataSource — definition-service HTTP API로 데이터 접근
 *
 * DefinitionClient를 래핑하여 DefDataSource 인터페이스를 구현.
 */

import type {
  DefDataSource,
  DefDoc,
  DefIncomingLink,
  DefListFilter,
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
      throw new Error(`서버 연결 실패 (${this.baseUrl}): ${(e as Error).message}`);
    }
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

  async getOutgoingLinks(docId: string): Promise<{ target: string; type: string }[]> {
    const result = await this.fetchJson<{ links: { target: string; type: string }[] }>(`/docs/${docId}/outgoing-links`);
    return result.links;
  }

  async validate(): Promise<DefValidationResult> {
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
