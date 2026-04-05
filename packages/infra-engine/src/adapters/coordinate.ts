// adapters/coordinate.ts — CoordinateAdapter 실구현 (fail-open)
import type { CoordinateAdapter } from "./adapter.js";

/**
 * 좌표 인코딩 어댑터.
 * 현재는 축 엔트리 데이터가 런타임에 없으므로 fail-open (빈 address_context 반환).
 * 향후 demo-catalog에서 WeightedIndex를 import하면 실인코딩 가능.
 */
export function createCoordinateAdapter(): CoordinateAdapter {
  return {
    resolveSvcRef(_serviceId, _env, _region, _namespace) {
      // TODO: demo-catalog의 service prefix 좌표 인코딩
      // 현재는 축 엔트리 데이터가 런타임에 없으므로 null (fail-open)
      return null;
    },

    encodeDeployEvent(svcRef, _action, _actor) {
      if (!svcRef) return {};
      // TODO: deploy_event prefix 인코딩 (svc_ref × deploy_action × actor)
      return {};
    },

    encodeHealthEvent(svcRef, _status) {
      if (!svcRef) return {};
      return {};
    },
  };
}
