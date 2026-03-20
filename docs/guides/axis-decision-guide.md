# Axis Decision Guide — 축에 넣을 것과 넣지 않을 것

> **이 가이드는 qa-sdk 뿐 아니라 어떤 서비스에서든 재사용 가능하다.**
> 새로운 데이터 항목을 다룰 때, 이것이 axis인지 아닌지를 판단하는 표준 프레임워크.

---

## 5-Question Checklist

새 데이터 항목이 생겼을 때, 순서대로 답한다:

### Q1. 경우의 수가 유한한가?

```
YES → 다음 질문
NO  → axis가 아니다. table_ref 또는 payload.
```

예시:
- role: admin, dev, op, viewer → **유한** (YES)
- user_id: 1, 2, ..., ∞ → **무한** (NO → table_ref)
- API path: /orders, /users/profile, ... → **계속 늘어남** (NO → payload)
- timestamp → **무한** (NO → EventRecord.timestamp)

### Q2. 변경에 의사결정이 필요한가?

```
YES → 다음 질문
NO  → axis가 아니다. 자동 결정되는 값은 payload 또는 미들웨어.
```

예시:
- role에 "auditor" 추가 → **의사결정** (YES — 권한 체계 변경)
- 새 API endpoint 추가 → **일상 작업** (NO — 라우트 추가일 뿐)
- HTTP method → **고정** (YES — GET/POST/PUT/DELETE/PATCH는 RFC 표준)

### Q3. 여러 서비스/prefix에서 공유되는가?

```
YES → 다음 질문
NO  → axis보다는 해당 prefix의 로컬 enum 또는 payload.
```

예시:
- env: dev/prod → **전역 공유** (YES — 모든 서비스가 같은 env 축)
- page: home/product → **tracking, page_view 등 여러 prefix에서 사용** (YES)
- 특정 서비스의 내부 에러코드 → **해당 서비스만** (NO)

### Q4. 한 분기에 변경이 2회 이내인가?

```
YES → axis에 넣는다
NO  → axis에 넣되, capacity를 넉넉히 잡는다. 또는 table_ref 검토.
```

예시:
- locale: ko/en/ja → **변경 극히 드뭄** (YES)
- event_name → **분기별 2~3개 추가 가능** (경계선 — capacity 넉넉히)
- 상품 카테고리 → **자주 변할 수 있음** (dynamic enum axis with flexible mode)

### Q5. capacity를 합리적으로 잡을 수 있는가?

```
YES → axis 확정. optimalCapacity() 적용.
NO  → table_ref. 좌표에 넣지 않는다.
```

예시:
- region: AWS 전체가 ~30개 → cap=32 → **합리적** (YES)
- 태그: 수천 개 가능 → cap=1024+ → **아슬아슬** (경계선)
- 사용자 콘텐츠 ID → cap 예측 불가 → **NO → table_ref**

---

## 판정표

| 5Q 결과 | 판정 | 예시 |
|---|---|---|
| 전부 YES | **axis** | role, env, locale, http_method |
| Q1 NO | **table_ref** or **payload** | user_id, timestamp, request_id |
| Q2 NO | **payload** or **미들웨어 자동** | API path, 요청 헤더 |
| Q3 NO | **해당 prefix 로컬** | 서비스 내부 에러코드 |
| Q4 NO | **dynamic enum** (axis + flexible) | 상품 카테고리, 태그 |
| Q5 NO | **table_ref** | 무한 증가 가능한 ID |

---

## Anti-Patterns

### ❌ API 경로를 axis에 넣기

```
api_path: ["users", "orders", "products", "auth"]
→ 새 API마다 축 수정 → 오버헤드
→ API 추가는 의사결정이 아니라 일상 작업
→ 대신: resource_type(api/page/webhook)만 axis, 경로는 payload
```

### ❌ 자주 바뀌는 값을 axis에 넣기

```
campaign_id: ["summer-2026", "winter-2026", ...]
→ 캠페인마다 축 수정 → stride-break 위험
→ 대신: table_ref 또는 payload
```

### ❌ 한 서비스에서만 쓰는 값을 전역 axis에 넣기

```
internal_error_code: ["E001", "E002", ...]
→ 다른 서비스에서 안 씀 → 전역 axis 낭비
→ 대신: 해당 서비스의 로컬 enum 또는 payload
```

### ❌ 프레임워크가 이미 제공하는 값을 수동 입력

```
qa.track({ api: { http_method: req.method } })
→ req.method는 프레임워크가 이미 알고 있음
→ 대신: 미들웨어가 자동 추출
```

---

## 경계선 사례와 판단

### 흐름 이름 (flow_name)

```
Q1: 유한? → 현재 5개 (checkout, signup, ...) → YES
Q2: 의사결정? → 새 흐름 추가는 비즈니스 결정 → YES
Q3: 공유? → flow_point prefix에서 사용 → YES
Q4: 변경 빈도? → 분기 1~2개 → YES
Q5: capacity? → 64면 충분 → YES
→ axis ✓

만약 흐름이 100개 넘으면? → dynamic enum (flexible mode) 또는 table_ref 전환 검토
```

### 서비스 이름 (svc_name)

```
Q1: 유한? → 현재 5개 → YES
Q2: 의사결정? → 새 서비스 추가는 인프라 결정 → YES
Q3: 공유? → service prefix가 전역 참조 → YES
Q4: 변경 빈도? → 분기 0~1개 → YES
Q5: capacity? → 32면 충분 → YES
→ axis ✓

만약 마이크로서비스가 100개 넘으면? → capacity 128~256 또는 계층 분할
```

### 이벤트 이름 (event_name)

```
Q1: 유한? → 현재 10개 → YES
Q2: 의사결정? → 새 이벤트 추가는 스펙 결정 → YES
Q3: 공유? → event prefix에서 사용 → YES
Q4: 변경 빈도? → 분기 2~3개 → 경계선
Q5: capacity? → 64면 충분 → YES
→ axis ✓ (capacity 넉넉히)
```

---

## 의사결정 기록 템플릿

축 추가/제거 시 Decision에 기록:

```yaml
id: DEC-AXIS-XXX
type: new-axis  # 또는 "deprecate", "merge", "capacity"
date: "2026-03-20"
title: "XXX 축 추가"
5Q:
  Q1_finite: true     # "경우의 수 유한"
  Q2_decision: true   # "변경에 의사결정 필요"
  Q3_shared: true     # "여러 prefix에서 공유"
  Q4_stable: true     # "변경 빈도 낮음"
  Q5_capacity: 32     # "합리적 capacity"
rationale: "..."
alternatives: [...]
reversalConditions: [...]
```

---

## 다른 서비스에 적용하기

이 가이드의 5Q Checklist는 qa-sdk에 국한되지 않는다:

```
1. 서비스에서 관리하는 데이터 항목 나열
2. 각 항목에 5Q 적용
3. axis로 판정된 것 → prefix 구성
4. 아닌 것 → table_ref, payload, 미들웨어

결과: 서비스의 enum + 이벤트 + 권한이 prefix로 정리됨
     → qa-sdk 연동 가능 → 전역 좌표 체계 합류
```
