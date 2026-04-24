---
def:
  tier: component
  id: ms-concept-event
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
    - target: ms-concept-pipe
      type: traces_to
    - target: system-concepts
      type: traces_to
---

# 이벤트 (Event)

## 목적 ^purpose

데이터가 생산되는 포인트이자 파이프를 트리거하는 단위를 정의한다.
qa-sdk의 EventRecord를 meta-semantic 체계에서 공식적으로 위치시킨다.

---

## 이벤트란

**데이터가 생산되는 포인트.**

시스템에서 "무언가가 일어났다"는 사실이 기록될 때 이벤트가 발생한다.
이벤트는 데이터 패싯 중 **생산**의 구체적 발현이다.

```
사용자가 주문을 제출함 → 이벤트: order_submitted
서버가 결제를 처리함 → 이벤트: payment_processed
DB에 레코드가 저장됨 → 이벤트: record_persisted
```

## 이벤트의 두 가지 역할

| 역할 | 설명 |
|------|------|
| **데이터 생산 포인트** | 패싯의 "생산" 역할이 실현되는 순간. 새 데이터가 존재하기 시작 |
| **파이프 트리거** | 이벤트 발생이 파이프의 실행을 시작시킴 |

이 두 역할은 동시에 발생한다 — 데이터가 생산되면서 파이프가 트리거된다.

## 이벤트 → 파이프 → 이벤트 사이클

```
이벤트 A (데이터 생산)
  → 파이프 P1 트리거
    → 패싯 단계 수행 (소비→관리→생산→저장)
      → 이벤트 B 생산 (파이프 결과)
        → 파이프 P2 트리거
          → ...
```

파이프의 마지막 단계(생산 또는 저장)에서 새 이벤트가 발생할 수 있다.
이 새 이벤트가 다음 파이프를 트리거하여 체인을 형성한다.

**비즈니스 로직 = 이벤트에 의해 트리거되는 파이프 체인의 집합.**

## qa-sdk EventRecord와의 관계

meta-semantic의 이벤트는 새 포맷이 아니다.
**qa-sdk의 EventRecord에 meta-semantic 관점의 의미를 부여한 것이다.**

| qa-sdk EventRecord | meta-semantic 의미 |
|---|---|
| `event_key` | 이벤트 유형 — 어떤 종류의 데이터 생산인가 |
| `coordinate` | Spacetime UID — 이벤트의 좌표 주소 |
| `payload` | 생산된 데이터 — 패싯의 "생산" 결과물 |
| `timestamp` | 시간 축 — Spacetime UID의 tx_seq와 대응 |
| `trace_id` | 파이프 체인 추적 — 이벤트→파이프→이벤트 체인의 연결고리 |

## 이벤트와 수집 (레이어 1)

이벤트는 레이어 1(수집)의 핵심 입력이다.

```
수집 대상:
  이벤트 자체       → "무엇이 일어났는가" (event_key + payload)
  이벤트의 좌표     → "어디서 일어났는가" (coordinate)
  이벤트의 시간     → "언제 일어났는가" (timestamp)
  이벤트의 맥락     → "어떤 체인의 일부인가" (trace_id)
  이벤트의 패싯     → "어떤 역할을 하는가" (생산)
  이벤트의 scope    → "어떤 종류인가" (scope/aspect)
  이벤트의 layer    → "왜 존재하는가" (domain/operation/...)
  이벤트의 concern  → "어떤 관심사인가" (security/performance/...)
```

모든 수집은 이벤트로부터 시작된다.
이벤트가 없으면 수집할 것이 없다.

## 이벤트가 아닌 것

| 예시 | 이유 |
|------|------|
| 타입 선언 | 데이터를 생산하지 않음 — 정의만 |
| import 문 | 실행이 아님 — 구조만 |
| 설정 값 | 환경 파라미터 — 비즈니스 데이터 아님 |
| 로그 출력 | 관측 부산물 — 비즈니스 이벤트가 아님 (단, 관측 이벤트로 수집할 수는 있음) |

## 이벤트의 분류

이벤트도 scope로 분류된다:

| scope | 이벤트 예시 |
|-------|-----------|
| ui | 사용자 클릭, 페이지 진입, 폼 제출 |
| feature | 비즈니스 로직 실행 완료, 계산 결과 생산 |
| flow | 프로세스 단계 전이, 워크플로우 상태 변경 |
| state | 상태 전이 발생, 캐시 갱신 |
| data | 레코드 생성/수정/삭제, 스키마 변경 |
| interface | API 호출 수신, CLI 명령 실행, 이벤트 메시지 수신 |
| constraint | 규칙 위반 감지, 검증 통과/실패 |
