// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * port.ts — `permission-engine`의 ResourcePolicyRegistry 인터페이스와
 * 도메인 타입을 store 패키지에서 한 곳에 모아 re-export.
 *
 * 외부 호출자는 두 패키지(permission-engine + resource-policy-store)에서
 * 타입을 분리 import 하지 않고 본 진입점만 사용한다.
 *
 * 본 파일은 단순 re-export — 별도 인터페이스를 새로 정의하지 않는다.
 * permission-engine이 인터페이스 SSOT.
 */

export {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
  type ResourcePolicyCreateArgs,
  type ResourcePolicyRegisterArgs,
  type ResourcePolicyDelegateArgs,
} from 'permission-engine';
