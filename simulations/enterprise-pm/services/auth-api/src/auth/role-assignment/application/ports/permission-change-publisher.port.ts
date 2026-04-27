// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * 권한 변경 publish port — bitmap-cache invalidation 의존을 인터페이스로 격리.
 *
 * 구현체는 module 단계에서 BitmapCacheService.publisher 어댑터로 주입된다.
 * publisher 가 비활성화 (operational fail-open) 인 경우 noop.
 */
export abstract class PermissionChangePublisherPort {
  abstract publishUserChange(userId: string, reason: "permission_change"): Promise<void>;
}
