import { describe, expect, it } from "vitest";

import { validateArchitecture } from "./validator.js";

describe("validateArchitecture", () => {
  it("accepts the intended dependency direction", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/domain/payment.entity.ts",
        content: "export class PaymentEntity {}",
      },
      {
        path: "src/modules/payment/application/use-cases/payment.use-case.ts",
        content: [
          'import { PaymentRepositoryPort } from "../ports/payment-repository.port";',
          'import { PaymentTransactionPort } from "../ports/payment-transaction.port";',
          'import { PaymentLoggerPort } from "../ports/payment-logger.port";',
          "export class PaymentUseCase {",
          "  constructor(transaction: PaymentTransactionPort, logger: PaymentLoggerPort) {}",
          "}",
        ].join("\n"),
      },
      {
        path: "src/modules/payment/presentation/http/payment.controller.ts",
        content: 'import { PaymentUseCase } from "../../application/use-cases/payment.use-case";',
      },
      {
        path: "src/modules/payment/infrastructure/persistence/payment.repository.ts",
        content: 'import { eq } from "drizzle-orm";',
      },
    ]);

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("flags domain framework leakage and application adapter leakage", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/domain/payment.entity.ts",
        content: 'import { Injectable } from "@nestjs/common";',
      },
      {
        path: "src/modules/payment/application/use-cases/payment.use-case.ts",
        content: 'import { DrizzlePaymentRepository } from "../../infrastructure/persistence/payment.repository";',
      },
      {
        path: "src/modules/payment/presentation/http/payment.controller.ts",
        content: 'import { DrizzlePaymentRepository } from "../../infrastructure/persistence/payment.repository";',
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "domain-is-pure",
      "application-uses-ports",
      "transaction-and-logging-are-ports",
      "transaction-and-logging-are-ports",
      "presentation-calls-application",
    ]);
  });

  it("flags use cases missing transaction and logger ports", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/application/use-cases/payment.use-case.ts",
        content: "export class PaymentUseCase {}",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "transaction-and-logging-are-ports",
      "transaction-and-logging-are-ports",
    ]);
  });

  it("flags BFF entity exposure and missing BFF metadata", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/presentation/bff/payment-detail.bff.ts",
        content: [
          'import { PaymentEntity } from "../../domain";',
          "export class PaymentBff {",
          "  save(): PaymentEntity { throw new Error('bad'); }",
          "}",
        ].join("\n"),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "bff-does-not-expose-domain-entity",
      "bff-does-not-expose-domain-entity",
      "metadata-ships-with-domain-slice",
    ]);
  });

  it("flags read model and BFF metadata drift", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/application/queries/payment.read-model.ts",
        content: "export interface PaymentReadModel {}",
      },
      {
        path: "src/modules/payment/presentation/bff/payment-detail.bff.ts",
        content: "export class PaymentBff {}",
      },
      {
        path: "src/modules/payment/metadata/openmetadata.seed.json",
        content: JSON.stringify({ cacheKeys: [{ id: "payment-read-model" }] }),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "metadata-ships-with-domain-slice",
    ]);
  });

  it("flags OpenAPI fragments exposing domain entities", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/contracts/openapi/domains/payment/spec.json",
        content: JSON.stringify({ components: { schemas: { PaymentEntity: {} } } }),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "openapi-does-not-expose-domain-entity",
    ]);
  });

  it("flags slices outside modules and transaction/outbox slices missing unit of work", () => {
    const result = validateArchitecture([
      {
        path: "src/payment/application/ports/payment-transaction.port.ts",
        content: "export abstract class PaymentTransactionPort {}",
      },
      {
        path: "src/payment/application/ports/payment-outbox.port.ts",
        content: "export abstract class PaymentOutboxPort {}",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "domain-slice-under-modules",
      "transaction-outbox-use-unit-of-work",
    ]);
  });

  it("flags cross-domain deep imports and allows local query ports", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/billing/application/use-cases/create-billing.use-case.ts",
        content: [
          'import { AssignmentEntity } from "../../../assignment/domain/assignment.entity";',
          'import { AssignmentStateQueryPort } from "../ports/assignment-state.query-port";',
          "export class CreateBillingUseCase {}",
        ].join("\n"),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain("bounded-context-uses-contracts");
  });

  it("treats read-model topology as transaction/use-case exempt", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/application/queries/payment-read-model.query.ts",
        content: "export class PaymentReadModelQuery {}",
      },
      {
        path: "src/modules/payment/infrastructure/read-model/payment.read-model.ts",
        content: "export class PaymentReadModel {}",
      },
      {
        path: "src/modules/payment/metadata/openmetadata.seed.json",
        content: JSON.stringify({
          topology: "read-model",
          cacheKeys: [{ id: "payment-read-model" }],
        }),
      },
    ]);
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("requires read-model artifact when topology declares read-model", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/domain/payment.types.ts",
        content: "export interface Payment {}",
      },
      {
        path: "src/modules/payment/metadata/openmetadata.seed.json",
        content: JSON.stringify({
          topology: "read-model",
          cacheKeys: [{ id: "payment-read-model" }],
        }),
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toContain("topology-shape-mismatch");
  });

  it("treats bff topology as transaction/outbox exempt", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/presentation/bff/payment-detail.bff.ts",
        content: "export class PaymentDetailBff {}",
      },
      {
        path: "src/modules/payment/metadata/openmetadata.seed.json",
        content: JSON.stringify({
          topology: "bff",
          cacheKeys: [{ id: "payment-bff-detail" }],
        }),
      },
    ]);
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("treats command-only topology as read-model/entity exempt", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/login/application/use-cases/login.use-case.ts",
        content: [
          'import { LoginTransactionPort } from "../ports/login-transaction.port";',
          'import { LoginLoggerPort } from "../ports/login-logger.port";',
          "export class LoginUseCase {",
          "  constructor(tx: LoginTransactionPort, logger: LoginLoggerPort) {}",
          "}",
        ].join("\n"),
      },
      {
        path: "src/modules/login/metadata/openmetadata.seed.json",
        content: JSON.stringify({ topology: "command-only", cacheKeys: [] }),
      },
    ]);
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("treats read-mostly topology as transaction/outbox exempt and requires read-model cache", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/bitmap/infrastructure/read-model/bitmap.read-model.ts",
        content: "export class BitmapReadModel {}",
      },
      {
        path: "src/modules/bitmap/metadata/openmetadata.seed.json",
        content: JSON.stringify({
          topology: "read-mostly",
          cacheKeys: [{ id: "bitmap-read-model" }],
        }),
      },
    ]);
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("rejects use-cases that only mention TransactionPort/LoggerPort in comments or strings", () => {
    // 강화된 AST 룰 — substring 검사는 import 가 없어도 주석/문자열만으로 통과했다
    // (false negative). 실제 import + 사용이 모두 갖춰져야 통과해야 한다.
    const result = validateArchitecture([
      {
        path: "src/modules/payment/application/use-cases/payment.use-case.ts",
        content: [
          "// Comment referencing TransactionPort and LoggerPort symbols by name only.",
          'const note = "TransactionPort + LoggerPort";',
          "export class PaymentUseCase {}",
        ].join("\n"),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "transaction-and-logging-are-ports",
      "transaction-and-logging-are-ports",
    ]);
  });

  it("rejects use-cases that only import TransactionPort/LoggerPort without using them", () => {
    // import 만 있고 본문 사용이 없으면 dead import — 강화된 AST 룰이 잡아야 한다.
    const result = validateArchitecture([
      {
        path: "src/modules/payment/application/use-cases/payment.use-case.ts",
        content: [
          'import type { PaymentTransactionPort } from "../ports/payment-transaction.port";',
          'import type { PaymentLoggerPort } from "../ports/payment-logger.port";',
          "export class PaymentUseCase {",
          "  constructor() {}",
          "}",
        ].join("\n"),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      "transaction-and-logging-are-ports",
      "transaction-and-logging-are-ports",
    ]);
  });

  it("accepts SLICE_LOGGER_PORT token inject as a valid LoggerPort dependency", () => {
    // kit 의 LoggerPort 추상에 의존하는 정당한 패턴 — type import 가 아닌 토큰 inject.
    const result = validateArchitecture([
      {
        path: "src/modules/payment/application/use-cases/payment.use-case.ts",
        content: [
          'import { Inject } from "@nestjs/common";',
          'import { SLICE_LOGGER_PORT } from "@qa-sdk/sim-domain-slice-kit";',
          'import type { PaymentTransactionPort } from "../ports/payment-transaction.port";',
          "export class PaymentUseCase {",
          "  constructor(",
          "    @Inject(SLICE_LOGGER_PORT) private readonly logger: unknown,",
          "    private readonly tx: PaymentTransactionPort,",
          "  ) {}",
          "}",
        ].join("\n"),
      },
    ]);

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("accepts use-cases that import + use TransactionPort/LoggerPort as type references", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/payment/application/use-cases/payment.use-case.ts",
        content: [
          'import type { PaymentTransactionPort } from "../ports/payment-transaction.port";',
          'import type { PaymentLoggerPort } from "../ports/payment-logger.port";',
          "export class PaymentUseCase {",
          "  constructor(",
          "    private readonly tx: PaymentTransactionPort,",
          "    private readonly logger: PaymentLoggerPort,",
          "  ) {}",
          "}",
        ].join("\n"),
      },
    ]);

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("flags path alias based cross-domain deep imports", () => {
    const result = validateArchitecture([
      {
        path: "src/modules/billing/application/use-cases/create-billing.use-case.ts",
        content: [
          'import { AssignmentEntity } from "@modules/assignment/domain/assignment.entity";',
          'import { AssignmentStateQueryPort } from "@modules/billing/application/ports/assignment-state.query-port";',
          "export class CreateBillingUseCase {}",
        ].join("\n"),
      },
      {
        path: "src/modules/billing/application/ports/assignment-state.query-port.ts",
        content: "export abstract class AssignmentStateQueryPort {}",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      importPath: "@modules/assignment/domain/assignment.entity",
      ruleId: "bounded-context-uses-contracts",
    }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      importPath: "@modules/billing/application/ports/assignment-state.query-port",
      ruleId: "bounded-context-uses-contracts",
    }));
  });
});
