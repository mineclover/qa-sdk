---
name: decide
description: "의사결정 플로우 실행. 트리거: '결정', 'decide', '테스트 필요', '확장할까', '안정화', '기존 기능', '판단', '의사결정', 'decision'"
---

# 의사결정 플로우

소프트웨어 개발 중 반복되는 의사결정을 일관된 컨텍스트로 지원한다.

## 결정 유형 판별

사용자의 요청에서 결정 유형을 판별한다:

| 키워드 | 플로우 | 설명 |
|--------|--------|------|
| "테스트 필요", "테스트 추가", "테스트 판단" | `test-needed` | 변경에 테스트가 필요한가? |
| "확장", "기획 확장", "스코프", "범위" | `scope-expansion` | 기획을 확장할 것인가? |
| "안정화", "버그", "성능", "품질" | `stabilization` | 기능을 안정화할 것인가? |
| "기존 기능", "뭐가 있지", "조회", "이력" | lookup | 기존 기능/결정 이력 조회 |
| 기타 | `decision-router` | 범용 라우터로 안내 |

## 실행 절차

### 1. 컨텍스트 확인

결정 시작 전, 이전 맥락을 확인한다:

```
이 결정과 관련된 이전 기록:
- 이력: {totalCompleted}건 완료, 평균 confidence {avg}
- 패턴: "{description}" (현재 매치: {yes/no})
- 자동 정책: "{name}" → {gateId}에서 {branchId} 자동 선택
- 인지 모델: "{question}" (gate: {gateId})
```

### 2. gate 순회

각 gate에서:
1. gate 이름과 선택지를 제시
2. 인지 모델 질문이 있으면 함께 제시
3. 이전 선택 분포를 참고 정보로 제공
4. 사용자 선택 + 근거(evidence) 기록

자동 정책이 적용되면:
```
✅ 자동 판정: {policyName}
  gate: {gateId} → {branchId} (confidence: {confidence})
  근거: {rationale}
```

### 3. 결정 완료

완료 시 서사(narrative)를 기록:
```
배경: {trigger}
여정: {gate1}={choice1} → {gate2}={choice2} → ...
도달: address {coordinateAddress}
산출: {artifactType} → {artifactRef}
```

코어 전환점만 요약:
```
[{coreGate}={coreChoice}] → {outcome}
```

### 4. 조회 모드 (lookup)

기존 기능을 조회할 때:
```
"{keyword}" 관련 결정 이력:
- {schemaId} ({completedAt}): {summary}
- 관련 정책: {policyName}
- 패턴: {patternDescription}
```

## 자동 판정 기준

다음 조건이면 사람에게 묻지 않고 자동 판정:

- 문서만 변경 → 테스트 불필요
- 리팩터 + 국소 + 커버리지 충분 → 테스트 불필요
- 신규 기능 + 시스템 영향 → E2E 테스트 추가
- 버그 빈도 높음 → 안정화 필요
- 미완성 + 수요 없음 → 기획 보류

그 외 = 사람이 결정 (taste decision)

## mentalModel 참고

코어 gate에서 결정할 때 연결된 인지 모델의 질문을 제시:

- **bezos-doors**: "이 결정은 되돌릴 수 있는가?"
- **munger-inversion**: "무엇이 실패를 만드는가?"
- **jobs-subtraction**: "이것을 빼면 핵심이 강해지는가?"
- **speed-calibration**: "70% 정보로 결정하면 위험이 있는가?"
- **boil-the-lake**: "90%와 100%의 추가 비용은?"
- **temporal-depth**: "12개월 뒤 이 결정을 어떻게 평가할 것인가?"
- **edge-paranoia**: "이름이 47글자면? 결과가 0개면?"

## 회고

결정 후 회고를 추가할 수 있다:
- 발견된 패턴
- 다음에 참고할 교훈
- 아직 답하지 못한 질문

회고는 다음 결정의 컨텍스트로 축적된다.
