// 거버넌스 문서 템플릿 레지스트리

export interface DocumentMetadata {
  id: string;
  title: string;
  date: string;
  scope?: string;
  tags?: string[];
  refs?: string[];
}

export interface DocumentTemplate {
  type: string;
  name: string;
  description: string;
  generateFrontmatter: (meta: DocumentMetadata) => string;
  generateBody: (meta: DocumentMetadata) => string;
}

export const TEMPLATE_REGISTRY: Record<string, DocumentTemplate> = {
  roadmap: {
    type: 'RoadmapDocument',
    name: 'Roadmap Document',
    description: '목표, 범위, 마일스톤을 기술하는 로드맵 문서',
    generateFrontmatter: (meta) => `---
id: ${meta.id}
type: RoadmapDocument
title: "${meta.title}"
date: ${meta.date}
lifecycle:
  state: active
  created_at: ${meta.date}
  updated_at: ${meta.date}
tags: ${JSON.stringify(meta.tags || ['roadmap'])}
refs: ${JSON.stringify(meta.refs || [])}
---`,
    generateBody: (meta) => `# Roadmap: ${meta.title}

## 목적 ^purpose
이 로드맵은 아키텍처 발전을 위한 주요 마일스톤과 목표를 명확히 정의합니다.

## 1. 비전 및 목표
* 비전: 아키텍처 현대화 및 안정적 운영 체계 구축
* 단기 목표: 거버넌스 CLI 구축 및 검증 자동화 완비
* 장기 목표: 분산 관측 인프라 통합

## 2. 주요 마일스톤
- [ ] Phase 1: 아키텍처 정의 CLI ('archi') 뼈대 구현 및 \\\`init\\\`/\\\`new\\\` 탑재
- [ ] Phase 2: 검증기 포팅 및 \\\`validate\\\`/\\\`timeline\\\` 연동
- [ ] Phase 3: 다양한 서브 프로젝트 적용 및 피드백 반영
`,
  },

  prd: {
    type: 'PRDDocument',
    name: 'Product Requirement Document (PRD)',
    description: '요구사항, 검증 기준, 산출물을 정의하는 사양 문서',
    generateFrontmatter: (meta) => `---
id: ${meta.id}
type: PRDDocument
title: "${meta.title}"
date: ${meta.date}
scope: ${meta.scope || 'SCOPE-DSL'}
lifecycle:
  state: active
  created_at: ${meta.date}
  updated_at: ${meta.date}
tags: ${JSON.stringify(meta.tags || ['prd'])}
refs: ${JSON.stringify(meta.refs || [])}
---`,
    generateBody: (meta) => `# PRD: ${meta.title}

## 목적 ^purpose
이 사양 문서는 ${meta.scope || 'SCOPE-DSL'} 범위 하위 요구사항 및 구현 스펙을 정의합니다.

## 1. 핵심 요구사항
* R-1: 아키텍처 문서화 폴더 구조를 초기화하는 기능 지원.
* R-2: 명명 규칙과 시퀀스(NNN) 자동 추적을 포함하는 템플릿 문서 생성.
* R-3: JSON Schema 및 14가지 의미적 규칙을 완전히 보장하는 검증.

## 2. 검증 기준 (Verification Criteria)
* VC-1: \\\`archi validate\\\` 통과율 100% 만족.
* VC-2: 타임라인에 누락된 세션 문서가 없는지 여부 확인.
`,
  },

  progress: {
    type: 'ProgressDocument',
    name: 'Progress Document',
    description: '진행 현황, 차단 요소, 다음 행동을 추적하는 진척 보고 문서',
    generateFrontmatter: (meta) => `---
id: ${meta.id}
type: ProgressDocument
title: "${meta.title}"
date: ${meta.date}
lifecycle:
  state: active
  created_at: ${meta.date}
  updated_at: ${meta.date}
tags: ${JSON.stringify(meta.tags || ['progress'])}
refs: ${JSON.stringify(meta.refs || [])}
---`,
    generateBody: (meta) => `# Progress: ${meta.title}

## 목적 ^purpose
아키텍처 변경 스프린트 진행 상황 및 당면 과제를 보고하고 추적합니다.

## 1. 진행 현황 (Current Status)
- [x] CLI 프로젝트 스캐폴딩 생성 완료.
- [ ] Core 검증 엔진 포팅 작업 진행 중.

## 2. 차단 요소 (Blockers)
* 없음.

## 3. 다음 행동 (Next Actions)
- [ ] Commander CLI 연동 및 빌드 테스트 완료.
- [ ] 대화형 문서 생성 로직 정교화.
`,
  },

  session: {
    type: 'SessionHistoryDocument',
    name: 'Session History Document',
    description: '개별 설계 세션의 의사결정 및 변경 요약을 기록하는 문서',
    generateFrontmatter: (meta) => `---
id: ${meta.id}
type: SessionHistoryDocument
title: "${meta.title}"
date: ${meta.date}
lifecycle:
  state: resolved
  created_at: ${meta.date}
  resolved_at: ${meta.date}
tags: ${JSON.stringify(meta.tags || ['session'])}
refs: ${JSON.stringify(meta.refs || [])}
---`,
    generateBody: (meta) => `# Session: ${meta.title}

## 목적 ^purpose
${meta.date} 설계 세션에서 도출된 핵심 설계 의사결정과 향후 일감을 영구적으로 기록합니다.

## 1. 개요 (Overview)
* 일시: ${meta.date}
* 참석자: AI Agent, User
* 의제: 거버넌스 CLI 플랫폼 개발 착수 및 템플릿 정렬

## 2. 핵심 결정사항 (Key Decisions)
* **결정 1**: \\\`archi-cli\\\` 패키지를 \\\`packages/archi\\\`로 신설하고 독립 배포 가능하도록 설계함.
* **결정 2**: \\\`validate.mjs\\\` 검증기를 TS 모듈로 포팅하여 내장함으로써 이식성 극대화.

## 3. 액션 아이템 (Action Items)
- [ ] \\\`packages/archi\\\` 패키지 내 스크립트 빌드 및 로컬 실행 권한 테스트.
- [ ] \\\`archi timeline\\\` 수집 명령 작동 확인.
`,
  },

  handoff: {
    type: 'HandoffDocument',
    name: 'Handoff Document',
    description: '현재 작업의 요약 상태와 다음 주체(인간 또는 AI)의 재개 지침',
    generateFrontmatter: (meta) => `---
id: ${meta.id}
type: HandoffDocument
title: "${meta.title}"
date: ${meta.date}
lifecycle:
  state: active
  created_at: ${meta.date}
  updated_at: ${meta.date}
tags: ${JSON.stringify(meta.tags || ['handoff'])}
refs: ${JSON.stringify(meta.refs || [])}
---`,
    generateBody: (meta) => `# Handoff: ${meta.title}

## 목적 ^purpose
이 핸드오프 문서는 현 세션의 최종 진행 성과와 다음 세션에서 신속하게 작업을 시작할 수 있는 지침을 제공합니다.

## Next Recommended Actions
* [ ] \\\`archi validate\\\` 명령을 통해 템플릿들의 정합성 전수 확인.
* [ ] \\\`archi init\\\`를 적용하여 보편적인 개발 시나리오 확인.

## 1. 작업 요약 (State Summary)
* **진행 완료**: \\\`packages/archi\\\` 스캐폴드 설치 및 템플릿 레지스트리 작성 완료.
* **이슈 사항**: 없음.
`,
  },

  timeline: {
    type: 'TimelineDocument',
    name: 'Timeline Document',
    description: '시간순 이벤트와 결정을 추적하는 Append-Only 리스트',
    generateFrontmatter: (meta) => `---
id: GOV-TIMELINE
type: TimelineDocument
title: "Architecture Governance Timeline"
date: ${meta.date}
lifecycle:
  state: active
  created_at: ${meta.date}
  updated_at: ${meta.date}
---`,
    generateBody: (meta) => `# Architecture Governance Timeline

## 목적 ^purpose
아키텍처 설계와 관련된 모든 세션의 기록을 시간순으로 나열하여, 아키텍처가 언제 어떤 흐름으로 발전해 왔는지 역사적 흐름을 보장합니다.

## Timeline Events

## ${meta.date}
* [${meta.id}] ${meta.title}
`,
  },

  historyIndex: {
    type: 'HistoryIndexDocument',
    name: 'History Index Document',
    description: '압축된 아키텍처 결정 사항 및 중요 마일스톤 문서 색인',
    generateFrontmatter: (meta) => `---
id: GOV-HISTORY-INDEX
type: HistoryIndexDocument
title: "Architecture History Index"
date: ${meta.date}
lifecycle:
  state: active
  created_at: ${meta.date}
  updated_at: ${meta.date}
---`,
    generateBody: (meta) => `# Architecture History Index

## 목적 ^purpose
로드맵 단계별 성과를 압축 수렴하고, 핵심적인 결정 사항 및 핵심 파일 포인터를 제공합니다.

### Key Decisions
* **DEC-001**: 아키텍처 문서화 거버넌스 시스템 v0.1 정의 및 이의 CLI 자동화 결정.

### Important Files
* [archi-adr.yaml](file:///Users/junwoobang/workflow/qa-sdk/architecture/model/archi-adr.yaml) — 아키텍처 DSL SSOT
* [validate.mjs](file:///Users/junwoobang/workflow/qa-sdk/architecture/validation/validate.mjs) — 아키텍처 검증기
`,
  },
};
