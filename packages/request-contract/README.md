# request-contract

Prompt Template 입력을 실행 및 평가 가능한 Request Contract로 정규화하고,
Execution Runtime의 결과를 Observation Contract로 구조화해 평가하는 순수
TypeScript 라이브러리입니다.

```text
Prompt Template -> Request Contract -> Observation Contract -> Evaluation Result
```

## 책임 경계

- Prompt Template: 사람이 입력한 역할, 맥락, 요청, 출력 형식, 제약, 성공 기준을 슬롯 기반으로 보존한다.
- Request Contract: 계획, 실행, 평가, 재계획이 공유할 작업 기준으로 정규화한다.
- Observation Contract: 산출물, 로그, 오류, 사용 액션, 제약 신호를 평가 가능한 형태로 보존한다.
- Evaluator: Observation Contract를 Request Contract와 비교해 `success`, `partial`, `failure`, `blocked`를 판정한다.

## 사용 예시

```ts
import {
  createRequestContract,
  evaluateObservation,
  normalizePromptTemplate,
} from "request-contract";

const template = normalizePromptTemplate({
  id: "package-work",
  role: "senior engineer",
  request: "Request Contract 패키지를 만든다.",
  successCriteria: ["테스트가 통과한다."],
});

const contract = createRequestContract(template);
const result = evaluateObservation(contract, {
  id: "obs-1",
  completed: true,
  logs: ["테스트가 통과한다."],
});
```
