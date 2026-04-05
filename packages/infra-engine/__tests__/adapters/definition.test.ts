import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDefinitionAdapter } from "../../src/adapters/definition.js";

describe("DefinitionAdapter", () => {
  const BASE_URL = "http://localhost:3700";
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  describe("getServiceDocs", () => {
    it("서비스별 문서 요약을 lifecycle/layer별로 집계", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 3,
          docs: [
            { docId: "doc-1", title: "인증 스펙", lifecycle: "implemented", layer: "domain", scope: "auth" },
            { docId: "doc-2", title: "캐시 설계", lifecycle: "approved", layer: "operation", scope: "cache" },
            { docId: "doc-3", title: "API 초안", lifecycle: "implemented", layer: "domain", scope: "api" },
          ],
        }),
      });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getServiceDocs("ingest-server");

      expect(result.serviceId).toBe("ingest-server");
      expect(result.totalDocs).toBe(3);
      expect(result.byLifecycle).toEqual({ implemented: 2, approved: 1 });
      expect(result.byLayer).toEqual({ domain: 2, operation: 1 });
      expect(result.docs).toHaveLength(3);
      expect(result.docs[0]).toEqual({
        docId: "doc-1",
        title: "인증 스펙",
        lifecycle: "implemented",
        layer: "domain",
        scope: "auth",
      });

      // URL 검증
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/docs?svc=ingest-server&limit=200`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("누락 필드는 unknown으로 대체", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          docs: [{ docId: "doc-x" }],
        }),
      });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getServiceDocs("test-svc");

      expect(result.byLifecycle).toEqual({ unknown: 1 });
      expect(result.byLayer).toEqual({ unknown: 1 });
      expect(result.docs[0].title).toBe("doc-x");
      expect(result.docs[0].lifecycle).toBe("unknown");
    });

    it("HTTP 에러 시 예외 발생", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });

      const adapter = createDefinitionAdapter(BASE_URL);
      await expect(adapter.getServiceDocs("bad-svc")).rejects.toThrow(
        "definition-service 조회 실패 (500)",
      );
    });
  });

  describe("getServiceTestHealth", () => {
    it("문서별 테스트 상태를 집계", async () => {
      // 첫 호출: 문서 목록
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          docs: [{ docId: "doc-1" }, { docId: "doc-2" }],
        }),
      });
      // doc-1 테스트 상태
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ passed: 5, failed: 0, healthy: true }),
      });
      // doc-2 테스트 상태
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ passed: 3, failed: 1, healthy: false }),
      });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getServiceTestHealth("test-svc");

      expect(result.serviceId).toBe("test-svc");
      expect(result.totalTests).toBe(9); // 5+3+1
      expect(result.passRate).toBe(89); // Math.round(8/9 * 100)
      expect(result.healthy).toBe(false); // failed > 0
    });

    it("테스트 없는 문서는 무시", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [{ docId: "doc-no-test" }] }),
      });
      // 테스트 조회 실패
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getServiceTestHealth("test-svc");

      expect(result.totalTests).toBe(0);
      expect(result.passRate).toBe(0);
      expect(result.healthy).toBe(false); // totalTests === 0 → not healthy
    });

    it("모든 테스트 통과 시 healthy", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [{ docId: "doc-1" }] }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ passed: 10, failed: 0, healthy: true }),
      });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getServiceTestHealth("test-svc");

      expect(result.healthy).toBe(true);
      expect(result.passRate).toBe(100);
    });
  });

  describe("getPrefixInfo", () => {
    it("prefix 상세 조회 성공", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          prefixId: "pipeline_point",
          name: "파이프라인 지점",
          category: "observation",
          labels: ["svc_ref", "pipeline_stage"],
          description: "파이프라인 실행 지점 추적",
        }),
      });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getPrefixInfo("pipeline_point");

      expect(result).toEqual({
        prefixId: "pipeline_point",
        name: "파이프라인 지점",
        category: "observation",
        labels: ["svc_ref", "pipeline_stage"],
        description: "파이프라인 실행 지점 추적",
      });
    });

    it("존재하지 않는 prefix → null", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getPrefixInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("누락 필드 기본값 적용", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ prefixId: "minimal" }),
      });

      const adapter = createDefinitionAdapter(BASE_URL);
      const result = await adapter.getPrefixInfo("minimal");

      expect(result).toEqual({
        prefixId: "minimal",
        name: "minimal",
        category: "unknown",
        labels: [],
        description: "",
      });
    });
  });

  describe("getOwnedPrefixDetails", () => {
    it("여러 prefix 순차 조회", async () => {
      // prefix-a 성공
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          prefixId: "prefix-a",
          name: "A",
          category: "core",
          labels: [],
          description: "desc-a",
        }),
      });
      // prefix-b 실패 (404)
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 });
      // prefix-c 성공
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          prefixId: "prefix-c",
          name: "C",
          category: "tracking",
          labels: ["tag"],
          description: "desc-c",
        }),
      });

      const adapter = createDefinitionAdapter(BASE_URL);
      const results = await adapter.getOwnedPrefixDetails(["prefix-a", "prefix-b", "prefix-c"]);

      // prefix-b는 null이므로 제외
      expect(results).toHaveLength(2);
      expect(results[0].prefixId).toBe("prefix-a");
      expect(results[1].prefixId).toBe("prefix-c");
    });

    it("빈 배열 → 빈 결과", async () => {
      const adapter = createDefinitionAdapter(BASE_URL);
      const results = await adapter.getOwnedPrefixDetails([]);
      expect(results).toEqual([]);
    });
  });
});
