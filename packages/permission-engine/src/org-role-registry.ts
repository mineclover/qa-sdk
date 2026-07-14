// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * org-role-registry.ts — Org Role 정의 및 Domain Role 배정 집합 관리.
 *
 * Org Role은 조직 단위 관리를 위한 편의 추상화 레이어다.
 * 본질적으로 "도메인별 Domain Role 배정의 명명된 묶음"이며,
 * Org Role 간에도 부모-자식 상속이 가능하다 (누적 OR).
 *
 * 제약:
 *  - 와일드카드 도메인 금지: 모든 배정은 명시적 domain을 지정해야 한다.
 *  - 동일 도메인에 복수 role 배정 허용: 합산된다.
 *  - 불변성: register() 후 정의 변경 불가.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** 도메인 + Role 명시적 배정. */
export interface DomainAssignment {
  /** 명시적 도메인 ID. "*" 불허. */
  domain: string;
  /** 해당 도메인에서 배정할 Role ID. */
  role: string;
}

/** Org Role 정의. */
export interface OrgRoleDef {
  /** Org Role 식별자. */
  id: string;
  /**
   * 이 Org Role이 직접 부여하는 Domain Role 배정 목록.
   * 부모 Org Role의 배정 제외 — 순수 추가분만 선언한다.
   */
  ownAssignments: readonly DomainAssignment[];
  /**
   * 상속받는 부모 Org Role ID 목록.
   * 부모의 모든 배정을 포함한다 (누적 OR).
   * 빈 배열 = 루트 org role.
   */
  parents: readonly string[];
}

export interface OrgRoleValidationError {
  orgRoleId: string;
  kind: 'cycle' | 'unknown-parent' | 'wildcard-domain';
  message: string;
}

// ── Internal ─────────────────────────────────────────────────────────────────

/** 도메인별 role 집합. domain → Set<roleId> */
type ResolvedAssignments = Map<string, Set<string>>;

interface OrgRoleNode {
  def: OrgRoleDef;
  /** 사전 계산된 전체 배정 집합. null = 미계산. */
  resolved: ResolvedAssignments | null;
}

// ── OrgRoleRegistry ──────────────────────────────────────────────────────────

export class OrgRoleRegistry {
  private readonly _roles = new Map<string, OrgRoleNode>();

  /**
   * Org Role을 등록한다.
   * 동일 id 중복 불허. 와일드카드 도메인 불허.
   */
  register(def: OrgRoleDef): void {
    if (this._roles.has(def.id)) {
      throw new RangeError(`Duplicate org role: "${def.id}"`);
    }
    for (const { domain } of def.ownAssignments) {
      if (domain === '*') {
        throw new RangeError(
          `Wildcard domain "*" is not allowed in org role "${def.id}". Use explicit domain IDs.`,
        );
      }
    }
    this._roles.set(def.id, { def, resolved: null });
  }

  /**
   * Org Role의 전체 Domain Role 배정을 반환한다 (상속 포함).
   * 반환값: domain → ReadonlySet<roleId>
   */
  resolve(orgRoleId: string): ReadonlyMap<string, ReadonlySet<string>> {
    const node = this._getNode(orgRoleId);
    if (!node.resolved) {
      node.resolved = this._resolveAssignments(orgRoleId, new Set());
    }
    return node.resolved;
  }

  /**
   * 특정 도메인에서 이 Org Role이 부여하는 Role ID 목록.
   * 상속 포함. 없으면 빈 배열.
   */
  resolveForDomain(orgRoleId: string, domain: string): string[] {
    return [...(this.resolve(orgRoleId).get(domain) ?? [])];
  }

  /** 등록된 Org Role ID 목록. */
  orgRoleIds(): string[] {
    return [...this._roles.keys()];
  }

  /**
   * 등록된 모든 Org Role 정의를 검증한다.
   * - 알 수 없는 부모 참조
   * - 순환 상속
   */
  validate(): OrgRoleValidationError[] {
    const errors: OrgRoleValidationError[] = [];
    for (const [id, node] of this._roles) {
      for (const parentId of node.def.parents) {
        if (!this._roles.has(parentId)) {
          errors.push({
            orgRoleId: id,
            kind: 'unknown-parent',
            message: `Org role "${id}" references unknown parent "${parentId}"`,
          });
        }
      }
      try {
        this._resolveAssignments(id, new Set());
      } catch (e) {
        if (e instanceof RangeError && e.message.includes('Circular')) {
          errors.push({ orgRoleId: id, kind: 'cycle', message: e.message });
        }
      }
    }
    return errors;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _getNode(id: string): OrgRoleNode {
    const node = this._roles.get(id);
    if (!node) throw new RangeError(`Unknown org role: "${id}"`);
    return node;
  }

  /** DFS로 상속 체인을 순회하며 배정 집합을 flatten한다. */
  private _resolveAssignments(orgRoleId: string, visiting: Set<string>): ResolvedAssignments {
    if (visiting.has(orgRoleId)) {
      throw new RangeError(`Circular inheritance detected for org role "${orgRoleId}"`);
    }

    const node = this._getNode(orgRoleId);
    if (node.resolved) return node.resolved;

    visiting.add(orgRoleId);

    const result: ResolvedAssignments = new Map();

    // 부모 배정 먼저 합산
    for (const parentId of node.def.parents) {
      const parentResolved = this._resolveAssignments(parentId, new Set(visiting));
      for (const [domain, roles] of parentResolved) {
        _mergeInto(result, domain, roles);
      }
    }

    // 자신의 배정 추가 (부모와 동일 domain이면 합산)
    for (const { domain, role } of node.def.ownAssignments) {
      _mergeInto(result, domain, new Set([role]));
    }

    visiting.delete(orgRoleId);
    node.resolved = result;
    return result;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _mergeInto(target: ResolvedAssignments, domain: string, roles: ReadonlySet<string>): void {
  let set = target.get(domain);
  if (!set) {
    set = new Set();
    target.set(domain, set);
  }
  for (const r of roles) set.add(r);
}
