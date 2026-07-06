---
def:
  tier: exempt
  id: ms-concept-boundary
  type: spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-concepts
      type: traces_to
    - target: ms-concept-data-facets
      type: traces_to
sources:
  - packages/core/src/meta-semantic/ir-types.ts
  - packages/core/src/meta-semantic/ir-validate.ts
  - packages/core/src/meta-semantic/ir-validate.test.ts
---

# 바운더리 (Boundary)

## 목적 ^purpose

패싯 중 일부가 존재하는 검증 가능한 기능 단위를 정의한다.
이 개념이 모듈을 정의한다 — 모듈은 코드의 구조적 단위가 아니라
바운더리에 의해 정의된다.

---

## "검증 가능"의 기준

바운더리가 되려면 다음 중 하나 이상을 만족해야 한다:

| 검증 유형 | 예시 | 확인 방법 |
|----------|------|----------|
| **실행 검증** | 함수를 호출하고 결과를 확인 | 단위 테스트 |
| **타입 검증** | 스키마가 컴파일 타임에 통과 | 타입 체커 |
| **계약 검증** | 입출력이 명세와 일치 | 계약 테스트 |
| **정합성 검증** | 데이터가 규칙을 만족 | 검증 함수 |

"검증 가능"이란 **결과를 기계적으로 판정할 수 있는가**이다.
코드 리뷰로만 확인 가능한 것은 검증이 아니다.

## 바운더리 예시

```
순수 함수 (leaf):
  정의 ✓  — 입력/출력 타입이 있다
  생산 ✓  — 결과를 생성한다
  소비 ✓  — 입력을 사용한다
  관리 ✗  — 정합성 보장은 상위가 담당
  저장 ✗  — UID 부여는 상위/외부가 담당
  검증: 단위 테스트로 입출력 확인 → 유효한 바운더리

타입 선언 (leaf):
  정의 ✓  — 스키마를 선언한다
  나머지 ✗
  검증: 컴파일 타임 타입 체크 → 유효한 바운더리

서비스 클래스 (module):
  정의 ✓  관리 ✓  생산 ✓  소비 ✓  저장 ✓
  검증: 통합 테스트로 계약 확인 → 유효한 바운더리
```

## 이것은 바운더리가 아니다

| 코드 | 이유 |
|------|------|
| 내부 헬퍼 함수 (private, 외부 계약 없음) | 독립 검증 불가 — 호출자에 종속 |
| 주석, 문서 | 패싯 중 어느 것도 존재하지 않음 |
| 설정 파일 (.env, config.json) | 데이터 역할을 수행하지 않음 — 환경 파라미터 |

## 모듈과의 관계

바운더리 = 모듈이다. 모듈은 "코드의 구조적 단위"가 아니라
"패싯 중 일부가 존재하는 검증 가능한 기능 단위"에 의해 정의된다.
어떤 패싯이 존재하느냐에 따라 모듈의 성격(leaf/module/group)이 달라진다.
