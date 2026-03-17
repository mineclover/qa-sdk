import { describe, it, expect } from "vitest";
import { TernaryMask, ALLOW, DENY, UNSET } from "./ternary-mask.js";

describe("TernaryMask", () => {
  it("기본 상태 = 전체 UNSET", () => {
    const m = new TernaryMask(10);
    expect(m.unsetCount).toBe(10);
    expect(m.allowCount).toBe(0);
    expect(m.denyCount).toBe(0);
    for (let i = 0; i < 10; i++) expect(m.get(i)).toBe(UNSET);
  });

  it("allow / deny / unset 전환", () => {
    const m = new TernaryMask(8);
    m.allow(3);
    expect(m.get(3)).toBe(ALLOW);
    m.deny(3);
    expect(m.get(3)).toBe(DENY);
    m.unset(3);
    expect(m.get(3)).toBe(UNSET);
  });

  it("deny-wins: allow + deny 동시 설정 → deny", () => {
    const m = new TernaryMask(8);
    // 직접 비트 세팅으로 충돌 상태 생성
    m.allow(0);
    // denyMask에도 직접 set (내부 조작)
    m.denyMask[0] |= 1;
    expect(m.get(0)).toBe(DENY); // deny-wins
  });

  it("check — UNSET + default policy", () => {
    const m = new TernaryMask(4);
    m.allow(0);
    m.deny(1);
    // id=2 is UNSET
    expect(m.check(0, "deny")).toBe(true);
    expect(m.check(1, "deny")).toBe(false);
    expect(m.check(2, "deny")).toBe(false);  // UNSET + default-deny
    expect(m.check(2, "allow")).toBe(true);   // UNSET + default-allow
  });

  it("통계", () => {
    const m = new TernaryMask(10);
    m.allow(0); m.allow(1); m.allow(2);
    m.deny(5); m.deny(6);
    expect(m.allowCount).toBe(3);
    expect(m.denyCount).toBe(2);
    expect(m.unsetCount).toBe(5);
  });
});

describe("TernaryMask.inherit", () => {
  it("child UNSET → parent 상속", () => {
    const parent = new TernaryMask(4);
    parent.allow(0);
    parent.deny(1);

    const child = new TernaryMask(4);
    // child는 전부 UNSET

    const merged = TernaryMask.inherit(parent, child);
    expect(merged.get(0)).toBe(ALLOW);  // parent에서 상속
    expect(merged.get(1)).toBe(DENY);   // parent에서 상속
    expect(merged.get(2)).toBe(UNSET);  // 둘 다 UNSET
  });

  it("child 명시적 → parent override", () => {
    const parent = new TernaryMask(4);
    parent.allow(0);
    parent.deny(1);

    const child = new TernaryMask(4);
    child.deny(0);   // parent allow를 child deny로 override
    child.allow(1);  // parent deny인데 child allow... → deny-wins

    const merged = TernaryMask.inherit(parent, child);
    expect(merged.get(0)).toBe(DENY);  // child deny → deny
    expect(merged.get(1)).toBe(DENY);  // deny-wins: parent deny 존재
  });

  it("deny-wins 비활성 시 child 우선", () => {
    const parent = new TernaryMask(4);
    parent.deny(0);

    const child = new TernaryMask(4);
    child.allow(0);

    const merged = TernaryMask.inherit(parent, child, { denyWins: false });
    expect(merged.get(0)).toBe(ALLOW); // child 우선
  });

  it("3단계 상속 체인: org → team → user", () => {
    const org = new TernaryMask(6);
    org.allow(0); org.allow(1); org.allow(2); // 기본 허용 3개
    org.deny(5);  // config 명시적 거부

    const team = new TernaryMask(6);
    team.deny(2);  // team에서 payments 거부
    // 나머지는 UNSET → org에서 상속

    const user = new TernaryMask(6);
    user.allow(3); // user에게 추가 허용
    // 나머지는 UNSET → team에서 상속

    // org → team
    const teamResolved = TernaryMask.inherit(org, team);
    expect(teamResolved.get(0)).toBe(ALLOW);  // org allow 상속
    expect(teamResolved.get(2)).toBe(DENY);   // team deny
    expect(teamResolved.get(5)).toBe(DENY);   // org deny 상속

    // (org→team) → user
    const userResolved = TernaryMask.inherit(teamResolved, user);
    expect(userResolved.get(0)).toBe(ALLOW);  // 최종 상속
    expect(userResolved.get(2)).toBe(DENY);   // team deny (deny-wins)
    expect(userResolved.get(3)).toBe(ALLOW);  // user 추가
    expect(userResolved.get(5)).toBe(DENY);   // org deny 상속
  });
});

describe("toBinaryMask", () => {
  it("ternary → binary 변환 (default-deny)", () => {
    const m = new TernaryMask(8);
    m.allow(0); m.allow(3);
    m.deny(1);
    // 2,4,5,6,7 = UNSET

    const binary = m.toBinaryMask("deny");
    // binary에서는 ALLOW만 1, 나머지 0
    expect((binary[0] >> 0) & 1).toBe(1); // slot 0 = allow
    expect((binary[0] >> 1) & 1).toBe(0); // slot 1 = deny → 0
    expect((binary[0] >> 2) & 1).toBe(0); // slot 2 = unset + deny → 0
    expect((binary[0] >> 3) & 1).toBe(1); // slot 3 = allow
  });

  it("ternary → binary 변환 (default-allow)", () => {
    const m = new TernaryMask(8);
    m.deny(1);
    // 0,2-7 = UNSET

    const binary = m.toBinaryMask("allow");
    // UNSET → default-allow → 1
    expect((binary[0] >> 0) & 1).toBe(1); // unset + allow → 1
    expect((binary[0] >> 1) & 1).toBe(0); // deny → 0
    expect((binary[0] >> 2) & 1).toBe(1); // unset + allow → 1
  });

  it("클라이언트 전송 크기: ternary 10 bytes → binary 5 bytes", () => {
    const m = new TernaryMask(40);
    // ternary: allowMask 5 + denyMask 5 = 10 bytes
    expect(m.allowMask.length + m.denyMask.length).toBe(10);
    // binary: 5 bytes
    const binary = m.toBinaryMask();
    expect(binary.length).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  실전 시나리오: 조직 계층 권한 상속
// ═══════════════════════════════════════════════════════════════════════════

describe("시나리오: SaaS 조직 계층 권한", () => {
  // 슬롯: 0=products.view, 1=orders.view, 2=payments.view,
  //        3=payments.cancel, 4=users.manage, 5=config.edit
  const SIZE = 6;

  it("기본 allow-all + 특정 deny 패턴", () => {
    // 조직: 기본 전부 허용
    const org = new TernaryMask(SIZE);
    for (let i = 0; i < SIZE; i++) org.allow(i);

    // 팀: config.edit 만 거부
    const team = new TernaryMask(SIZE);
    team.deny(5); // config.edit

    // 유저: payments.cancel 추가 거부
    const user = new TernaryMask(SIZE);
    user.deny(3); // payments.cancel

    const final = TernaryMask.inherit(
      TernaryMask.inherit(org, team),
      user,
    );

    expect(final.check(0)).toBe(true);  // products.view ✓
    expect(final.check(1)).toBe(true);  // orders.view ✓
    expect(final.check(2)).toBe(true);  // payments.view ✓
    expect(final.check(3)).toBe(false); // payments.cancel ✗ (user deny)
    expect(final.check(4)).toBe(true);  // users.manage ✓
    expect(final.check(5)).toBe(false); // config.edit ✗ (team deny)

    // 클라이언트 전송: binary로 flatten
    const clientMask = final.toBinaryMask();
    expect(clientMask.length).toBe(1); // 6 slots → 1 byte
  });

  it("default-deny + 선택적 allow 패턴", () => {
    // 조직: 아무것도 설정 안 함 (전부 UNSET)
    const org = new TernaryMask(SIZE);

    // 팀: 조회 권한만 허용
    const team = new TernaryMask(SIZE);
    team.allow(0); // products.view
    team.allow(1); // orders.view

    // 유저: payments.view 추가
    const user = new TernaryMask(SIZE);
    user.allow(2); // payments.view

    const final = TernaryMask.inherit(
      TernaryMask.inherit(org, team),
      user,
    );

    // default-deny 적용
    expect(final.check(0, "deny")).toBe(true);  // team allow
    expect(final.check(1, "deny")).toBe(true);  // team allow
    expect(final.check(2, "deny")).toBe(true);  // user allow
    expect(final.check(3, "deny")).toBe(false); // UNSET → deny
    expect(final.check(4, "deny")).toBe(false); // UNSET → deny
  });
});
