// 단계 8(Plan C) + 단계 13(Plan E): repo-wide ESLint flat config —
// BFF/reporting CQRS 정적 가드 rule 등록.
//
// spec 04-scaling-infra.md §4.3 — "BFF 모듈에서 write DataSource를 import → 정적 lint 에러".
// spec 05-error-and-scenarios.md §4 — "read DataSource로 INSERT/UPDATE/DELETE 호출 없음".
//
// 사용:
//   pnpm exec eslint simulations/enterprise-pm/services/approval-api/src
//
// CI gate에 통합 전이라 silent skip — `pnpm lint` 미정의이면 본 config는 활성화되지 않는다.

import noWriteDataSourceInBff from "./eslint-rules/no-write-datasource-in-bff.js";
import noWriteCallOnReadDatasource from "./eslint-rules/no-write-call-on-read-datasource.js";

const sliceWritePolicy = {
  plugins: {
    "qa-sdk-sim": {
      rules: {
        "no-write-datasource-in-bff": noWriteDataSourceInBff,
        "no-write-call-on-read-datasource": noWriteCallOnReadDatasource,
      },
    },
  },
  files: [
    "simulations/enterprise-pm/services/**/presentation/bff/**/*.ts",
    "simulations/enterprise-pm/services/reporting-api/**/*.ts",
  ],
  rules: {
    "qa-sdk-sim/no-write-datasource-in-bff": "error",
    "qa-sdk-sim/no-write-call-on-read-datasource": "error",
  },
};

export default [sliceWritePolicy];
