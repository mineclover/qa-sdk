// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * Re-export from dkg root. 이 파일은 하위 호환을 위해 유지된다.
 * 새 코드는 "../decision-scaffold.js"에서 직접 import할 것.
 */
export { scaffoldDecision } from '../decision-scaffold.js';
export type { ScaffoldInput } from '../decision-scaffold.js';
