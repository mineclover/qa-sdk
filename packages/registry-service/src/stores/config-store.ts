// @def.boundary registry-system
// @def.doc registry-system

/**
 * ConfigStore — DkgConfig + PatternRules 등 카탈로그별 설정 저장.
 *
 * key: catalogId + configType (e.g., "demo:dkg-config", "demo:pattern-rules")
 */

export interface ConfigRecord {
  readonly catalogId: string;
  readonly configType: string;
  readonly data: string;
  readonly updatedAt: string;
}

export interface ConfigStore {
  get(catalogId: string, configType: string): Promise<ConfigRecord | null>;
  set(catalogId: string, configType: string, data: string): Promise<void>;
  list(catalogId: string): Promise<ConfigRecord[]>;
  delete(catalogId: string, configType: string): Promise<void>;
}
