---
def:
  id: registry-services-api-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: registry-data-model
      type: depends_on
---

# Services API

## 목적 ^purpose

서비스 디스커버리에 쓰이는 서비스 메타데이터를 등록, 조회, 수정하는 Registry API 계약과 검증 범위를 정의한다.

## 상태

implemented

## 엔드포인트

### POST /services

서비스 생성.

요청:
```json
{
  "service_name": "checkout_web",
  "description": "Checkout web application",
  "owner": "team-checkout"
}
```

응답 201: 생성된 ServiceEntry.

### GET /services/:serviceName

서비스명으로 조회.

응답 200: ServiceEntry.
응답 404: 서비스 없음.

### PATCH /services/:serviceId

서비스 수정.

요청: 변경할 필드만 포함.
응답 200: 수정된 ServiceEntry.

## 내부 구조

- `ServiceService` — 비즈니스 로직
- `ServiceRepository` — 데이터 접근
- `createServiceSchema` / `updateServiceSchema` — Zod 검증

## 제약 조건

- `service_name`은 unique
- serviceId는 내부 생성 (클라이언트 지정 불가)
