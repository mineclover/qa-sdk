/**
 * 목적 정렬 2단계 골든 초안.
 *
 * 사람 확정 전 자료이므로 모든 항목의 judgment는 proposed다.
 */

export type ProposedVerdict = '맞다' | '틀리다' | '판단 보류';

export interface PurposeAlignmentGolden {
  readonly id: string;
  readonly analysis: 'merge' | 'simplify' | 'coverage' | 'skew' | 'pattern-anomaly';
  readonly judgment: 'proposed';
  readonly verdict: ProposedVerdict;
  readonly expected: string;
  readonly treatment: '수정' | '등급 하향' | '보고';
  readonly evidence: string;
}

export const PURPOSE_ALIGNMENT_GOLDEN: readonly PurposeAlignmentGolden[] = [
  {
    id: 'merge-engine-validation',
    analysis: 'merge',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: '구조 후보는 병합 결정이 아니라 observation/review로 남긴다',
    treatment: '등급 하향',
    evidence:
      'validation_event는 validation_layer로 engine_event와 의미를 분리한다는 DEMO_DKG_CONFIG invariant가 있다.',
  },
  {
    id: 'merge-test-coverage',
    analysis: 'merge',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: 'test_coverage는 test_event의 flow_variant 확장으로 별도 prefix다',
    treatment: '등급 하향',
    evidence: 'IL-test-matrix와 flow_variant 확장 정의가 병합보다 추적 분리를 지지한다.',
  },
  {
    id: 'merge-cli-tracking',
    analysis: 'merge',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: 'cli_event의 행위와 cli_tracking의 skill_outcome 결과를 분리한다',
    treatment: '등급 하향',
    evidence: 'IL-skill-cli와 추가 결과 축이 활동/결과 분리를 명시한다.',
  },
  {
    id: 'merge-ir-pipe-intent',
    analysis: 'merge',
    judgment: 'proposed',
    verdict: '판단 보류',
    expected: 'addressModel과 prefix category의 의미 근거를 확인하기 전 observation으로 둔다',
    treatment: '등급 하향',
    evidence: '축 집합은 같지만 ir_pipe는 product/event, ir_intent_path는 sum/observation이다.',
  },
  {
    id: 'simplify-low-sample',
    analysis: 'simplify',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: '1건 관측에서는 단일값 차원·deactivate 제안을 만들지 않는다',
    treatment: '수정',
    evidence: '단일 윈도우 표본은 설계 결함과 관측 편향을 구분할 수 없다.',
  },
  {
    id: 'simplify-sufficient-sample',
    analysis: 'simplify',
    judgment: 'proposed',
    verdict: '맞다',
    expected: 'prefix별 30건 이상 관측된 안정적인 단일값은 단순화 후보로 남긴다',
    treatment: '보고',
    evidence: '500건 동일 page_view 표본에서 page·locale·userType이 지속적으로 하나의 값이다.',
  },
  {
    id: 'coverage-empty-window',
    analysis: 'coverage',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: '빈 usage는 미사용 Decision이 아니라 zero-prefix observation만 만든다',
    treatment: '수정',
    evidence: '수집 경로가 비어 있어 dormant와 미관측을 구분할 근거가 없다.',
  },
  {
    id: 'coverage-axis-scoped-phantom',
    analysis: 'coverage',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: 'phantom은 entry 값이 아니라 axisId:entry로 판정한다',
    treatment: '수정',
    evidence: '다른 축에 같은 문자열 entry가 정의되어도 해당 축의 미정의 값은 phantom이다.',
  },
  {
    id: 'coverage-prefix-attribution',
    analysis: 'coverage',
    judgment: 'proposed',
    verdict: '판단 보류',
    expected: '공유 축의 entry를 prefix별로 귀속할 수 있을 때만 coverage를 결정에 사용한다',
    treatment: '보고',
    evidence:
      'EntryUsage에는 prefix provenance가 없어 같은 축을 공유하는 두 관측 prefix를 완전히 분리할 수 없다.',
  },
  {
    id: 'skew-explicit-latest',
    analysis: 'skew',
    judgment: 'proposed',
    verdict: '맞다',
    expected: '집계로 동시 version을 찾고 최신 version은 catalog release 정의로 대조한다',
    treatment: '수정',
    evidence: 'count가 큰 version을 최신으로 추정하면 canary 신버전을 구버전으로 오판한다.',
  },
  {
    id: 'pattern-low-sample-ratio',
    analysis: 'pattern-anomaly',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: 'previous/current 각 1건의 ratio_shift·volume_spike는 발생시키지 않는다',
    treatment: '수정',
    evidence: '1건 윈도우의 100% 변화는 저트래픽 잡음이며 배포 대응 결정 근거가 아니다.',
  },
  {
    id: 'pattern-low-sample-volume',
    analysis: 'pattern-anomaly',
    judgment: 'proposed',
    verdict: '틀리다',
    expected: 'previous 1건→current 3건의 volume_spike는 발생시키지 않는다',
    treatment: '수정',
    evidence: '3배라는 비율만으로 저표본 윈도우를 이상으로 승격할 수 없다.',
  },
  {
    id: 'pattern-sufficient-ratio',
    analysis: 'pattern-anomaly',
    judgment: 'proposed',
    verdict: '맞다',
    expected: '양쪽 윈도우가 최소 표본 이상이면 큰 ratio_shift를 observation으로 보낸다',
    treatment: '보고',
    evidence: '충분한 두 윈도우의 분포 반전은 P5 관측 신호로 남길 수 있다.',
  },
];
