---
def:
  id: meta-semantic-ir-usecases
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [entry-point]
  links:
    - target: meta-semantic-ir
      type: refines
    - target: meta-semantic-ir-rule
      type: depends_on
---

# Meta-Semantic IR — Use Cases

## 목적 ^purpose

IR 시스템의 구체적 사용 시나리오를 정의한다. 각 시나리오에서 어떤 함수를 호출하고, 어떤 검증을 실행하고, 어떤 결과를 기대하는지를 명시한다.

---

## UC-1: 신규 모듈 등록

**상황**: 새 서비스 모듈을 IR 그래프에 추가.

**입력**: 소스 코드 파일 → ParserPort → LLM 판정

**흐름**:
```
1. runExtractionPipeline([file], parser, llm)
   → ExecutionUnit[] (testable 함수 목록 + 분기 그래프)

2. pipeGraphToModuleIR(graph)
   → ModuleIR[] (계층 구조 자동 생성)

3. validateIRGraph({ modules, data, pipes })
   → IRIssue[] (dangling-ref, orphan 확인)

4. auditIRGraph(graph)
   → AuditIssue[] (level 일치, certainty 일치, 분할 신호)
```

**기대 결과**:
- error 0건 → 등록 성공
- `level-mismatch` → `inferModuleLevel`로 자동 교정
- `too-many-inputs` → 분할 검토 안내

**검증 코드**: `ir-scenario.test.ts` "PipeGraph → IR 변환"

---

## UC-2: 데이터 스키마 변경 영향 분석

**상황**: DataIR의 필드가 변경될 때 영향받는 모듈/파이프를 추적.

**입력**: 변경된 FieldDescriptor[]

**흐름**:
```
1. computeSchemaHash(newFields)
   → 새 해시 계산

2. 기존 DataIR.definition.schemaHash와 비교
   → 해시 불일치 = 스키마 변경

3. validateIRGraph(graph)
   → 변경된 DataRef를 참조하는 ModuleIR.interface.inputs/outputs 추적
   → 영향받는 PipeIR.payload 추적

4. auditIRGraph(graph)
   → schema-collision 확인 (다른 타입이지만 같은 해시 → 의도 확인)
```

**기대 결과**:
- 영향받는 모듈 목록 + 파이프 목록
- hash-mismatch → 스키마 갱신 필요
- schema-collision → alias 의도 확인

**검증 코드**: `ir-validate.test.ts` "schema-collision", `ir-audit.test.ts` "hash-mismatch"

---

## UC-3: 분기 경로 좌표 할당

**상황**: 함수의 분기 구조를 좌표화하여 Spacetime UID 부여.

**입력**: ExecutionUnit (분기 그래프 포함)

**흐름**:
```
1. countExecutionPaths(unit)
   → 총 경로 수 (sum 모델)

2. buildSegments(paths)
   → IntentPathSegment[] (오프셋 자동 계산)

3. encodePathAddress(segment, coord)
   → 전역 주소

4. createSpacetimeUID(functionIndex, pathAddress, txSeq)
   → "intent:v1:F:P:T"
```

**기대 결과**:
- 모든 주소가 유일 (전체 공간 순회로 검증)
- encode → decode 라운드트립 성공
- 도달 불가능한 주소 없음 (sum 모델)

**검증 코드**: `spacetime-uid.test.ts` "전체 주소 공간 순회"

---

## UC-4: Nesting ↔ IR 교차 검증

**상황**: ScopeNesting 계약과 IR 모듈 계층이 일치하는지 검증.

**입력**: ScopeNesting + IRGraph

**흐름**:
```
1. validateScopeNesting(nesting)
   → NestingIssue[] (missing-provider, override-no-parent 등)

2. validateIRGraph(graph)
   → IRIssue[] (dangling-ref 등)

3. crossValidate(nesting, graph, { nestingResult, irIssues })
   → CrossValidationIssue[]
   → scope-without-module, provides-without-output, consumes-without-input 탐지
```

**기대 결과**:
- nesting.provides ↔ module.outputs 매핑 일치
- nesting.consumes ↔ module.inputs 매핑 일치
- missing-provider(nesting) + dangling-ref(IR) = 같은 문제의 다른 관점

**검증 코드**: `ir-nesting-bridge.test.ts`, `ir-rule-validation.test.ts` "동시 발생"

---

## UC-5: 코드 추출 파이프라인 (LLM 기반)

**상황**: 소스 코드에서 검증 가능한 실행 단위를 자동 식별.

**입력**: TypeScript 소스 파일 목록

**흐름**:
```
1. parser.parseFile(filePath, source)
   → FileStructure (함수, 조건문, 타입, import)

2. llm.judge({ kind: "testability", ... })
   → 독립 테스트 가능 여부 판정

3. llm.judge({ kind: "branch-significance", ... })
   → 의미 있는 분기 판별 (null 체크, 에러 핸들링 제외)

4. countExecutionPaths(unit)
   → 경로 수 합산

5. summarizeExtraction(units, files, functions)
   → ExtractionResult (통계 + 평균 confidence)
```

**기대 결과**:
- testable 함수만 식별 (getter/setter/헬퍼 제외)
- 의미 없는 분기 필터링 (null 체크, try/catch)
- ^intent 마커가 있으면 confidence 상승
- 분기 없는 함수 → totalPaths = 1

**검증 코드**: `extraction-pipeline.test.ts` "전체 흐름"

---

## UC-6: 모듈 분할 판정

**상황**: 기존 모듈이 비대해져서 분할이 필요한지 판단.

**입력**: IRGraph

**흐름**:
```
1. auditIRGraph(graph)
   → split-signal 카테고리 이슈:
     too-many-inputs (>5)
     too-many-outputs (>3)
     too-many-children (>7)
     mixed-certainty (strict + flexible 공존)
     shared-data (3+ 모듈이 공유)

2. 분할 실행 (수동)
   → 새 중간 module 삽입 또는 leaf 분리

3. validateIRGraph(newGraph)
   → 분할 후 참조 무결성 확인

4. crossValidate(nesting, newGraph)
   → nesting ↔ IR 정합성 재확인
```

**기대 결과**:
- 분할 전: split-signal info/warning
- 분할 후: split-signal 0건, error 0건
- 주소 공간 불변 (기존 Spacetime UID 유지)

**검증 코드**: `ir-audit.test.ts` "split-signal", `ir-rule-validation.test.ts` "분할 후 검증 순서"

---

## UC-7: Prefix 표식 검증 (drift check)

**상황**: 카탈로그 변경 후 코드의 @prefix 스탬프가 최신인지 확인.

**입력**: 코드 파일 + Catalog

**흐름**:
```
1. prefixDrift(catalog, paths)
   → DriftResult[] (index-mismatch, version-behind, unknown-prefix 등)

2. dkg version activate <prefix> <version>
   → 자동 prefixDrift() 실행 (hook)

3. prefixStamp(catalog, { update: true })
   → 기존 스탬프를 최신 카탈로그 기준으로 갱신
```

**기대 결과**:
- index 불일치 → error (사일런트 브레이킹 감지)
- version 뒤처짐 → warning (마이그레이션 안내)
- 갱신 후 drift 0건

**검증 코드**: `prefix-stamp.test.ts` "drift" 패싯

---

## Use Case 매트릭스

| UC | 핵심 함수 | 검증 포인트 | 테스트 파일 |
|:--:|----------|-----------|-----------|
| 1 | `pipeGraphToModuleIR`, `validateIRGraph` | error 0건 | ir-scenario |
| 2 | `computeSchemaHash`, `auditIRGraph` | hash-mismatch, collision | ir-audit |
| 3 | `buildSegments`, `encodePathAddress`, `createSpacetimeUID` | 라운드트립 | spacetime-uid |
| 4 | `crossValidate` | scope↔module 매핑 | ir-nesting-bridge |
| 5 | `runExtractionPipeline` | testable 판정 + 분기 필터 | extraction-pipeline |
| 6 | `auditIRGraph` → split-signal | 분할 전후 차이 | ir-audit, ir-rule-validation |
| 7 | `prefixDrift`, `prefixStamp` | drift 0건 | prefix-stamp |
