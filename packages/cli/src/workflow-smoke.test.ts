// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * Workflow Smoke Suite — L3 계층 회귀 차단
 *
 * 목적: `docs/specs/system/layer-separation.rule.md` §2 (Workflow Smoke 원칙) 의
 * 자동화된 sentinel. Phase 3b Option B 같은 L1 semantic 변경이 L2 validator 를
 * 그대로 통과시키더라도 L3 user workflow 가 조용히 붕괴하는 상황을
 * non-empty assertion 으로 감지한다.
 *
 * 검증 Scenario:
 *   A. `def audit --by-domain` 이 핵심 루트를 모두 보고하고 문서 수 > 0
 *   B. `def topdown <root>` (collectDomainMembers union) 이 핵심 루트에 대해 ≥ 2 member 반환
 *   C. `def list --domain-root <root>` 가 ≥ 3 건 반환
 *   D. `def list --type=rule` (ext 필터) ≥ 8 건 반환 (현재 rule.md 19 건)
 *   E. 샘플 소스 파일의 `@def.boundary` 타깃이 DB 에 존재 + deprecated 아님
 *
 * 설계 원칙:
 *   - **non-empty assertion** — "silent empty" regression 감지가 핵심
 *   - **구체적 실패 메시지** — "{root} 가 {actual} member 반환 (≥ {expected} 기대)"
 *   - **data-independent** — 특정 child id 가 아닌 shape (count) 에 의존
 *   - **CI-friendly** — 외부 네트워크 불필요, workspace 내 sqlite DB 공유
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  createDataSource,
  syncDocsToLocalDb,
  type DataSourceOptions,
} from "definition-data-source";
import {
  deriveAllDomainRoots,
  type DefDataSource,
  type DefDoc,
  type DefinitionEntry,
  type DefinitionLink,
  type DomainRootRegistry,
} from "definition-catalog";

// ── 환경 탐색 ─────────────────────────────────────────────

/** pnpm workspace root 를 찾는다 — `pnpm-workspace.yaml` + `docs/` 가 있는 디렉토리 */
function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml")) && existsSync(join(current, "docs"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`workspace root 를 찾지 못했습니다 (from ${startDir}).`);
    }
    current = parent;
  }
}

const ROOT = findWorkspaceRoot(process.cwd());

/** 공유 DB 가 있으면 local, 없으면 DB 를 생성한 뒤 local 로 사용. */
async function ensureDataSource(): Promise<DefDataSource> {
  const defaultDb = join(ROOT, "data", "definition-service.sqlite");
  if (!existsSync(defaultDb)) {
    // CI 환경에서 DB 가 없을 때 자동 복원. 실제 docs/ 를 소스로 하므로 결과는 실데이터와 동일.
    await syncDocsToLocalDb({ rootDir: ROOT, docsDir: "docs" });
  }
  const options: DataSourceOptions = { mode: "local", rootDir: ROOT };
  return createDataSource(options);
}

// ── 도메인 루트 멤버 union helper (def.ts collectDomainMembers 와 동일 의미) ──

async function collectDomainMembers(
  source: DefDataSource,
  parentId: string,
): Promise<DefDoc[]> {
  const seen = new Set<string>();
  const members: DefDoc[] = [];

  const appendDoc = (doc: DefDoc | null | undefined) => {
    if (!doc) return;
    if (doc.docId === parentId) return;
    if (seen.has(doc.docId)) return;
    seen.add(doc.docId);
    members.push(doc);
  };

  for (const child of await source.getChildren(parentId)) appendDoc(child);

  const incoming = await source.getIncomingLinks(parentId);
  for (const link of incoming) {
    if (link.type !== "depends_on" && link.type !== "refines") continue;
    appendDoc(await source.get(link.source));
  }

  return members;
}

// ── DomainRootRegistry in-memory build (CLI buildDomainRootRegistry 와 동일) ──

async function buildRegistry(source: DefDataSource): Promise<DomainRootRegistry> {
  const docs = await source.list({ limit: 100000 });
  const entries = new Map<string, DefinitionEntry>();
  const outgoingLinks = new Map<string, DefinitionLink[]>();
  const incomingLinks = new Map<string, DefinitionLink[]>();

  for (const d of docs) {
    entries.set(d.docId, {
      id: d.docId,
      title: d.title ?? d.docId,
      tier: d.tier as DefinitionEntry["tier"],
      scope: d.scope as DefinitionEntry["scope"],
      aspect: d.aspect as DefinitionEntry["aspect"],
      depth: d.depth as DefinitionEntry["depth"],
      layer: d.layer as DefinitionEntry["layer"],
      lifecycle: d.lifecycle as DefinitionEntry["lifecycle"],
      owner_system: d.ownerSystem,
      createdAt: "",
      updatedAt: "",
    });
  }

  for (const d of docs) {
    for (const link of d.links) {
      const l: DefinitionLink = {
        sourceId: d.docId,
        targetId: link.target,
        linkType: link.type as DefinitionLink["linkType"],
      };
      (outgoingLinks.get(d.docId) ?? outgoingLinks.set(d.docId, []).get(d.docId)!).push(l);
      (incomingLinks.get(link.target) ?? incomingLinks.set(link.target, []).get(link.target)!).push(l);
    }
  }

  return {
    all: () => [...entries.values()],
    get: (id: string) => entries.get(id),
    getLinks: (id: string, direction = "both" as "outgoing" | "incoming" | "both") => {
      if (direction === "outgoing") return outgoingLinks.get(id) ?? [];
      if (direction === "incoming") return incomingLinks.get(id) ?? [];
      return [...(outgoingLinks.get(id) ?? []), ...(incomingLinks.get(id) ?? [])];
    },
  };
}

// ── smoke suite ─────────────────────────────────────────────

/**
 * Scenario A 검증 대상: deriveDomainRoot 가 **자기 자신으로 수렴** 하는 최상위 도메인 루트.
 *
 * df-system / ingest-system / decode-system 은 각각 상위 `depends_on` 체인으로
 * decision-standard-group / log-ingest-bridge / registry-system 으로 rollup 되므로
 * `audit --by-domain` 직접 buckets 에는 등장하지 않는다 — 하지만 Scenario B 의
 * topdown union 은 정상 작동한다 (member 링크는 있음).
 */
const CORE_DOMAIN_ROOTS = [
  "gate-system",
  "apm-system",
  "registry-system",
  "dkg-system",
  "storage-system",
] as const;

/**
 * Scenario B 검증 대상: `collectDomainMembers` (contains + depends_on/refines 역방향 union)
 * 가 ≥ 2 member 를 반환해야 하는 문서. 최상위 root 일 필요는 없다.
 */
const TOPDOWN_ROOTS = [
  "gate-system",
  "apm-system",
  "df-system",
  "ingest-system",
  "decode-system",
] as const;
const MIN_MEMBERS_PER_ROOT = 2;

const DOMAIN_ROOT_LIST_MIN = 3;
const RULE_MIN_COUNT = 8;

// 샘플 boundary 주석 검증 대상 (L4 round-trip)
const BOUNDARY_SAMPLES = [
  "packages/decode-service/src/server.ts",
  "packages/gate-service/src/server.ts",
  "packages/definition-service/src/main.ts",
] as const;

describe("workflow smoke — L3 layer regression sentinels", () => {
  let source: DefDataSource;

  beforeAll(async () => {
    source = await ensureDataSource();
  }, 30_000);

  describe("Scenario A — audit --by-domain 은 핵심 루트를 모두 보고한다", () => {
    it("핵심 도메인 루트가 deriveAllDomainRoots 결과에 등장하고 문서 수가 > 0", async () => {
      const registry = await buildRegistry(source);
      const rootMap = deriveAllDomainRoots(registry);
      const all = registry.all();
      const active = all.filter((d) => d.lifecycle !== "deprecated" && d.lifecycle !== "archived");

      // rootMap: docId → rootId. 루트별로 몇 개 문서가 매핑되는지 집계.
      const byRoot = new Map<string, number>();
      for (const d of active) {
        const root = rootMap.get(d.id) ?? d.id;
        byRoot.set(root, (byRoot.get(root) ?? 0) + 1);
      }

      const missing: string[] = [];
      const empty: string[] = [];
      for (const root of CORE_DOMAIN_ROOTS) {
        const count = byRoot.get(root);
        if (count === undefined) missing.push(root);
        else if (count <= 0) empty.push(`${root} (${count})`);
      }

      expect(
        missing,
        `audit --by-domain 에 누락된 핵심 루트: ${missing.join(", ")}. rootMap 크기=${byRoot.size}. ` +
          `이 루트들은 deriveDomainRoot/depends_on/refines 체인을 통해 자기 자신으로 해석되어야 한다.`,
      ).toEqual([]);
      expect(
        empty,
        `0 건만 매핑된 루트: ${empty.join(", ")}. 루트 자체는 존재하나 멤버 문서가 없음.`,
      ).toEqual([]);
    });
  });

  describe("Scenario B — topdown 은 핵심 루트에 ≥ 2 member 반환 (collectDomainMembers union)", () => {
    it.each(TOPDOWN_ROOTS)("%s 의 topdown union member 수가 ≥ 2", async (root) => {
      const parent = await source.get(root);
      expect(parent, `도메인 루트 문서 "${root}" 가 DB 에 없다.`).not.toBeNull();

      const members = await collectDomainMembers(source, root);
      expect(
        members.length,
        `collectDomainMembers("${root}") 가 ${members.length} member 반환 (≥ ${MIN_MEMBERS_PER_ROOT} 기대). ` +
          `contains 순방향 또는 depends_on/refines 역방향 중 하나는 존재해야 한다. ` +
          `Phase 3b Option B 류의 semantic 변경 후 workflow smoke 재실행이 누락된 신호일 수 있다.`,
      ).toBeGreaterThanOrEqual(MIN_MEMBERS_PER_ROOT);
    });
  });

  describe("Scenario C — domain-root 필터 리스팅", () => {
    it.each(["gate-system", "apm-system"] as const)(
      "list --domain-root=%s 가 ≥ 3 건 반환",
      async (root) => {
        const registry = await buildRegistry(source);
        const rootMap = deriveAllDomainRoots(registry);
        const all = await source.list({ limit: 100000 });
        const active = all.filter(
          (d) => d.lifecycle !== "deprecated" && d.lifecycle !== "archived",
        );
        const matched = active.filter((d) => (rootMap.get(d.docId) ?? d.docId) === root);

        expect(
          matched.length,
          `def list --domain-root=${root} 가 ${matched.length} 건 반환 (≥ ${DOMAIN_ROOT_LIST_MIN} 기대).`,
        ).toBeGreaterThanOrEqual(DOMAIN_ROOT_LIST_MIN);
      },
    );
  });

  describe("Scenario D — rule 확장자 필터", () => {
    it(`list --type=rule (ext=rule) 이 ≥ ${RULE_MIN_COUNT} 건 반환`, async () => {
      const docs = await source.list({ ext: "rule", limit: 1000 });
      expect(
        docs.length,
        `def list --type=rule 이 ${docs.length} 건 반환 (≥ ${RULE_MIN_COUNT} 기대). ` +
          `source_path LIKE '%.rule.md' 필터 (DefListFilter.ext) 가 작동하지 않거나 rule 문서가 삭제된 상태.`,
      ).toBeGreaterThanOrEqual(RULE_MIN_COUNT);
    });
  });

  describe("Scenario E — boundary annotation round-trip (L4 round-trip)", () => {
    it.each(BOUNDARY_SAMPLES)(
      "%s 의 boundary 타깃이 DB 에 존재하고 deprecated 가 아님",
      async (relPath) => {
        const absPath = join(ROOT, relPath);
        expect(existsSync(absPath), `샘플 소스 파일이 없음: ${absPath}`).toBe(true);

        const resolution = await source.resolveByFile(absPath);
        expect(
          resolution.kind,
          `${relPath}: resolveByFile 결과가 "none" — @def.boundary 주석이 없거나 DB code_references 가 비어있음.`,
        ).not.toBe("none");

        if (resolution.kind === "unique") {
          const anchor = resolution.anchor;
          expect(
            anchor,
            `${relPath}: unique boundary anchor 가 비었다.`,
          ).toBeTruthy();
          expect(
            anchor.lifecycle,
            `${relPath}: boundary 타깃 "${anchor.docId}" 이 lifecycle=${anchor.lifecycle} — ` +
              `approved 로 재지정하거나 소스 주석을 현재 권위 문서로 갱신 필요.`,
          ).not.toBe("deprecated");
          expect(anchor.lifecycle).not.toBe("archived");
        }
      },
    );
  });
});
