---
def:
  id: query-rules
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
---
# 규칙 영속화 (PolicyRule Store)

## 목적 ^purpose

PolicyRule의 CRUD와 충돌 전략을 정의한다. Memory/SQL 어댑터를 지원하며, 여러 서비스가 동일 규칙 집합을 공유한다.

## 구성 ^overview

5개 CRUD: create, get, list, update, delete.
충돌 전략: priority 기반, 같은 priority 시 latest-wins.
어댑터: MemoryRuleStore, SqlRuleStore.
