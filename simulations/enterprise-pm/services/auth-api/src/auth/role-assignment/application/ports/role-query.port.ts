// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain read port — role 슬라이스 read model 의 부분만 노출.
 *
 * role-assignment use-case 가 assign 시점에 role 의 존재를 검증할 때 사용한다.
 * 구현체는 module 단계에서 RoleReadModelQuery 의 어댑터로 주입된다.
 */
export abstract class RoleQueryPort {
  abstract roleExists(roleId: string): Promise<boolean>;
}
