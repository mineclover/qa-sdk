import type {
  MigrationStore,
  MigrationMapping,
  MigrationResolveResult,
} from "../migration-store.js";
import type { EntityId } from "../types.js";

export class InMemoryMigrationStore implements MigrationStore {
  private readonly _mappings: MigrationMapping[] = [];

  async saveMappings(prefix: string, mappings: readonly MigrationMapping[]): Promise<void> {
    // 중복 방지: (fromVersionId, toVersionId, position) 기준
    for (const m of mappings) {
      const exists = this._mappings.some(
        (e) =>
          e.fromVersionId === m.fromVersionId &&
          e.toVersionId === m.toVersionId &&
          e.position === m.position,
      );
      if (exists) {
        throw new Error(
          `Duplicate mapping: ${m.fromVersionId}→${m.toVersionId} position ${m.position}`,
        );
      }
      this._mappings.push(m);
    }
  }

  async getHistory(prefix: string, position: number): Promise<MigrationMapping[]> {
    return this._mappings
      .filter((m) => m.position === position)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getMappings(
    prefix: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<MigrationMapping[]> {
    return this._mappings
      .filter((m) => m.fromVersionId === fromVersionId && m.toVersionId === toVersionId)
      .sort((a, b) => a.position - b.position);
  }

  async resolveToLatest(
    prefix: string,
    fromVersionId: string,
    position: number,
    latestVersionId: string,
  ): Promise<MigrationResolveResult> {
    const chain: MigrationMapping[] = [];
    let currentVersionId = fromVersionId;
    let currentEntityId: EntityId | null = null;
    let foundInitial = false;

    // 체이닝: fromVersionId → ... → latestVersionId
    const visited = new Set<string>();
    while (currentVersionId !== latestVersionId) {
      if (visited.has(currentVersionId)) break; // 순환 방지
      visited.add(currentVersionId);

      // 현재 버전에서 다음 버전으로의 매핑 찾기
      const nextMappings = this._mappings.filter(
        (m) => m.fromVersionId === currentVersionId,
      );
      if (nextMappings.length === 0) break;

      // 같은 position의 매핑 찾기
      const toVersionId = nextMappings[0]!.toVersionId;
      const mapping = nextMappings.find((m) => m.position === position);

      if (mapping) {
        chain.push(mapping);
        if (mapping.changeType === "deactivated") {
          currentEntityId = null;
          currentVersionId = toVersionId;
          break;
        }
        currentEntityId = mapping.newEntityId;
        foundInitial = true;
      }
      currentVersionId = toVersionId;
    }

    return {
      currentVersionId,
      currentEntityId: foundInitial ? currentEntityId : null,
      chain,
    };
  }
}
