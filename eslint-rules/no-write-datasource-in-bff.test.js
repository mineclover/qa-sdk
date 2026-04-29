"use strict";

// 본 테스트는 ESLint가 글로벌 설정되지 않은 상태에서도 rule 객체 자체를 검증.
// vitest에서 실행 가능 (root에 vitest 설정 없으므로 node:test로도 실행 가능).

const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("./no-write-datasource-in-bff.js");

function runOnFile(filename, importedNames) {
  const reports = [];
  const ctx = {
    getFilename: () => filename,
    filename,
    report: (descriptor) => reports.push(descriptor),
  };
  const visitor = rule.create(ctx);
  if (!visitor.ImportDeclaration) return reports;
  visitor.ImportDeclaration({
    type: "ImportDeclaration",
    specifiers: importedNames.map((name) => ({
      type: "ImportSpecifier",
      imported: { name },
    })),
  });
  return reports;
}

test("rule meta exposes problem type + messageId", () => {
  assert.equal(rule.meta.type, "problem");
  assert.ok(rule.meta.messages.noWriteDataSource);
});

test("BFF path imports WRITE_DATA_SOURCE → 1 report", () => {
  const reports = runOnFile(
    "/repo/services/approval-api/src/approval/budget/presentation/bff/budget-detail.bff.ts",
    ["WRITE_DATA_SOURCE", "BudgetReadModelQuery"],
  );
  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, "noWriteDataSource");
});

test("BFF path imports APPROVAL_REPOSITORY → 1 report", () => {
  const reports = runOnFile(
    "/repo/services/approval-api/src/approval/budget/presentation/bff/budget-detail.bff.ts",
    ["APPROVAL_REPOSITORY"],
  );
  assert.equal(reports.length, 1);
});

test("reporting-api path also enforced", () => {
  const reports = runOnFile(
    "/repo/services/reporting-api/src/queries/foo.ts",
    ["WRITE_DATA_SOURCE"],
  );
  assert.equal(reports.length, 1);
});

test("BFF path imports READ_DATA_SOURCE → 0 reports", () => {
  const reports = runOnFile(
    "/repo/services/approval-api/src/approval/budget/presentation/bff/budget-detail.bff.ts",
    ["READ_DATA_SOURCE"],
  );
  assert.equal(reports.length, 0);
});

test("non-BFF path is ignored entirely (use-case can use WRITE)", () => {
  const reports = runOnFile(
    "/repo/services/approval-api/src/approval/budget/application/use-cases/budget.use-case.ts",
    ["WRITE_DATA_SOURCE", "APPROVAL_REPOSITORY"],
  );
  assert.equal(reports.length, 0);
});
