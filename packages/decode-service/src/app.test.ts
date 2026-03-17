import { describe, it, expect, beforeAll } from "vitest";
import { createApp } from "./app.js";
import { DecoderPool } from "./lib/decoder-pool.js";
import type { DecodeMap } from "index-meta";

// ── 테스트 데이터 ──────────────────────────────────────────────────────────────

const permMap: DecodeMap = {
  indexId: "perm",
  versionId: "v1",
  shape: [3, 4],
  size: 12,
  dims: [
    {
      dimId: "role",
      snapshotId: "s1",
      kind: { type: "string_enum" },
      entries: ["admin", "editor", "viewer"],
    },
    {
      dimId: "action",
      snapshotId: "s1",
      kind: { type: "string_enum" },
      entries: ["create", "read", "update", "delete"],
    },
  ],
};

const articleMap: DecodeMap = {
  indexId: "article",
  versionId: "v1",
  shape: [3, 2],
  size: 6,
  dims: [
    {
      dimId: "quality",
      snapshotId: "s1",
      kind: { type: "index_ref", indexId: "perm" },
      entries: [0, 1, 2],
    },
    {
      dimId: "priority",
      snapshotId: "s1",
      kind: { type: "string_enum" },
      entries: ["high", "low"],
    },
  ],
};

// index_ref가 없는 단순 index
const simpleMap: DecodeMap = {
  indexId: "tag",
  versionId: "v1",
  shape: [4],
  size: 4,
  dims: [
    {
      dimId: "name",
      snapshotId: "s1",
      kind: { type: "string_enum" },
      entries: ["news", "tech", "sports", "art"],
    },
  ],
};

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function createTestApp() {
  const pool = new DecoderPool(0);
  pool.load({ map: permMap });
  pool.load({ map: articleMap, refs: { perm: permMap } });
  pool.load({ map: simpleMap });
  const app = createApp({ pool });
  return { app, pool };
}

function req(app: ReturnType<typeof createApp>, method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return app.request(path, init);
}

// ── 테스트 ─────────────────────────────────────────────────────────────────────

describe("decode-service", () => {
  let app: ReturnType<typeof createApp>;
  let pool: DecoderPool;

  beforeAll(() => {
    ({ app, pool } = createTestApp());
  });

  // ── health ────────────────────────────────────────────────────────────────

  describe("GET /health", () => {
    it("상태와 로드된 decoder 수 반환", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.decoders_loaded).toBe(3);
    });
  });

  // ── POST /decode ──────────────────────────────────────────────────────────

  describe("POST /decode", () => {
    it("숫자 입력 + prefix/version → entity 반환", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 0,
        prefix: "perm",
        version: "v1",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.indexId).toBe("perm");
      expect(json.versionId).toBe("v1");
      expect(json.value).toBe(0);
      expect(json.entities).toEqual({ role: "admin", action: "create" });
    });

    it("마지막 주소 (경계값) decode", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 11, // size=12 → 마지막 유효 value
        prefix: "perm",
        version: "v1",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.entities).toEqual({ role: "viewer", action: "delete" });
    });

    it("string 입력 + prefix/version → 직접 조회", async () => {
      // PrefixDecoder.resolve(string)은 APM이 없으면 기본 프로토콜(colon 등)로 시도
      // 여기서는 number로 래핑된 string 대신, prefix/version 명시 경로만 테스트
      const res = await req(app, "POST", "/decode", {
        input: 5,
        prefix: "perm",
        version: "v1",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.entities).toEqual({ role: "editor", action: "read" });
    });

    it("숫자 입력 + prefix/version 모두 누락 → 400", async () => {
      const res = await req(app, "POST", "/decode", { input: 0 });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("INVALID_INPUT");
      expect(json.error.message).toContain("prefix and version are required");
    });

    it("prefix만 있고 version 누락 → 400", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 0,
        prefix: "perm",
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("INVALID_INPUT");
      expect(json.error.message).toContain("both prefix and version");
    });

    it("version만 있고 prefix 누락 → 400", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 0,
        version: "v1",
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("INVALID_INPUT");
    });

    it("미등록 prefix → 404", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 0,
        prefix: "unknown",
        version: "v1",
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("DECODER_NOT_LOADED");
    });

    it("범위 초과 value → 에러 (index-meta IndexRangeError)", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 9999,
        prefix: "perm",
        version: "v1",
      });
      // IndexRangeError는 IndexMetaError 하위가 아닌 weighted-index 에러 → 500
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });

    it("잘못된 JSON body → 400", async () => {
      const res = await app.request("/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("필수 필드(input) 누락 → 400 (Zod)", async () => {
      const res = await req(app, "POST", "/decode", {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("INVALID_INPUT");
    });
  });

  // ── POST /decode/batch ────────────────────────────────────────────────────

  describe("POST /decode/batch", () => {
    it("복수 입력 일괄 decode", async () => {
      const res = await req(app, "POST", "/decode/batch", {
        prefix: "perm",
        version: "v1",
        inputs: [0, 1, 4],
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results).toHaveLength(3);
      expect(json.results[0].entities).toEqual({ role: "admin", action: "create" });
      expect(json.results[1].entities).toEqual({ role: "admin", action: "read" });
      expect(json.results[2].entities).toEqual({ role: "editor", action: "create" });
    });

    it("단일 입력 batch", async () => {
      const res = await req(app, "POST", "/decode/batch", {
        prefix: "perm",
        version: "v1",
        inputs: [11],
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results).toHaveLength(1);
      expect(json.results[0].value).toBe(11);
    });

    it("빈 inputs → 400 (min 1)", async () => {
      const res = await req(app, "POST", "/decode/batch", {
        prefix: "perm",
        version: "v1",
        inputs: [],
      });
      expect(res.status).toBe(400);
    });

    it("미등록 prefix → 404", async () => {
      const res = await req(app, "POST", "/decode/batch", {
        prefix: "missing",
        version: "v1",
        inputs: [0],
      });
      expect(res.status).toBe(404);
    });

    it("prefix 누락 → 400 (Zod required)", async () => {
      const res = await req(app, "POST", "/decode/batch", {
        version: "v1",
        inputs: [0],
      });
      expect(res.status).toBe(400);
    });

    it("batch 내 범위 초과 value → 에러", async () => {
      const res = await req(app, "POST", "/decode/batch", {
        prefix: "perm",
        version: "v1",
        inputs: [0, 9999],
      });
      expect(res.status).toBe(500);
    });
  });

  // ── POST /decode/deep ─────────────────────────────────────────────────────

  describe("POST /decode/deep", () => {
    it("index_ref dim 확장 (refs 로드된 경우)", async () => {
      const res = await req(app, "POST", "/decode/deep", {
        input: 0,
        prefix: "article",
        version: "v1",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.entities.quality).toBe(0);
      expect(json.entities.priority).toBe("high");
      expect(json.refs.quality).toEqual({ role: "admin", action: "create" });
      // 모든 ref가 해석됨 → unresolved 키 없어야 함
      expect(json.unresolved).toBeUndefined();
    });

    it("index_ref가 없는 단순 index → refs 빈 객체", async () => {
      const res = await req(app, "POST", "/decode/deep", {
        input: 2,
        prefix: "tag",
        version: "v1",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.entities).toEqual({ name: "sports" });
      expect(json.refs).toEqual({});
      expect(json.unresolved).toBeUndefined();
    });

    it("ref 코덱 없으면 unresolved 표시", async () => {
      const noRefPool = new DecoderPool(0);
      noRefPool.load({ map: articleMap }); // refs 없이
      const noRefApp = createApp({ pool: noRefPool });

      const res = await req(noRefApp, "POST", "/decode/deep", {
        input: 0,
        prefix: "article",
        version: "v1",
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.unresolved).toEqual(["quality"]);
      // refs는 빈 객체 (해석 불가)
      expect(json.refs).toEqual({});
    });

    it("미등록 prefix → 404", async () => {
      const res = await req(app, "POST", "/decode/deep", {
        input: 0,
        prefix: "missing",
        version: "v1",
      });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /decode-map/:prefix/:version ──────────────────────────────────────

  describe("GET /decode-map/:prefix/:version", () => {
    it("DecodeMap 반환", async () => {
      const res = await app.request("/decode-map/perm/v1");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.indexId).toBe("perm");
      expect(json.versionId).toBe("v1");
      expect(json.shape).toEqual([3, 4]);
      expect(json.size).toBe(12);
      expect(json.dims).toHaveLength(2);
      expect(json.dims[0].dimId).toBe("role");
      expect(json.dims[0].entries).toEqual(["admin", "editor", "viewer"]);
    });

    it("미등록 → 404", async () => {
      const res = await app.request("/decode-map/missing/v1");
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("DECODER_NOT_LOADED");
    });
  });

  // ── resolveDecoder 경로 ───────────────────────────────────────────────────

  describe("resolveDecoder 분기", () => {
    it("string 입력 + prefix/version 모두 없음 + 감지 불가 → 404", async () => {
      const res = await req(app, "POST", "/decode", {
        input: "totally-unknown-format-xyz",
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("NOT_FOUND");
      expect(json.error.message).toContain("no decoder could detect");
    });

    it("number 입력 + prefix만 → 400 (불완전)", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 0,
        prefix: "perm",
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("both prefix and version");
    });

    it("number 입력 + version만 → 400 (불완전)", async () => {
      const res = await req(app, "POST", "/decode", {
        input: 0,
        version: "v1",
      });
      expect(res.status).toBe(400);
    });
  });

  // ── 미들웨어 ──────────────────────────────────────────────────────────────

  describe("middleware", () => {
    it("x-request-id 응답 헤더 자동 생성", async () => {
      const res = await app.request("/health");
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });

    it("x-request-id 전달 시 그대로 반환", async () => {
      const res = await app.request("/health", {
        headers: { "x-request-id": "test-req-123" },
      });
      expect(res.headers.get("x-request-id")).toBe("test-req-123");
    });
  });

  // ── 에러 응답 포맷 ────────────────────────────────────────────────────────

  describe("에러 응답 포맷", () => {
    it("모든 에러는 { error: { code, message } } 구조", async () => {
      // Zod 에러
      const zodRes = await req(app, "POST", "/decode", {});
      expect(zodRes.status).toBe(400);
      const zodJson = await zodRes.json();
      expect(zodJson).toHaveProperty("error.code");
      expect(zodJson).toHaveProperty("error.message");

      // AppError
      const appRes = await req(app, "POST", "/decode", {
        input: 0,
        prefix: "missing",
        version: "v1",
      });
      expect(appRes.status).toBe(404);
      const appJson = await appRes.json();
      expect(appJson).toHaveProperty("error.code");
      expect(appJson).toHaveProperty("error.message");
    });
  });

  // ── DecoderPool ───────────────────────────────────────────────────────────

  describe("DecoderPool", () => {
    it("load → get 왕복", () => {
      const p = new DecoderPool(0);
      const decoder = p.load({ map: permMap });
      expect(decoder.indexId).toBe("perm");
      expect(p.get("perm", "v1")).toBe(decoder);
    });

    it("loadMap (refs 없이 간편 등록)", () => {
      const p = new DecoderPool(0);
      const decoder = p.loadMap(permMap);
      expect(decoder.indexId).toBe("perm");
      expect(p.get("perm", "v1")).toBe(decoder);
    });

    it("미등록 key → null", () => {
      const p = new DecoderPool(0);
      expect(p.get("no", "exist")).toBeNull();
    });

    it("TTL 만료 시 null 반환", async () => {
      const shortPool = new DecoderPool(1); // 1ms TTL
      shortPool.load({ map: permMap });
      expect(shortPool.get("perm", "v1")).not.toBeNull();

      await new Promise((r) => setTimeout(r, 10));
      expect(shortPool.get("perm", "v1")).toBeNull();
    });

    it("TTL=0 → 만료 없음", () => {
      const p = new DecoderPool(0);
      p.load({ map: permMap });
      // TTL=0이면 만료 체크 안 함
      expect(p.get("perm", "v1")).not.toBeNull();
    });

    it("같은 key 재등록 시 덮어쓰기", () => {
      const p = new DecoderPool(0);
      p.load({ map: permMap });
      expect(p.size).toBe(1);
      // 같은 indexId/versionId로 다시 로드
      p.load({ map: permMap });
      expect(p.size).toBe(1);
    });

    it("evict", () => {
      const p = new DecoderPool(0);
      p.load({ map: permMap });
      expect(p.evict("perm", "v1")).toBe(true);
      expect(p.size).toBe(0);
      // 이미 없는 것 evict
      expect(p.evict("perm", "v1")).toBe(false);
    });

    it("clear", () => {
      const p = new DecoderPool(0);
      p.load({ map: permMap });
      p.load({ map: articleMap });
      expect(p.size).toBe(2);
      p.clear();
      expect(p.size).toBe(0);
    });

    it("keys", () => {
      const p = new DecoderPool(0);
      p.load({ map: permMap });
      p.load({ map: articleMap });
      expect(p.keys().sort()).toEqual(["article:v1", "perm:v1"]);
    });

    it("values — TTL 만료 항목 자동 제거", async () => {
      const p = new DecoderPool(1);
      p.load({ map: permMap });
      p.load({ map: simpleMap });

      await new Promise((r) => setTimeout(r, 10));

      const vals = [...p.values()];
      expect(vals).toHaveLength(0);
      expect(p.size).toBe(0); // 만료 항목 정리됨
    });
  });
});
