// @def.boundary observability-system-root
// @def.doc observability-system-root

import { describe, it, expect } from "vitest";
import { buildSqlComment, buildSqlCommentWithTrace, sqlComment } from "./sqlcommenter.js";

describe("buildSqlComment", () => {
  it("단일 태그를 key='value' 형식으로 생성한다", () => {
    const result = buildSqlComment({ service: "ingest" });
    expect(result).toBe("service='ingest'");
  });

  it("복수 태그를 쉼표로 구분한다", () => {
    const result = buildSqlComment({ service: "ingest", action: "insert" });
    expect(result).toBe("service='ingest',action='insert'");
  });

  it("빈 객체는 빈 문자열을 반환한다", () => {
    expect(buildSqlComment({})).toBe("");
  });

  it("작은따옴표가 포함된 값을 이스케이프한다", () => {
    const result = buildSqlComment({ query: "it's a test" });
    expect(result).toBe("query='it\\'s a test'");
  });
});

describe("buildSqlCommentWithTrace", () => {
  it("OTel 미초기화 시 커스텀 태그만 포함한다", () => {
    const result = buildSqlCommentWithTrace({ adapter: "Record", method: "find" });
    expect(result).toContain("adapter='Record'");
    expect(result).toContain("method='find'");
    // no-op tracer이므로 traceparent 없음
    expect(result).not.toContain("traceparent");
  });
});

describe("sqlComment", () => {
  it("adapter와 method를 포함한 sqlcommenter 문자열을 반환한다", () => {
    const result = sqlComment("RecordStore", "findByTraceId");
    expect(result).toContain("adapter='RecordStore'");
    expect(result).toContain("method='findByTraceId'");
  });
});
