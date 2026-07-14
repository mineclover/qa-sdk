'use strict';

/**
 * spec 05-error-and-scenarios.md §4 — read DataSource로 import한 식별자에 대해
 * write 메서드(save/insert/update/delete/upsert/remove)를 호출하면 lint error.
 *
 * 본 rule은 Plan C 단계 8 Task 8.6의 `no-write-datasource-in-bff` (import 차단)이
 * 우회된 호출 사이트를 정적으로 막는다. CQRS 분리의 두 번째 정적 가드.
 *
 * 매칭 조건:
 *   1) `@Inject(READ_DATA_SOURCE)` 파라미터 데코레이터로 주입된 변수
 *   2) `module.get(READ_DATA_SOURCE)` 등 token으로 조회한 변수
 *   3) `@qa-sdk-sim/<svc>-read-datasource` 모듈에서 import한 식별자
 *      (plan literal 대비 — 향후 별도 패키지로 분리 시 자동 매칭)
 *
 * 위 세 경로 중 하나로 binding 된 식별자를 callee object로 가지는 CallExpression의
 * property 이름이 WRITE_METHODS 집합에 속하면 violation.
 *
 * 위반 시 메시지:
 *   "read DataSource binding may not call write method ({{method}}) (spec 05 §4)."
 */

const WRITE_METHODS = new Set(['save', 'insert', 'update', 'delete', 'upsert', 'remove']);

const READ_DATASOURCE_MODULE_RE = /^@qa-sdk-sim\/[a-z][a-z0-9-]*-read-datasource$/;

const READ_TOKEN_NAME = 'READ_DATA_SOURCE';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'read DataSource로 binding된 식별자에 write 메서드 호출 금지 (CQRS 분리)',
      recommended: true,
    },
    schema: [],
    messages: {
      writeCallOnReadDatasource:
        'read DataSource binding may not call write method ({{method}}) (spec 05-error-and-scenarios.md §4).',
    },
  },
  create(context) {
    /**
     * 각 lexical scope에서 read DataSource로 binding된 변수 이름 집합.
     * 본 구현은 단순한 file-scope 추적이다 — 깊은 클로저/shadowing은 다음
     * 사이클에서 typescript-eslint type-checker로 보강 (현재 rule은 surface
     * heuristic 으로도 BFF write call 회귀를 충분히 잡는다).
     */
    const readBindings = new Set();

    function maybeAddBinding(name) {
      if (typeof name === 'string' && name.length > 0) {
        readBindings.add(name);
      }
    }

    /**
     * `@Inject(READ_DATA_SOURCE)` 같이 Decorator의 첫 인자가 READ_DATA_SOURCE
     * Identifier인지 검사.
     */
    function isInjectReadToken(decorator) {
      if (!decorator || decorator.type !== 'Decorator') return false;
      const expr = decorator.expression;
      if (!expr || expr.type !== 'CallExpression') return false;
      if (expr.callee.type !== 'Identifier' || expr.callee.name !== 'Inject') {
        return false;
      }
      const arg = expr.arguments?.[0];
      return arg && arg.type === 'Identifier' && arg.name === READ_TOKEN_NAME;
    }

    /**
     * `module.get(READ_DATA_SOURCE)` 같이 첫 인자가 READ_DATA_SOURCE인 호출.
     */
    function callPassesReadToken(callExpr) {
      if (!callExpr || callExpr.type !== 'CallExpression') return false;
      const arg = callExpr.arguments?.[0];
      return arg && arg.type === 'Identifier' && arg.name === READ_TOKEN_NAME;
    }

    return {
      // 1) constructor 파라미터 `@Inject(READ_DATA_SOURCE) readonly db: ...`
      MethodDefinition(node) {
        if (
          !node.value ||
          node.value.type !== 'FunctionExpression' ||
          node.kind !== 'constructor'
        ) {
          return;
        }
        for (const param of node.value.params) {
          // TS parameter property: TSParameterProperty
          const target = param.type === 'TSParameterProperty' ? param.parameter : param;
          const decorators = param.decorators || target.decorators || [];
          if (decorators.some(isInjectReadToken)) {
            // parameter property: parameter.parameter is the Identifier
            // plain decorated param: target.name 또는 target.left.name
            const ident =
              target.type === 'Identifier'
                ? target
                : target.type === 'AssignmentPattern' && target.left.type === 'Identifier'
                  ? target.left
                  : null;
            if (ident) maybeAddBinding(ident.name);
          }
        }
      },

      // 2) Module-level/`const x = module.get(READ_DATA_SOURCE)` 형태
      VariableDeclarator(node) {
        if (!node.init) return;
        if (node.id.type !== 'Identifier') return;
        if (callPassesReadToken(node.init)) {
          maybeAddBinding(node.id.name);
        }
      },

      // 3) Plan literal 호환: `@qa-sdk-sim/<svc>-read-datasource` 모듈 import.
      ImportDeclaration(node) {
        const src = node.source && node.source.value;
        if (typeof src !== 'string') return;
        if (!READ_DATASOURCE_MODULE_RE.test(src)) return;
        for (const spec of node.specifiers) {
          if (spec.local && spec.local.type === 'Identifier') {
            maybeAddBinding(spec.local.name);
          }
        }
      },

      // 호출 사이트 검사
      CallExpression(node) {
        const callee = node.callee;
        if (!callee || callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        const method = callee.property.name;
        if (!WRITE_METHODS.has(method)) return;

        // readBindings.<method>(...) 직접 호출만 잡는다.
        // (await readDb.save(...) 도 동일 — `callee.object`는 Identifier 그대로.)
        if (callee.object.type === 'Identifier' && readBindings.has(callee.object.name)) {
          context.report({
            node,
            messageId: 'writeCallOnReadDatasource',
            data: { method },
          });
        }

        // this.<bindingName>.<method>(...) 형태 — 파라미터 property가 readonly로
        // class field가 된 경우.
        if (
          callee.object.type === 'MemberExpression' &&
          callee.object.object.type === 'ThisExpression' &&
          callee.object.property.type === 'Identifier' &&
          readBindings.has(callee.object.property.name)
        ) {
          context.report({
            node,
            messageId: 'writeCallOnReadDatasource',
            data: { method },
          });
        }
      },
    };
  },
};
