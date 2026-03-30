import { describe, it, expect } from "vitest";
import { parseEvidenceItems } from "./contract-evidence.js";

describe("parseEvidenceItems", () => {
  it("reversible 어노테이션 파싱", () => {
    const body = "- 입력 정규화 로그 [reversible]\n- 재고 검증 결과 [reversible]";
    const items = parseEvidenceItems(body, "test-doc");
    expect(items).toHaveLength(2);
    expect(items[0].reversibility).toBe("reversible");
    expect(items[0].description).toBe("입력 정규화 로그");
    expect(items[0].sourceId).toBe("test-doc");
  });

  it("irreversible 어노테이션 파싱", () => {
    const body = "- 최종 verdict 판정 [irreversible]";
    const items = parseEvidenceItems(body, "test-doc");
    expect(items[0].reversibility).toBe("irreversible");
  });

  it("어노테이션 없으면 null", () => {
    const body = "- 처리 시간";
    const items = parseEvidenceItems(body, "test-doc");
    expect(items[0].reversibility).toBeNull();
    expect(items[0].description).toBe("처리 시간");
  });

  it("불릿 아닌 줄은 무시", () => {
    const body = "설명 텍스트\n- 항목 1\n일반 텍스트\n* 항목 2";
    const items = parseEvidenceItems(body, "doc");
    expect(items).toHaveLength(2);
  });

  it("빈 본문이면 빈 배열", () => {
    expect(parseEvidenceItems("", "doc")).toHaveLength(0);
  });
});
