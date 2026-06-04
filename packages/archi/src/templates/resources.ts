// 아키텍처 정의 OS v0.1 기본 리소스 파일

export const README_TEMPLATE = `# Architecture Definition Operating System

> 이 시스템은 아키텍처 설계 결정을 YAML DSL로 정의하고, Governance 메타데이터로 추적하며, 검증 규칙으로 무결성을 보장하는 **문서 기반 아키텍처 운영체제**이다.

## Directory Structure

\`\`\`text
architecture/
├─ README.md                          ← 이 파일
├─ model/
│  └─ archi-adr.yaml                  ← SSOT: 전체 모델 정의
├─ docs/
│  ├─ architecture/                   ← 아키텍처 문서
│  ├─ rules/                          ← 규칙 문서
│  ├─ adr/                            ← Architecture Decision Records
│  ├─ business/                       ← BusinessLogicDocument
│  ├─ metadata/                       ← MetadataDefinitionDocument
│  └─ governance/                     ← Governance 메타데이터
│     ├─ roadmap/current.md           ← 로드맵 (HEAD)
│     ├─ prd/current.md               ← PRD (HEAD)
│     ├─ progress/current.md          ← 진행 상태 (HEAD)
│     ├─ handoff/current.md           ← 핸드오프 (HEAD)
│     ├─ sessions/                    ← 세션 기록 (sessions/YYYY/MM/)
│     ├─ timeline.md                  ← 시간순 원본 포인터
│     └─ history-index.md             ← 압축 히스토리 색인
├─ validation/
│  ├─ schema.json                     ← JSON Schema 2020-12
│  └─ semantic-rules.yaml             ← 의미적 검증 규칙
└─ generated/
   ├─ mermaid/                        ← Mermaid 다이어그램 출력
   ├─ reports/                        ← 보고서 출력
   └─ exports/                        ← 내보내기 출력
\`\`\`

## Naming Rules

| 원칙 | 표현 방식 |
|------|----------|
| 구조 | 폴더 |
| 시간 | 파일명 suffix (\`-YYYY-MM-DD\`) |
| 현재 활성 상태 | \`current.md\` (HEAD pointer) |
| 과거 스냅샷 | 날짜 파일 (immutable snapshot) |

## Automation Commands

이 프로젝트는 \`archi\` CLI를 사용하여 아키텍처와 문서를 관리합니다.
- **문서 검증**: \`archi validate\`
- **새 문서 생성**: \`archi new <doc-type>\` (대화형 지원)
- **타임라인 최신화**: \`archi timeline\`
- **상태 조회**: \`archi status\`
`;

export const SCHEMA_JSON = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://qa-sdk.dev/architecture/governance-frontmatter",
  "title": "Governance Document Frontmatter",
  "description": "JSON Schema for validating governance document frontmatter in the Architecture Definition Operating System",
  "type": "object",
  "required": ["id", "type", "title", "date", "lifecycle"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^GOV-(ROADMAP|PRD|PROGRESS|SESSION|HANDOFF|TIMELINE|HISTORY-INDEX)-[0-9]{8}(-[0-9]{3})?$",
      "description": "Unique governance document identifier"
    },
    "type": {
      "type": "string",
      "enum": [
        "RoadmapDocument",
        "PRDDocument",
        "ProgressDocument",
        "SessionHistoryDocument",
        "HandoffDocument",
        "TimelineDocument",
        "HistoryIndexDocument"
      ],
      "description": "Governance document type"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Human-readable document title"
    },
    "date": {
      "type": "string",
      "format": "date",
      "description": "Document date in YYYY-MM-DD format"
    },
    "scope": {
      "type": "string",
      "pattern": "^SCOPE-[A-Z]+(-[A-Z]+)*$",
      "description": "Scope Unit reference"
    },
    "lifecycle": {
      "type": "object",
      "required": ["state"],
      "properties": {
        "state": {
          "type": "string",
          "enum": ["draft", "active", "resolved", "deprecated", "archived"],
          "description": "Current lifecycle state"
        },
        "created_at": {
          "type": ["string", "null"],
          "description": "Creation date"
        },
        "updated_at": {
          "type": ["string", "null"],
          "description": "Last update date"
        },
        "resolved_at": {
          "type": ["string", "null"],
          "description": "Resolution date"
        },
        "archived_at": {
          "type": ["string", "null"],
          "description": "Archive date"
        }
      }
    },
    "refs": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "References to related files"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Classification tags"
    }
  },
  "allOf": [
    {
      "if": {
        "properties": { "type": { "const": "SessionHistoryDocument" } }
      },
      "then": {
        "properties": {
          "id": {
            "pattern": "^GOV-SESSION-[0-9]{8}-[0-9]{3}$"
          }
        }
      }
    },
    {
      "if": {
        "properties": { "type": { "const": "TimelineDocument" } }
      },
      "then": {
        "properties": {
          "id": {
            "pattern": "^GOV-TIMELINE$"
          }
        }
      }
    },
    {
      "if": {
        "properties": { "type": { "const": "HistoryIndexDocument" } }
      },
      "then": {
        "properties": {
          "id": {
            "pattern": "^GOV-HISTORY-INDEX$"
          }
        }
      }
    }
  ]
}`;

export const SEMANTIC_RULES_YAML = `# =============================================================================
# Semantic Validation Rules
# Architecture Definition Operating System v0.1
# =============================================================================

rules:
  - id: SR-001
    name: unique-current
    category: governance/structure
    description: governance/current.md는 각 영역별 하나만 존재해야 한다.
    severity: error
    automatable: true

  - id: SR-003
    name: session-timeline-registration
    category: governance/content
    description: SessionHistoryDocument는 timeline.md에 반드시 등록되어야 한다.
    severity: error
    automatable: true

  - id: SR-004
    name: handoff-next-actions
    category: governance/content
    description: HandoffDocument는 Next Recommended Actions를 가져야 한다.
    severity: error
    automatable: true

  - id: SR-005
    name: history-index-completeness
    category: governance/content
    description: HistoryIndexDocument는 주요 결정과 중요 파일 목록을 가져야 한다.
    severity: error
    automatable: true

  - id: SR-010
    name: timeline-append-only
    category: governance/content
    description: TimelineDocument는 시간순 append-only로 관리한다.
    severity: error
    automatable: true

  - id: SR-006
    name: active-current-alignment
    category: governance/lifecycle
    description: active 상태 문서는 current.md 또는 current.md가 참조하는 문서여야 한다.
    severity: warning
    automatable: true

  - id: SR-011
    name: scope-reference-valid
    category: governance/lifecycle
    description: scope 필드는 정의된 Scope Unit을 참조해야 한다.
    severity: error
    automatable: true

  - id: SR-013
    name: relation-source-target-valid
    category: model/integrity
    description: 모든 Relation의 source/target은 유효한 Element ID여야 한다.
    severity: error
    automatable: true

  - id: SR-014
    name: view-element-exists
    category: model/integrity
    description: View가 참조하는 모든 Element/Relation이 존재해야 한다.
    severity: error
    automatable: true
`;

export const MODEL_YAML_TEMPLATE = `# =============================================================================
# Archi-ADR DSL Model — v0.1
# Architecture Definition Operating System
# =============================================================================

meta:
  id: archi-adr-v0.1
  name: Core Architecture Model
  version: 0.1.0
  created_at: 2026-05-27
  updated_at: 2026-05-27
  description: |
    이 프로젝트의 아키텍처 모델 정의.

scopes:
  - id: SCOPE-DSL
    name: DSL Definitions
    description: YAML DSL 모델 정의
  - id: SCOPE-GOVERNANCE
    name: Governance Layer
    description: 아키텍처 거버넌스 메타데이터

document_types:
  governance:
    - RoadmapDocument
    - PRDDocument
    - ProgressDocument
    - SessionHistoryDocument
    - HandoffDocument
    - TimelineDocument
    - HistoryIndexDocument

lifecycle:
  states:
    - id: draft
      description: 작성 중
    - id: active
      description: 현재 유효
    - id: resolved
      description: 완료/해결됨
    - id: deprecated
      description: 더 이상 권장하지 않음
    - id: archived
      description: 현재 맥락에서 제외된 보관 상태

naming_rules:
  principles:
    - "구조 = 폴더"
    - "시간 = 파일명 suffix"
    - "current.md = 현재 활성 상태 (HEAD pointer)"
    - "날짜 파일 = immutable snapshot"
  patterns:
    roadmap: "roadmap-YYYY-MM-DD.md"
    prd: "{scope}-prd-YYYY-MM-DD.md"
    progress: "progress-YYYY-MM-DD.md"
    handoff: "handoff-YYYY-MM-DD.md"
    session: "session-YYYY-MM-DD-NNN.md"

elements:
  - id: CORE-001
    type: Concept
    name: CoreSystem
    description: 핵심 비즈니스 아키텍처 시스템 요소

relations: []

views: []
`;
