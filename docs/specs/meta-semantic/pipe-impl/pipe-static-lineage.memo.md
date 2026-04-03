# 정적 계보 추적 — 결정 메모

## 2026-04-02: self-reference BFS 방지

### 맥락

step-internal 이름 매칭 lineage에서 `target = source` (같은 schemaId:column)가 생성됨.
`traceOriginsStatic` BFS가 자기참조로 종료되어 빈 결과 반환.

### 검토한 대안

| 대안 | 장점 | 단점 |
|------|------|------|
| BFS에 자기참조 감지 추가 | 기존 코드 유지 | 자기참조 ≠ pass-through, 의미 혼동 |
| step-internal 이름매칭 제거, chain에서만 처리 | 명확한 분리 | hints 없는 단일 step은 계보 없음 |

### 결정

step-internal 이름 매칭 제거. chain에서만 이름 매칭 처리. hints 없는 단일 step은 의도적으로 계보 없음.

## 2026-04-02: cross-pipe chain 유지

### 맥락

시뮬레이션 경로에서 `previousProduces`가 pipe 경계를 넘어 체인 생성.
reset 시 기존 multi-pipe 시뮬 테스트 실패.

### 결정

cross-pipe chain 유지 (시뮬 = 실행 순서 기반). 정적 경로는 단일 pipe, graph-level에서 connection 기반으로 별도 처리.

## 2026-04-02: schemaId 해석 통일

### 맥락

정적 경로는 `eventKey ?? facet`, 시뮬 경로는 `accesses` 기반 → schemaId drift.

### 결정

`resolveStepSchemaId` 공유 유틸 추출 (pipe-schema-id.ts). 우선순위: writable accesses > read-only accesses > eventKey > facet > fallback.
