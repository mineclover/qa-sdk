# AI Development Mandates — qa-sdk

이 문서는 AI 에이전트가 본 프로젝트에서 개발 및 변경을 수행할 때 반드시 준수해야 하는 기술적 가이드라인을 정의합니다.

## 🔄 AI Feedback Loop (실시간 영향도 피드백)

모든 AI 에이전트는 유의미한 코드 변경(논리 수정, 패키지 추가, API 변경 등)을 수행한 후, 반드시 다음 명령을 실행하여 시스템 영향을 자가 진단해야 합니다.

```bash
pnpm arch:feedback
```

### 피드백 루프의 구성
1.  **Lint Check**: 문법 오류 및 스타일 위반 즉시 탐지.
2.  **Architectural Boundaries**: 5계층(Foundation → ... → Consumer) 의존성 원칙 위반 여부 검사.
3.  **API Impact Analysis**: 수정된 파일이 어떤 OpenAPI 엔드포인트에 영향을 주며, 이를 사용하는 소비자(Scenario 등)가 어디인지 역추적.

## 🛡️ 아키텍처 원칙

1.  **단방향 의존성**: 하위 계층은 상위 계층을 절대 참조할 수 없습니다. (Violation 발견 시 즉시 리팩토링)
2.  **스펙 우선 (Spec-First)**: 모든 API 변경은 `oa-sdk`의 OpenAPI 스펙과 동기화되어야 합니다.
3.  **경계 명시**: 신규 패키지나 모듈 생성 시 `index.ts` 상단에 `@def.boundary` 및 `@def.doc` 태그를 반드시 명시합니다.

## 📝 메모리 및 상태 관리

- 작업 완료 후에는 `PENDING_WORK.md`를 최신화하여 현재 시스템의 'Known-Good State'와 잔여 부채(TD)를 명확히 기록합니다.
- 아키텍처 결정 사항은 `archi new session`을 통해 공식 거버넌스 이력으로 남깁니다.
