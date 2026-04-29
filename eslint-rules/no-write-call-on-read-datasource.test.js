"use strict";

// 본 테스트는 ESLint가 글로벌 설정되지 않은 상태에서도 rule 객체 자체를 검증.
// node:test 기반 — 기존 `no-write-datasource-in-bff.test.js` 와 동일 스타일.

const test = require("node:test");
const assert = require("node:assert/strict");
const rule = require("./no-write-call-on-read-datasource.js");

function makeContext() {
  const reports = [];
  const ctx = {
    report: (descriptor) => reports.push(descriptor),
    getFilename: () => "/repo/file.ts",
    filename: "/repo/file.ts",
  };
  return { ctx, reports };
}

function makeIdent(name) {
  return { type: "Identifier", name };
}

function visit(visitor, node) {
  const handler = visitor[node.type];
  if (handler) handler(node);
}

test("rule meta exposes problem type + messageId", () => {
  assert.equal(rule.meta.type, "problem");
  assert.ok(rule.meta.messages.writeCallOnReadDatasource);
});

test("import { readRepository } from '@qa-sdk-sim/foo-read-datasource' + readRepository.save → 1 report", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  // import { readRepository } from "@qa-sdk-sim/foo-read-datasource";
  visit(visitor, {
    type: "ImportDeclaration",
    source: { value: "@qa-sdk-sim/foo-read-datasource" },
    specifiers: [
      {
        type: "ImportSpecifier",
        local: makeIdent("readRepository"),
      },
    ],
  });
  // await readRepository.save(entity);
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("readRepository"),
      property: makeIdent("save"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 1);
  assert.equal(reports[0].messageId, "writeCallOnReadDatasource");
  assert.equal(reports[0].data.method, "save");
});

test("renamed import (read as r) + r.insert → 1 report", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  visit(visitor, {
    type: "ImportDeclaration",
    source: { value: "@qa-sdk-sim/budget-read-datasource" },
    specifiers: [
      {
        type: "ImportSpecifier",
        local: makeIdent("r"),
      },
    ],
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("r"),
      property: makeIdent("insert"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 1);
  assert.equal(reports[0].data.method, "insert");
});

test("update + delete on read binding → 2 reports", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  visit(visitor, {
    type: "ImportDeclaration",
    source: { value: "@qa-sdk-sim/order-read-datasource" },
    specifiers: [{ type: "ImportSpecifier", local: makeIdent("readRepo") }],
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("readRepo"),
      property: makeIdent("update"),
    },
    arguments: [],
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("readRepo"),
      property: makeIdent("delete"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 2);
  assert.deepEqual(
    reports.map((r) => r.data.method),
    ["update", "delete"],
  );
});

test("read import + readRepository.find → 0 reports (read 메서드는 허용)", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  visit(visitor, {
    type: "ImportDeclaration",
    source: { value: "@qa-sdk-sim/foo-read-datasource" },
    specifiers: [
      { type: "ImportSpecifier", local: makeIdent("readRepository") },
    ],
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("readRepository"),
      property: makeIdent("find"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 0);
});

test("write datasource (-write-datasource) import은 본 rule 대상 아님 — 0 reports", () => {
  // 책임 분리: -write-datasource 사용은 `no-write-datasource-in-bff` rule이 담당.
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  visit(visitor, {
    type: "ImportDeclaration",
    source: { value: "@qa-sdk-sim/foo-write-datasource" },
    specifiers: [{ type: "ImportSpecifier", local: makeIdent("writeRepo") }],
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("writeRepo"),
      property: makeIdent("save"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 0);
});

test("module.get(READ_DATA_SOURCE) binding + binding.save → 1 report", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  // const readDb = moduleRef.get(READ_DATA_SOURCE);
  visit(visitor, {
    type: "VariableDeclarator",
    id: makeIdent("readDb"),
    init: {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: makeIdent("moduleRef"),
        property: makeIdent("get"),
      },
      arguments: [makeIdent("READ_DATA_SOURCE")],
    },
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("readDb"),
      property: makeIdent("upsert"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 1);
  assert.equal(reports[0].data.method, "upsert");
});

test("@Inject(READ_DATA_SOURCE) 파라미터 property + this.readDb.save → 1 report", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  // class Svc { constructor(@Inject(READ_DATA_SOURCE) readonly readDb) {} }
  visit(visitor, {
    type: "MethodDefinition",
    kind: "constructor",
    value: {
      type: "FunctionExpression",
      params: [
        {
          // TSParameterProperty (parameter property syntax)
          type: "TSParameterProperty",
          parameter: makeIdent("readDb"),
          decorators: [
            {
              type: "Decorator",
              expression: {
                type: "CallExpression",
                callee: makeIdent("Inject"),
                arguments: [makeIdent("READ_DATA_SOURCE")],
              },
            },
          ],
        },
      ],
    },
  });
  // this.readDb.save(entity)
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: {
        type: "MemberExpression",
        object: { type: "ThisExpression" },
        property: makeIdent("readDb"),
      },
      property: makeIdent("save"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 1);
  assert.equal(reports[0].data.method, "save");
});

test("@Inject(WRITE_DATA_SOURCE) 파라미터는 본 rule 대상 아님 — 0 reports", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  visit(visitor, {
    type: "MethodDefinition",
    kind: "constructor",
    value: {
      type: "FunctionExpression",
      params: [
        {
          type: "TSParameterProperty",
          parameter: makeIdent("writeDb"),
          decorators: [
            {
              type: "Decorator",
              expression: {
                type: "CallExpression",
                callee: makeIdent("Inject"),
                arguments: [makeIdent("WRITE_DATA_SOURCE")],
              },
            },
          ],
        },
      ],
    },
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: {
        type: "MemberExpression",
        object: { type: "ThisExpression" },
        property: makeIdent("writeDb"),
      },
      property: makeIdent("save"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 0);
});

test("import URL이 read-datasource 패턴이 아니면 binding 추적 안 함 — 0 reports", () => {
  const { ctx, reports } = makeContext();
  const visitor = rule.create(ctx);

  visit(visitor, {
    type: "ImportDeclaration",
    source: { value: "@qa-sdk-sim/foo-bar" }, // not -read-datasource
    specifiers: [{ type: "ImportSpecifier", local: makeIdent("repo") }],
  });
  visit(visitor, {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: makeIdent("repo"),
      property: makeIdent("save"),
    },
    arguments: [],
  });

  assert.equal(reports.length, 0);
});
