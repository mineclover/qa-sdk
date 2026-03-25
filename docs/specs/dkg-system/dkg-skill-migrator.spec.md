---
def:
  id: dkg-skill-migrator
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [migration]
---
# inferMigrator — 마이그레이션 추론

## 목적 ^purpose

축/prefix 변경 시 필요한 마이그레이션 경로를 자동 추론하는 skill. capacity 변경, entry 추가/제거, 버전 전환에 필요한 변환 함수를 생성한다.
