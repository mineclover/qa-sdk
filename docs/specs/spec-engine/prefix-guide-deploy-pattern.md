---
def:
  id: prefix-guide-deploy-pattern
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [entry-point, runtime, observability]
  links:
    - target: prefix-guide
      type: refines
---

# 환경별 오버라이드 예시

## 목적 ^purpose

dev, test, prod 리전별로 같은 코드가 환경 변수에 따라 다른 주소를 생성하는 배포 패턴을 보여준다. 환경 분리와 리전별 비교 분석의 기반이 된다.

## 개발 환경 (dev)

```bash
QA_ENV=dev
QA_REGION=asia
QA_SERVICE=shopping-web
QA_NAMESPACE=shop
```

```typescript
const qa = createQaContext({
  env: process.env.QA_ENV,       // "dev"
  region: process.env.QA_REGION, // "asia"
  ...
});

// 모든 주소가 dev 컨텍스트:
qa.encode("permission", { role: "admin" })
// → service_ctx = dev/asia/shopping-web/shop (고정)
// → 개발자는 role만 지정
```

## 테스트 (test with fixtures)

```bash
QA_ENV=test
QA_REGION=asia
QA_SERVICE=shopping-web
QA_NAMESPACE=shop
```

```typescript
// 테스트에서는 같은 코드, 같은 인터페이스
// env=test이므로 prod 데이터와 분리
// 같은 { role: "admin" } → 다른 주소 (env 차원이 다르므로)
// 분석 시 env=test 필터로 테스트 데이터만 조회
```

## 프로덕션 (prod, 다중 리전)

```bash
# US 리전
QA_ENV=prod
QA_REGION=usa
QA_SERVICE=shopping-web
QA_NAMESPACE=shop

# Asia 리전
QA_ENV=prod
QA_REGION=asia
QA_SERVICE=shopping-web
QA_NAMESPACE=shop
```

```typescript
// 두 리전에서 같은 코드 실행
// region 차원으로 자동 분리
// 분석: region별 비교, 또는 region 무시하고 전체 집계
```
