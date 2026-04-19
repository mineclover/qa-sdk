// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * WeightedIndex 에러 계층
 *
 * 모든 에러는 WeightedIndexError를 상속하므로 `instanceof WeightedIndexError` 로
 * 라이브러리 에러를 한 번에 잡을 수 있고, 세부 클래스로 분기도 가능하다.
 *
 * @example
 * try {
 *   registry.encodeFromIds("api_perm", { role: 999, ... })
 * } catch (e) {
 *   if (e instanceof EntityNotFoundError) { // 엔티티 없음 처리
 *   } else if (e instanceof VersionNotFoundError) { // 버전 없음 처리
 *   } else if (e instanceof WeightedIndexError) { // 그 외 라이브러리 에러
 *   }
 *   else throw e
 * }
 */

/** 모든 라이브러리 에러의 베이스 클래스 */
export class WeightedIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // V8 스택 트레이스에서 이 생성자를 제외 (V8 전용 API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const E = Error as any;
    if (typeof E.captureStackTrace === "function") {
      E.captureStackTrace(this, this.constructor);
    }
  }
}

/** shape 정의가 잘못된 경우 (0 이하 차원, 빈 배열 등) */
export class ShapeError extends WeightedIndexError {}

/** encode에 전달된 좌표가 유효하지 않은 경우 */
export class CoordError extends WeightedIndexError {}

/** decode에 전달된 index가 [0, size-1] 범위를 벗어난 경우 */
export class IndexRangeError extends WeightedIndexError {}

/** decodeTo 버퍼가 shape.length보다 작은 경우 */
export class BufferError extends WeightedIndexError {}

/** LabelRegistry에 등록되지 않은 레이블 이름 */
export class LabelNotFoundError extends WeightedIndexError {}

/** 레이블 또는 prefix에 등록되지 않은 버전 */
export class VersionNotFoundError extends WeightedIndexError {}

/** 레이블 버전에 등록되지 않은 entity ID 또는 index */
export class EntityNotFoundError extends WeightedIndexError {}

/** PrefixCodec에 등록되지 않은 prefix 이름 */
export class PrefixNotFoundError extends WeightedIndexError {}

/** 직렬화/역직렬화 형식 오류 */
export class SerializeError extends WeightedIndexError {}

/** migrate 함수가 잘못된 좌표 배열을 반환한 경우 */
export class MigrateError extends WeightedIndexError {}
