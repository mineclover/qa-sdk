// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * RegistryHttpClient — registry-service HTTP API를 호출하는 RegistryPort 구현.
 *
 * InMemoryRegistry 대신 실제 서버에 연결.
 * 환경 변수: QA_REGISTRY_URL (기본: http://localhost:3300)
 */

import type { RegistryPort } from './registry-port.js';

export class RegistryHttpClient implements RegistryPort {
  private readonly baseUrl: string;

  /**
   * @param baseUrl — registry-service URL. 미지정 시 QA_REGISTRY_URL env fallback.
   *   라이브러리에서 process.env 직접 접근은 최소화하되, CLI/SDK 편의를 위해 fallback 유지.
   */
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.QA_REGISTRY_URL ?? 'http://localhost:3300';
  }

  private async request(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Registry API error: ${res.status} ${res.statusText} — ${body}`);
    }
    return res;
  }

  async registerPrefix(input: {
    prefix: string;
    owner: string;
    kind: 'leaf' | 'composite';
    numberType: 'number' | 'bigint';
  }): Promise<void> {
    await this.request('/prefixes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async createDraft(input: {
    prefix: string;
    versionId: string;
    baseVersionId: string | null;
    capacity: number;
    refs?: Array<{ prefix: string; versionId: string }>;
  }): Promise<void> {
    await this.request(`/prefixes/${input.prefix}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        versionId: input.versionId,
        baseVersionId: input.baseVersionId,
        capacity: input.capacity,
        refs: input.refs,
      }),
    });
  }

  async getActiveVersion(prefix: string): Promise<string | null> {
    try {
      const res = await this.request(`/prefixes/${prefix}/versions?status=active`);
      const versions = (await res.json()) as Array<{ versionId: string }>;
      return versions.length > 0 ? versions[0].versionId : null;
    } catch {
      return null;
    }
  }

  async hasPrefix(prefix: string): Promise<boolean> {
    try {
      await this.request(`/prefixes/${prefix}`);
      return true;
    } catch {
      return false;
    }
  }

  async getVersionStatus(prefix: string, versionId: string): Promise<string | null> {
    try {
      const res = await this.request(`/prefixes/${prefix}/versions/${versionId}`);
      const data = (await res.json()) as { status: string };
      return data.status;
    } catch {
      return null;
    }
  }

  async lockDraft(prefix: string, versionId: string): Promise<void> {
    await this.request(`/prefixes/${prefix}/versions/${versionId}/lock`, { method: 'POST' });
  }

  async release(prefix: string, versionId: string): Promise<void> {
    await this.request(`/prefixes/${prefix}/versions/${versionId}/release`, { method: 'POST' });
  }

  async activate(prefix: string, versionId: string): Promise<void> {
    await this.request(`/prefixes/${prefix}/versions/${versionId}/activate`, { method: 'POST' });
  }

  async deprecate(prefix: string, versionId: string): Promise<void> {
    await this.request(`/prefixes/${prefix}/versions/${versionId}/deprecate`, { method: 'POST' });
  }
}
