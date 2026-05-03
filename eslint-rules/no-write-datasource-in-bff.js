"use strict";

/**
 * spec 04-scaling-infra.md §4.3 — BFF 슬라이스가 write DataSource를 import하면 lint error.
 *
 * 매칭 조건:
 *   - 파일 경로가 `presentation/bff/` 또는 `reporting-api/`를 포함
 *   - 그 파일에서 `WRITE_DATA_SOURCE`, `APPROVAL_REPOSITORY` 등의 write-tier 토큰 import
 *
 * 위반 시 메시지:
 *   "BFF/reporting slice may not import write DataSource (spec 04 §4.3)"
 *
 * 반대 방향(reporting/bff에서 READ_DATA_SOURCE는 OK)은 허용한다 — 이 rule은
 * write 침범만 차단하고, runtime read-only enforcement는 PG role 권한이 담당한다.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "BFF/reporting slice may not import write DataSource",
      recommended: true,
    },
    schema: [],
    messages: {
      noWriteDataSource:
        "BFF/reporting slice may not import write DataSource (spec 04-scaling-infra.md §4.3). Use READ_DATA_SOURCE instead.",
    },
  },
  create(context) {
    const filename =
      typeof context.getFilename === "function"
        ? context.getFilename()
        : context.filename || "";
    const inBff = /\/(presentation\/bff|reporting-api)\//.test(filename);
    if (!inBff) return {};
    // 테스트 파일은 architectural invariant 검증을 위해 두 토큰 모두 import 필요 — runtime 가드 scope 외.
    if (/\.(test|spec)\.tsx?$/.test(filename)) return {};

    const FORBIDDEN_NAMES = new Set([
      "WRITE_DATA_SOURCE",
      "APPROVAL_REPOSITORY",
    ]);

    return {
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            FORBIDDEN_NAMES.has(spec.imported.name)
          ) {
            context.report({ node: spec, messageId: "noWriteDataSource" });
          }
        }
      },
    };
  },
};
