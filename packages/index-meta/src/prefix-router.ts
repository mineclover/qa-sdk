// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PrefixRouter — prefix → D1 database 라우팅
 *
 * PrefixRegistry (capacity 조회)와 분리된 별개 관심사.
 * 어느 D1 인스턴스가 특정 prefix의 entry를 보관하는지를 결정한다.
 *
 * composite 테이블은 entry가 없으므로 라우팅 대상이 아니다.
 */
export interface PrefixRouter {
  /**
   * prefix에 대응하는 D1 database ID를 반환한다.
   * 등록되지 않은 prefix이면 null.
   */
  getDatabase(prefix: string): Promise<string | null>;

  /**
   * prefix → d1DatabaseId 매핑 등록.
   * 동일 prefix를 재등록하면 덮어쓴다 (라우팅 변경 허용).
   */
  route(prefix: string, d1DatabaseId: string): Promise<void>;

  /**
   * 특정 D1 database에 속한 prefix 목록.
   * D1 인스턴스 단위 백업/복원 시 사용.
   */
  listPrefixes(d1DatabaseId: string): Promise<string[]>;
}
