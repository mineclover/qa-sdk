// 단계 8(Plan C): repo-wide ESLint flat config — BFF/reporting write-import 차단 rule만 등록.
// 본 config는 도입 단계라 다른 rule은 추가하지 않는다 (후속 plan에서 확장).
//
// spec 04-scaling-infra.md §4.3 — "BFF 모듈에서 write DataSource를 import → 정적 lint 에러".
//
// 사용:
//   pnpm exec eslint simulations/enterprise-pm/services/approval-api/src
//
// CI gate에 통합 전이라 silent skip — `pnpm lint` 미정의이면 본 config는 활성화되지 않는다.

import noWriteDataSourceInBff from "./eslint-rules/no-write-datasource-in-bff.js";

const sliceWritePolicy = {
  plugins: {
    "qa-sdk-sim": {
      rules: {
        "no-write-datasource-in-bff": noWriteDataSourceInBff,
      },
    },
  },
  files: [
    "simulations/enterprise-pm/services/**/presentation/bff/**/*.ts",
    "simulations/enterprise-pm/services/reporting-api/**/*.ts",
  ],
  rules: {
    "qa-sdk-sim/no-write-datasource-in-bff": "error",
  },
};

export default [sliceWritePolicy];
