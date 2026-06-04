# Architecture Definition Operating System

> 이 시스템은 아키텍처 설계 결정을 YAML DSL로 정의하고, Governance 메타데이터로 추적하며, 검증 규칙으로 무결성을 보장하는 **문서 기반 아키텍처 운영체제**이다.

## Directory Structure

```text
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
```

## Naming Rules

| 원칙 | 표현 방식 |
|------|----------|
| 구조 | 폴더 |
| 시간 | 파일명 suffix (`-YYYY-MM-DD`) |
| 현재 활성 상태 | `current.md` (HEAD pointer) |
| 과거 스냅샷 | 날짜 파일 (immutable snapshot) |

## Automation Commands

이 프로젝트는 `archi` CLI를 사용하여 아키텍처와 문서를 관리합니다.
- **문서 검증**: `archi validate`
- **새 문서 생성**: `archi new <doc-type>` (대화형 지원)
- **타임라인 최신화**: `archi timeline`
- **상태 조회**: `archi status`
