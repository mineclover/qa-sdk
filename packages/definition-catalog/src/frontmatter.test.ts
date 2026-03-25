import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  extractFrontmatter,
  parseYaml,
  extractDef,
  parseDocument,
  scanAndBuild,
  computeAllConcerns,
} from "./frontmatter.js";

// ─── extractFrontmatter ──────────────────────────────────

describe("extractFrontmatter", () => {
  it("YAML frontmatter를 추출한다", () => {
    const content = `---
def:
  id: test
  scope: ui
---
# Title
Body text`;

    const result = extractFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.yaml).toContain("id: test");
    expect(result!.body).toContain("# Title");
  });

  it("frontmatter가 없으면 null", () => {
    expect(extractFrontmatter("# No frontmatter")).toBeNull();
    expect(extractFrontmatter("just text")).toBeNull();
  });

  it("빈 frontmatter도 추출", () => {
    const result = extractFrontmatter("---\n---\nBody");
    expect(result).not.toBeNull();
    expect(result!.yaml).toBe("");
    expect(result!.body).toBe("Body");
  });
});

// ─── parseYaml ───────────────────────────────────────────

describe("parseYaml", () => {
  it("최상위 스칼라", () => {
    const result = parseYaml("title: hello\ncount: 42\nactive: true");
    expect(result.title).toBe("hello");
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it("1단계 중첩 객체", () => {
    const result = parseYaml(`def:
  id: test
  scope: ui
  aspect: component`);
    expect(result.def).toBeDefined();
    const def = result.def as Record<string, unknown>;
    expect(def.id).toBe("test");
    expect(def.scope).toBe("ui");
    expect(def.aspect).toBe("component");
  });

  it("인라인 배열", () => {
    const result = parseYaml(`def:
  id: test
  tags: [security, performance]`);
    const def = result.def as Record<string, unknown>;
    expect(def.tags).toEqual(["security", "performance"]);
  });

  it("블록 시퀀스 (links)", () => {
    const result = parseYaml(`def:
  id: test
  links:
    - target: other-doc
      type: depends_on
    - target: another
      type: refines`);
    const def = result.def as Record<string, unknown>;
    const links = def.links as Record<string, string>[];
    expect(links.length).toBe(2);
    expect(links[0].target).toBe("other-doc");
    expect(links[0].type).toBe("depends_on");
    expect(links[1].target).toBe("another");
    expect(links[1].type).toBe("refines");
  });

  it("주석과 빈 줄 무시", () => {
    const result = parseYaml(`# 주석
def:
  id: test

  scope: ui`);
    const def = result.def as Record<string, unknown>;
    expect(def.id).toBe("test");
    expect(def.scope).toBe("ui");
  });
});

// ─── extractDef ──────────────────────────────────────────

describe("extractDef", () => {
  it("유효한 def 블록을 추출한다", () => {
    const parsed = parseYaml(`def:
  id: gate-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [security]`);
    const def = extractDef(parsed, "test.md");
    expect(def.id).toBe("gate-api");
    expect(def.scope).toBe("interface");
    expect(def.tags).toEqual(["security"]);
  });

  it("lifecycle 기본값은 draft", () => {
    const parsed = parseYaml(`def:
  id: new-doc
  scope: ui
  aspect: layout
  depth: overview`);
    const def = extractDef(parsed, "test.md");
    expect(def.lifecycle).toBe("draft");
  });

  it("links를 파싱한다", () => {
    const parsed = parseYaml(`def:
  id: api
  scope: interface
  aspect: api_contract
  depth: specification
  links:
    - target: engine
      type: depends_on`);
    const def = extractDef(parsed, "test.md");
    expect(def.links!.length).toBe(1);
    expect(def.links![0]).toEqual({ target: "engine", type: "depends_on" });
  });

  it("def 블록 없으면 에러", () => {
    expect(() => extractDef({}, "test.md")).toThrow("def");
  });

  it("무효한 scope-aspect 조합이면 에러", () => {
    const parsed = parseYaml(`def:
  id: bad
  scope: ui
  aspect: domain_data
  depth: overview`);
    expect(() => extractDef(parsed, "test.md")).toThrow("유효하지 않음");
  });
});

// ─── parseDocument ───────────────────────────────────────

describe("parseDocument", () => {
  it("전체 문서를 파싱한다", () => {
    const content = `---
def:
  id: component-spec
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  tags: [accessibility]
---
# 컴포넌트 명세

본문 내용`;

    const doc = parseDocument(content, "docs/specs/ui/component.md");
    expect(doc.def.id).toBe("component-spec");
    expect(doc.def.scope).toBe("ui");
    expect(doc.def.tags).toEqual(["accessibility"]);
    expect(doc.filePath).toBe("docs/specs/ui/component.md");
    expect(doc.body).toContain("# 컴포넌트 명세");
  });
});

// ─── scanAndBuild (파일 시스템 통합) ─────────────────────

describe("scanAndBuild", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "def-catalog-test-"));

    // 디렉토리 구조
    await mkdir(join(tmpDir, "docs/specs/services"), { recursive: true });
    await mkdir(join(tmpDir, "docs/specs/data"), { recursive: true });

    // 문서 1: gate service
    await writeFile(join(tmpDir, "docs/specs/services/gate.md"), `---
def:
  id: gate-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [security]
  links:
    - target: record-spec
      type: depends_on
---
# Gate Service

Gate 서비스 명세.
`);

    // 문서 2: record schema
    await writeFile(join(tmpDir, "docs/specs/data/record.md"), `---
def:
  id: record-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [migration]
---
# EventRecord + RecordStore

이벤트 레코드 스키마.
`);

    // 문서 3: frontmatter 없는 파일 (건너뜀)
    await writeFile(join(tmpDir, "docs/specs/services/readme.md"), `# README
이 디렉토리는 서비스 스펙을 포함합니다.
`);

    // 문서 4: 잘못된 frontmatter (에러 수집)
    await writeFile(join(tmpDir, "docs/specs/data/bad.md"), `---
def:
  id: bad-doc
  scope: ui
  aspect: domain_data
  depth: overview
---
# Bad Doc
`);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("디렉토리를 스캔하여 registry를 자동 구성한다", async () => {
    const result = await scanAndBuild(tmpDir, [join(tmpDir, "docs")]);

    // 유효한 2건 등록
    expect(result.registered).toBe(2);

    // link 1건 연결
    expect(result.linked).toBe(1);

    // 에러 1건 (bad.md의 scope-aspect 불일치)
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].error).toContain("유효하지 않음");

    // registry 검증
    const gate = result.registry.get("gate-spec");
    expect(gate).toBeDefined();
    expect(gate!.scope).toBe("interface");
    expect(gate!.tags).toEqual(["security"]);
    expect(gate!.ref).toBe("docs/specs/services/gate.md");
    expect(gate!.title).toBe("Gate Service");

    const record = result.registry.get("record-spec");
    expect(record).toBeDefined();
    expect(record!.scope).toBe("data");

    // 관계 검증
    const links = result.registry.getLinks("gate-spec", "outgoing");
    expect(links.length).toBe(1);
    expect(links[0].targetId).toBe("record-spec");
    expect(links[0].linkType).toBe("depends_on");
  });

  it("concern 전파가 동작한다", async () => {
    const result = await scanAndBuild(tmpDir, [join(tmpDir, "docs")]);
    const concerns = computeAllConcerns(result.registry);

    // gate-spec: security 직접 + migration 상속 (depends_on record-spec)
    const gateConcerns = concerns.get("gate-spec")!;
    expect(gateConcerns.direct).toContain("security");
    expect(gateConcerns.all).toContain("migration");
    expect(gateConcerns.inherited.some(i =>
      i.concern === "migration" && i.from === "record-spec",
    )).toBe(true);

    // record-spec: migration 직접
    const recordConcerns = concerns.get("record-spec")!;
    expect(recordConcerns.direct).toContain("migration");
    expect(recordConcerns.inherited.length).toBe(0);
  });
});
