---
def:
  id: payment-data
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: payment
  tags: [tier-backend]
  links:
    - target: payment-service-spec
      type: refines
---
# Payment — data/domain_data

## 목적 ^purpose

결제 트랜잭션 데이터. 결제 상태, 환불, 정산 레코드.
