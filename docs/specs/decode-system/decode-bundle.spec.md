---
def:
  id: decode-bundle
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: meta-registry-spec
      type: depends_on
---
# DecodeMap 번들 관리

## 목적 ^purpose

decode에 필요한 최소 데이터(entity name → ID 매핑)를 DecodeMap 번들로 패키징하고, 캐시/갱신을 관리한다. 전체 MetaRegistry 대신 필요한 prefix의 DecodeMap만 로드한다.
