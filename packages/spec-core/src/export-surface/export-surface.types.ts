// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * prefix의 export surface 정의.
 *
 * 모듈의 exports에 해당 — 어떤 차원이 외부에 보이고,
 * 어떤 패턴으로 제목(title)이 구성되는지.
 *
 * export에 포함되는 차원 = 좌표의 정체성을 결정하는 차원
 * export에서 빠지는 차원 = 컨텍스트 또는 런타임 데이터
 */
export interface ExportSurface {
  /** 제목에 포함되는 차원 ID 목록 (순서 보장) */
  dims: readonly string[];

  /**
   * 제목 구성 패턴. 차원 ID를 {dimId} 로 참조.
   *
   * @example "{action}.{role}" → "add.admin"
   * @example "{env}/{svc_name}" → "prod/shopping-web"
   */
  pattern: string;
}
