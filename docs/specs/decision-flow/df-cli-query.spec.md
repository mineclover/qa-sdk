---
def:
  id: df-cli-query
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  svc: qa-sdk-cli
  tags: [decision, cli]
  links:
    - target: df-cli-persistence
      type: depends_on
    - target: df-system
      type: implements
---
# CLI 의사결정 조회 명령

## 목적 ^purpose

`flow lookup/history/verdict/judge` 4개 CLI 명령으로 의사결정 이력을 조회하고 판정을 기록한다. SQLite에서 세션 간 영속된 데이터를 읽는다.

## 구성 ^overview

- **flow lookup \<keyword\>**: context 값 + schemaId로 키워드 검색. 관련 정책, 의사결정 단위 표시
- **flow history [schema-id]**: 완료된 인스턴스 이력 (최신순, 소요 시간 포함)
- **flow verdict \<instance-id\>**: 여정(gate별 선택+근거+소요시간) + 의사결정 단위(주제/목적/기준) + 판정 상태
- **flow judge \<instance-id\>**: 성공 기준별 충족 여부 입력 → verdict 영속. 중복 판정 차단
