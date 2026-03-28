---
def:
  id: cookbook-guide
  address: def_document:v1:1064
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [entry-point]
  links:
    - target: spec-linking-standard
      type: refines
---

# Cookbook — 자주 쓰는 레시피

## 목적 ^purpose

entry 추가, 축 생성, prefix 설계, capacity 확장 등 자주 쓰는 좌표 시스템 조작 레시피 모음.

## 구성 ^overview

- **entry 추가**: 현재 headroom 확인 → 중복 검사 → impact 분석(stride-break 여부) → encode 테스트
- **새 prefix 생성**: 기존 prefix/축 확인 → 새 축 정의(capacity=nextPowerOf2) → prefix 조합 설계 → DKG 영향 확인
- **capacity 확장**: headroom 확인 → capacity 변경(2배 이상) → stride-break 영향 분석 → refEntries 재계산 검증
- **FlowDefinition**: prefix + version + values로 비즈니스 흐름의 관측 포인트(entry/branches)를 정의하여 정수 주소 기반 추적
- **자동 마이그레이션**: resolve()로 구버전 주소를 최신 버전으로 변환하고, migrated 플래그로 DB 업데이트 판단
- **중복 축 검토**: dkg overlaps로 entries 유사도를 분석하여 merge 후보(100%) / review 대상(50%) 식별
- **서비스별 환경 구성**: QA_ENV/QA_REGION/QA_SERVICE/QA_NAMESPACE 환경변수로 같은 코드에서 다른 service 주소를 자동 생성

## entry 추가 (capacity 내)

**상황:** role에 "auditor" 추가

```bash
# 1. 현재 상태 확인
qa list-axes
# → role  entries=7  cap=32  headroom=25

# 2. 이미 있는지 확인
qa find-version role auditor
# → v4: position 6  (이미 있다면 여기서 끝)
# → (없으면 DEMO_CATALOG에 entry 추가)

# 3. 영향 분석
qa impact --axis role
# → stride-break: false
# → 영향: permission, shopping-domain, auth-service

# 4. 인코딩 테스트
qa encode permission --role auditor
# → permission:v4:ADDRESS
```

---

## 새 prefix 생성

**상황:** 알림 시스템을 위한 notification prefix 필요

```bash
# 1. 의사결정 7개 질문
qa list-prefixes    # 기존에 notification prefix 없음 확인
qa list-axes        # notification_type 같은 축도 없음

# 2. 새 축 정의 (DEMO_CATALOG에 추가)
#    notification_type: ["email", "sms", "push", "webhook"]
#    notification_status: ["pending", "sent", "failed", "cancelled"]
#    → capacity: 각각 32

# 3. 새 prefix 정의
#    notification: notification_type × notification_status
#    → 32 × 32 = 1024 조합

# 4. encode 테스트
qa encode notification --notification_type email --notification_status sent
# → notification:v1:ADDRESS

# 5. DKG 영향 확인
qa impact --prefix notification
# → stride-break: false (신규이므로)
# → 기존에 영향 없음
```

---

## capacity 확장

**상황:** api_path capacity 64가 부족해짐

```bash
# 1. 현재 상태
qa list-axes
# → api_path  entries=6  cap=64  headroom=58

# 2. headroom 58이면 아직 충분. 하지만 미래를 대비하려면:
#    _axes.api_path.capacity = 128 (또는 256)

# 3. 변경 시 영향 확인
qa impact --axis api_path
# → 영향: api prefix
# → stride-break: true (capacity 변경)

# 4. 변경 후:
#    build → refEntries 자동 재계산 → 테스트 통과 확인
qa derive-refs --check
# → ✅ 전부 일치
```

---

## FlowDefinition — 비즈니스 흐름 정의

**상황:** 가입 흐름의 관측 포인트를 정의

```typescript
import { defineFlow } from "@qa-sdk/spec-core";
import { DEMO_CATALOG } from "demo-snapshot";

const signupFlow = defineFlow(DEMO_CATALOG, {
  id: "signup-flow",
  name: "가입 흐름",
  entry: {
    prefix: "page_view", version: "v1",
    values: { page: "home", locale: "ko", userType: "guest" },
  },
  branches: {
    formSubmit: {
      prefix: "flow_point", version: "v1",
      values: { flow_name: "signup", flow_step: "processing", flow_variant: "default" },
    },
    success: {
      prefix: "flow_point", version: "v1",
      values: { flow_name: "signup", flow_step: "success", flow_variant: "default" },
    },
    failure: {
      prefix: "flow_point", version: "v1",
      values: { flow_name: "signup", flow_step: "failure", flow_variant: "default" },
    },
  },
});

// 각 관측 포인트가 고유 정수 주소를 가진다
// 런타임에 이 주소가 관측되면 흐름의 진행 상태를 추적할 수 있다
```

---

## 자동 마이그레이션

**상황:** DB에 구버전 주소가 저장되어 있음

```typescript
const qa = createQaContext({ catalog: DEMO_CATALOG });

// DB에서 읽은 구버전 주소
const oldAddr = "permission:v1:5";

// 자동 마이그레이션
const result = qa.resolve(oldAddr);
// → { address: "permission:v4:NEW", values: { role: "admin", ... }, migrated: true }

// 마이그레이션 발생 시 DB 업데이트
if (result.migrated) {
  await db.update(id, { address: result.address });
}
```

---

## 중복 축 검토

**상황:** 두 축의 entries가 비슷해 보임

```bash
qa dkg overlaps
# → 🔴 initiator ↔ channel: [web,mobile] 100% → merge 후보
# → 🟡 subjectKind ↔ objectKind: [_,role,group] 50% → review

# 의도적 분리인 경우 → Decision으로 분리 근거 기록
# 실제 중복인 경우 → 병합 의사결정 진행
```

---

## 서비스별 환경 구성

```bash
# dev
QA_ENV=dev QA_REGION=asia QA_SERVICE=payment QA_NAMESPACE=shop node app.js

# prod
QA_ENV=prod QA_REGION=usa QA_SERVICE=payment QA_NAMESPACE=shop node app.js

# 같은 코드. 다른 환경 변수. 다른 service 주소.
# 권한/이벤트의 encode 결과에 env/region이 자동 포함.
```
