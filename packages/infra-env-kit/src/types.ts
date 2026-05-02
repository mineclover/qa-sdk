// @def.boundary shared-utility-group
// @def.doc shared-utility-group

export interface EnvServiceInfo {
  serviceId: string;
  name: string;
  url: string;
  tier: string;
  team?: string;
  ownedPrefixes: string[];
  consumedPrefixes: string[];
  urls?: Record<string, string>;
  urlFallback?: boolean;
  deployedWith?: string;
}

export interface EnvDiscoveryClient {
  resolve(serviceId: string, env?: string): Promise<EnvServiceInfo | null>;
  resolveAll(env?: string): Promise<Record<string, string>>;
  listServices(): Promise<EnvServiceInfo[]>;
}

export interface EnvConnectionConfig {
  endpoint: string;
  health_path?: string;
  [key: string]: unknown;
}

export interface EnvServiceConfig {
  depends_on?: string[];
  [key: string]: unknown;
}

export interface EnvResolvedConfig {
  services: Record<string, EnvServiceConfig>;
  connections: Record<string, EnvConnectionConfig>;
}
