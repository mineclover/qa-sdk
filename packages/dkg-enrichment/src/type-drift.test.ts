// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * convergence DKG 타입 사본 drift 검사.
 *
 * convergence는 dkg를 import할 수 없어(의존 방향) `convergence/src/dkg-types.ts`에 사본을 둔다.
 * 두 패키지를 모두 의존하는 dkg-enrichment에서 사본과 정본이 같은 타입인지 컴파일 시점에 고정한다.
 *
 * 상호 할당 가능성만으로는 optional 필드 누락(예: `metadata`, `provenance`)을 잡지 못하므로
 * 정확한 타입 동치(`toEqualTypeOf`)로 검사한다. 단언은 컴파일 시점에만 의미가 있으므로
 * 패키지 `test` 스크립트가 `vitest run` 뒤에 `tsc --noEmit`(src 전체, 이 파일 포함)을 실행해 drift를 실패로 만든다.
 */

import type {
  ConstraintNode as ConvergenceConstraint,
  DecisionNode as ConvergenceDecision,
  ObservationNode as ConvergenceObservation,
  ObservationProvenance as ConvergenceProvenance,
} from '@qa-sdk/convergence';
import type {
  ConstraintNode as DkgConstraint,
  DecisionNode as DkgDecision,
  ObservationNode as DkgObservation,
} from 'dkg';
import { describe, expectTypeOf, it } from 'vitest';

describe('convergence DKG 타입 사본 drift', () => {
  it('ObservationNode가 정본과 상호 할당 가능하다', () => {
    expectTypeOf<ConvergenceObservation>().toMatchTypeOf<DkgObservation>();
    expectTypeOf<DkgObservation>().toMatchTypeOf<ConvergenceObservation>();
  });

  it('ObservationNode가 정본과 같은 타입이다 (optional 필드 누락 포함)', () => {
    expectTypeOf<ConvergenceObservation>().toEqualTypeOf<DkgObservation>();
  });

  it('ObservationProvenance가 정본과 같은 타입이다', () => {
    expectTypeOf<ConvergenceProvenance>().toEqualTypeOf<
      NonNullable<DkgObservation['provenance']>
    >();
  });

  it('DecisionNode가 정본과 같은 타입이다', () => {
    expectTypeOf<ConvergenceDecision>().toEqualTypeOf<DkgDecision>();
  });

  it('ConstraintNode가 정본과 같은 타입이다', () => {
    expectTypeOf<ConvergenceConstraint>().toEqualTypeOf<DkgConstraint>();
  });
});
