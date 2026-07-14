import { join } from 'node:path';

import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { describe, expect, it } from 'vitest';

const collectionPath = join(process.cwd(), 'collection.json');

describe('domain schematic', () => {
  it('generates Domain Slice Architecture files and wires the parent module', async () => {
    const runner = new SchematicTestRunner('@qa-sdk/scaffold', collectionPath);
    const tree = new UnitTestTree(Tree.empty());
    tree.create(
      '/src/app.module.ts',
      [
        'import { Module } from "@nestjs/common";',
        'import { HealthModule } from "./health/health.module";',
        '',
        '@Module({',
        '  imports: [HealthModule],',
        '})',
        'export class AppModule {}',
        '',
      ].join('\n'),
    );

    const result = await runner.runSchematic(
      'domain',
      {
        name: 'payment',
        parentModule: 'src/app.module.ts',
        skipFormat: true,
      },
      tree,
    );

    expect(result.files).toContain('/src/modules/payment/payment.module.ts');
    expect(result.files).toContain('/src/modules/payment/domain/payment.ids.ts');
    expect(result.files).toContain('/src/modules/payment/domain/payment.types.ts');
    expect(result.files).toContain('/src/modules/payment/domain/payment.exceptions.ts');
    expect(result.files).toContain('/src/modules/payment/domain/payment.entity.ts');
    expect(result.files).toContain('/src/modules/payment/domain/payment.entity.spec.ts');
    expect(result.files).toContain('/src/modules/payment/domain/index.ts');
    expect(result.files).toContain(
      '/src/modules/payment/application/use-cases/payment.use-case.ts',
    );
    expect(result.files).toContain(
      '/src/modules/payment/application/ports/payment-repository.port.ts',
    );
    expect(result.files).toContain('/src/modules/payment/application/ports/payment-outbox.port.ts');
    expect(result.files).toContain(
      '/src/modules/payment/application/ports/payment-transaction.port.ts',
    );
    expect(result.files).toContain('/src/modules/payment/application/ports/payment-logger.port.ts');
    expect(result.files).toContain(
      '/src/modules/payment/infrastructure/persistence/payment-db.token.ts',
    );
    expect(result.files).toContain(
      '/src/modules/payment/infrastructure/persistence/payment.repository.ts',
    );
    expect(result.files).toContain('/src/modules/payment/infrastructure/outbox/payment.outbox.ts');
    expect(result.files).toContain(
      '/src/modules/payment/infrastructure/transaction/payment.transaction.ts',
    );
    expect(result.files).toContain(
      '/src/modules/payment/infrastructure/transaction/payment.unit-of-work.ts',
    );
    expect(result.files).toContain('/src/modules/payment/infrastructure/logging/payment.logger.ts');
    expect(result.files).toContain('/src/modules/payment/presentation/http/payment.controller.ts');
    expect(result.files).toContain(
      '/src/modules/payment/contracts/openapi/domains/payment/spec.json',
    );
    expect(result.files).toContain('/src/modules/payment/metadata/openmetadata.seed.json');
    expect(result.files).not.toContain(
      '/src/modules/payment/application/queries/payment.read-model.ts',
    );
    expect(result.files).not.toContain(
      '/src/modules/payment/presentation/bff/payment-detail.bff.ts',
    );

    const useCase = result.readContent(
      '/src/modules/payment/application/use-cases/payment.use-case.ts',
    );
    expect(useCase).toContain('PaymentOutboxPort');
    expect(useCase).toContain('PaymentTransactionPort');
    expect(useCase).toContain('PaymentLoggerPort');
    expect(useCase).not.toContain('nest-service-kit');

    const repository = result.readContent(
      '/src/modules/payment/infrastructure/persistence/payment.repository.ts',
    );
    expect(repository).toContain('isPaymentUnitOfWorkScope');
    expect(repository).toContain('scope.pendingSnapshots.set');

    const outbox = result.readContent(
      '/src/modules/payment/infrastructure/outbox/payment.outbox.ts',
    );
    expect(outbox).toContain('scope.pendingOutbox.push');

    const id = result.readContent('/src/modules/payment/domain/payment.ids.ts');
    expect(id).toContain('InvalidPaymentIdException');

    const entity = result.readContent('/src/modules/payment/domain/payment.entity.ts');
    expect(entity).toContain('ArchivedPaymentException');

    const parentModule = result.readContent('/src/app.module.ts');
    expect(parentModule).toContain(
      'import { PaymentModule } from "./modules/payment/payment.module";',
    );
    expect(parentModule).toContain('imports: [HealthModule, PaymentModule]');
  });

  it('generates read model files when requested', async () => {
    const runner = new SchematicTestRunner('@qa-sdk/scaffold', collectionPath);
    const tree = new UnitTestTree(Tree.empty());
    tree.create(
      '/src/billing/billing.module.ts',
      [
        'import { Module } from "@nestjs/common";',
        '',
        '@Module({',
        '  imports: [],',
        '})',
        'export class BillingModule {}',
        '',
      ].join('\n'),
    );

    const result = await runner.runSchematic(
      'domain',
      {
        name: 'invoice',
        includeReadModel: true,
        parentModule: 'src/billing/billing.module.ts',
        skipFormat: true,
      },
      tree,
    );

    expect(result.files).toContain(
      '/src/billing/modules/invoice/application/queries/invoice.read-model.ts',
    );
    expect(result.files).toContain(
      '/src/billing/modules/invoice/infrastructure/read-model/invoice.read-model.ts',
    );
    expect(result.readContent('/src/billing/billing.module.ts')).toContain(
      'imports: [InvoiceModule]',
    );
  });

  it('generates BFF files and BFF metadata when requested', async () => {
    const runner = new SchematicTestRunner('@qa-sdk/scaffold', collectionPath);
    const tree = new UnitTestTree(Tree.empty());
    tree.create(
      '/src/app.module.ts',
      [
        'import { Module } from "@nestjs/common";',
        '',
        '@Module({',
        '  imports: [],',
        '})',
        'export class AppModule {}',
        '',
      ].join('\n'),
    );

    const result = await runner.runSchematic(
      'domain',
      {
        name: 'assignment',
        includeBff: true,
        parentModule: 'src/app.module.ts',
        skipFormat: true,
      },
      tree,
    );

    expect(result.files).toContain(
      '/src/modules/assignment/application/queries/assignment.read-model.ts',
    );
    expect(result.files).toContain(
      '/src/modules/assignment/infrastructure/read-model/assignment.read-model.ts',
    );
    expect(result.files).toContain(
      '/src/modules/assignment/presentation/bff/assignment-detail.bff.ts',
    );
    expect(result.files).toContain(
      '/src/modules/assignment/presentation/bff/assignment-detail.controller.ts',
    );

    const bff = result.readContent(
      '/src/modules/assignment/presentation/bff/assignment-detail.bff.ts',
    );
    expect(bff).toContain('AssignmentReadModelPort');
    expect(bff).not.toContain('AssignmentEntity');

    const metadata = result.readContent('/src/modules/assignment/metadata/openmetadata.seed.json');
    expect(metadata).toContain('assignment-bff-detail');

    const openapi = result.readContent(
      '/src/modules/assignment/contracts/openapi/domains/assignment/spec.json',
    );
    expect(openapi).toContain('/bff/assignment/{id}');
  });

  it('generates multiple domains under the same parent module without overwriting wiring', async () => {
    const runner = new SchematicTestRunner('@qa-sdk/scaffold', collectionPath);
    const tree = new UnitTestTree(Tree.empty());
    tree.create(
      '/src/app.module.ts',
      [
        'import { Module } from "@nestjs/common";',
        'import { HealthModule } from "./health/health.module";',
        '',
        '@Module({',
        '  imports: [HealthModule],',
        '})',
        'export class AppModule {}',
        '',
      ].join('\n'),
    );

    const withPayment = await runner.runSchematic(
      'domain',
      {
        name: 'payment',
        parentModule: 'src/app.module.ts',
        skipFormat: true,
      },
      tree,
    );
    const result = await runner.runSchematic(
      'domain',
      {
        name: 'refund-policy',
        includeBff: true,
        parentModule: 'src/app.module.ts',
        skipFormat: true,
      },
      withPayment,
    );

    expect(result.files).toContain('/src/modules/payment/payment.module.ts');
    expect(result.files).toContain('/src/modules/refund-policy/refund-policy.module.ts');
    expect(result.files).toContain(
      '/src/modules/refund-policy/domain/refund-policy.entity.spec.ts',
    );
    expect(result.files).toContain(
      '/src/modules/refund-policy/contracts/openapi/domains/refund-policy/spec.json',
    );

    const parentModule = result.readContent('/src/app.module.ts');
    expect(parentModule).toContain(
      'import { PaymentModule } from "./modules/payment/payment.module";',
    );
    expect(parentModule).toContain(
      'import { RefundPolicyModule } from "./modules/refund-policy/refund-policy.module";',
    );
    expect(parentModule).toContain('imports: [HealthModule, PaymentModule, RefundPolicyModule]');
  });
});
