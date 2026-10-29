/** @def.boundary apm-codegen-system */
/**
 * 생성물 헤더에 기록하는 generator 식별자.
 *
 * 버전은 package.json `version`과 일치해야 한다 — generator-info.test.ts가 drift를 막는다.
 * generator 버전이 오르면 헤더가 바뀌어 codegen drift 검사가 재생성을 요구한다.
 */
export const GENERATOR_NAME = 'codegen-core' as const;
export const GENERATOR_VERSION = '0.1.0';
