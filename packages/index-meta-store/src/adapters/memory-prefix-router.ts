// @def.boundary index-meta-system
// @def.doc index-meta-system

import type { PrefixRouter } from 'index-meta';

export class InMemoryPrefixRouter implements PrefixRouter {
  /** prefix → d1DatabaseId */
  private readonly _routes = new Map<string, string>();

  async getDatabase(prefix: string): Promise<string | null> {
    return this._routes.get(prefix) ?? null;
  }

  async route(prefix: string, d1DatabaseId: string): Promise<void> {
    this._routes.set(prefix, d1DatabaseId);
  }

  async listPrefixes(d1DatabaseId: string): Promise<string[]> {
    return [...this._routes.entries()]
      .filter(([, dbId]) => dbId === d1DatabaseId)
      .map(([prefix]) => prefix);
  }
}
