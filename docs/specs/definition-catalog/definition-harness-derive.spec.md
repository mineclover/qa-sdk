---
def:
  id: definition-harness-derive
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  svc: definition-service
  tags: [tier-system]
  links:
    - target: definition-harness
      type: refines
    - target: definition-state-model
      type: depends_on
    - target: spec-verification-system
      type: depends_on
---
# Harness Derive — 자동 상태 파생

## 목적 ^purpose

문서/코드/테스트의 현재 상태를 분석하여 SPEC_IMPL, CONVENTION 머신의 상태를 자동으로 결정한다. 수동 상태 관리 없이 코드 기반으로 상태를 파생한다.

## 파생 규칙 ^constraint

### SPEC_IMPL 상태 파생

| 조건 | 파생 상태 |
|------|----------|
| frontmatter만 있고 svc 없음 | `designed` |
| svc 있고 코드 디렉토리에 파일 없음 | `designed` |
| svc 있고 코드 존재 | `implemented` |
| svc 있고 코드 존재 + 관련 테스트 통과 | `verified` |
| 문서에 코드 블록 없고 소스 참조만 있음 | `source-referenced` |

판별 입력:
- `svc` 필드 → packages/ 디렉토리 매핑
- `def find-by-file` 역매핑으로 코드 존재 확인
- spec-tracker 증거로 테스트 통과 확인
- 문서 본문에서 코드 블록 vs 소스 참조 패턴 감지

### CONVENTION 상태 파생

| 조건 | 파생 상태 |
|------|----------|
| spec-tracker 증거 0건 | `unverified` |
| spec-tracker coverage < 100% | `partial` |
| spec-tracker coverage = 100% | `compliant` |
| spec-tracker에 failed 증거 있음 | `violated` |

### DOC_LIFECYCLE 상태 파생

frontmatter의 `lifecycle` 필드에서 직접 읽음 — 파생 불필요.

### SYNC 상태 파생

| 조건 | 파생 상태 |
|------|----------|
| def-config.json 없음 | `out-of-sync` |
| config의 documentCount ≠ scan 결과 | `drift-detected` |
| config checksum과 현재 파일 해시 불일치 | `drift-detected` |
| 전부 일치 | `synced` |

## 퍼블릭 API ^api-surface

```typescript
deriveSpecImplState(docId: string, options: DeriveContext): SpecImplState
deriveConventionState(specId: string, collector: SpecCollector): ConventionState
deriveSyncState(config: DefConfig, scanResult: ScanResult): SyncState
deriveAllStates(options: DeriveAllContext): Map<string, StateMachineInstance>
```
