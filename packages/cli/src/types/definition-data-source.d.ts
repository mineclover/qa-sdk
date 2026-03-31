declare module "definition-data-source" {
  import type { DefDataSource } from "definition-catalog";

  export interface DataSourceOptions {
    mode?: "local" | "server" | "scan";
    dbPath?: string;
    serverUrl?: string;
    rootDir?: string;
    docsDir?: string;
  }

  export interface SyncLocalDbOptions {
    rootDir: string;
    docsDir?: string;
    dbPath?: string;
  }

  export interface SyncLocalDbResult {
    synced: number;
    links: number;
    dbPath: string;
  }

  export function createDataSource(options?: DataSourceOptions): Promise<DefDataSource>;
  export function syncDocsToLocalDb(options: SyncLocalDbOptions): Promise<SyncLocalDbResult>;
}
