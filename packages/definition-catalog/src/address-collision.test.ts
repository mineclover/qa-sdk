/**
 * 주소 충돌 진단 → 해결 검증 테스트
 *
 * 같은 scope×aspect×depth인 문서 여러 건이 같은 좌표를 공유할 때,
 * addressIndex가 모든 문서를 정확히 관리하는지 확인.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryDefinitionRegistry } from "./registry.js";
import type { DefinitionEntryInput } from "./types.js";

const NOW = "2026-03-25T10:00:00Z";

function doc(id: string, title: string): DefinitionEntryInput {
  return {
    id, title,
    scope: "interface", aspect: "api_contract", depth: "specification",
    lifecycle: "approved", createdAt: NOW, updatedAt: NOW,
  };
}

describe("같은 scope×aspect×depth 문서 주소 관리", () => {
  let reg: MemoryDefinitionRegistry;

  beforeEach(() => {
    reg = new MemoryDefinitionRegistry();
  });

  it("같은 유형의 문서 3건은 모두 같은 address를 받는다", () => {
    const a = reg.register(doc("gate-api", "Gate Service API"));
    const b = reg.register(doc("decode-api", "Decode Service API"));
    const c = reg.register(doc("query-api", "Query API"));

    expect(a.address).toBe(b.address);
    expect(b.address).toBe(c.address);
  });

  it("findByAddress는 같은 주소의 모든 문서를 반환한다", () => {
    reg.register(doc("gate-api", "Gate Service API"));
    reg.register(doc("decode-api", "Decode Service API"));
    reg.register(doc("query-api", "Query API"));

    const found = reg.findByAddress(reg.get("gate-api")!.address!);
    expect(found.length).toBe(3);
    expect(found.map(e => e.id).sort()).toEqual(["decode-api", "gate-api", "query-api"]);
  });

  it("1건 삭제 후에도 나머지 문서를 주소로 찾을 수 있다", () => {
    reg.register(doc("gate-api", "Gate Service API"));
    reg.register(doc("decode-api", "Decode Service API"));
    reg.register(doc("query-api", "Query API"));

    const addr = reg.get("gate-api")!.address!;

    reg.remove("gate-api");
    const remaining = reg.findByAddress(addr);
    expect(remaining.length).toBe(2);
    expect(remaining.map(e => e.id).sort()).toEqual(["decode-api", "query-api"]);
  });

  it("전부 삭제하면 빈 배열", () => {
    const a = reg.register(doc("gate-api", "Gate Service API"));
    reg.register(doc("decode-api", "Decode Service API"));
    const addr = a.address!;

    reg.remove("gate-api");
    reg.remove("decode-api");
    expect(reg.findByAddress(addr)).toEqual([]);
  });

  it("depth 변경 시 이전 주소 그룹에서 제거되고 새 주소 그룹에 추가된다", () => {
    reg.register(doc("gate-api", "Gate Service API"));
    reg.register(doc("decode-api", "Decode Service API"));

    const oldAddr = reg.get("gate-api")!.address!;

    // gate-api만 depth를 overview로 변경 → 새 주소
    reg.update("gate-api", { depth: "overview" });
    const newAddr = reg.get("gate-api")!.address!;
    expect(newAddr).not.toBe(oldAddr);

    // 이전 주소에는 decode-api만 남아있다
    const oldGroup = reg.findByAddress(oldAddr);
    expect(oldGroup.length).toBe(1);
    expect(oldGroup[0].id).toBe("decode-api");

    // 새 주소에는 gate-api만
    const newGroup = reg.findByAddress(newAddr);
    expect(newGroup.length).toBe(1);
    expect(newGroup[0].id).toBe("gate-api");
  });
});
