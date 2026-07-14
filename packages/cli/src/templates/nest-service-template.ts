// @def.boundary nest-service-template
// @def.doc nest-service-template

export interface NestServiceTemplateInput {
  readonly packageName: string;
  readonly serviceName: string;
  readonly ownerSystem: string;
  readonly port: number;
}

export function generateNestServicePackageJson(input: NestServiceTemplateInput): string {
  return (
    JSON.stringify(
      {
        name: input.packageName,
        version: '0.1.0',
        private: true,
        type: 'module',
        main: 'dist/main.js',
        exports: {
          '.': {
            import: './dist/main.js',
            types: './dist/main.d.ts',
          },
        },
        files: ['dist', 'README.md'],
        scripts: {
          dev: 'tsx watch src/main.ts',
          build: 'tsc',
          start: 'node dist/main.js',
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
          clean: 'rm -rf dist',
        },
        dependencies: {
          '@nestjs/common': '^11.0.0',
          '@nestjs/core': '^11.0.0',
          '@nestjs/platform-fastify': '^11.0.0',
          '@qa-sdk/nest-service-kit': 'workspace:*',
          '@qa-sdk/otel': 'workspace:*',
          'db-bootstrap': 'workspace:*',
          'reflect-metadata': '^0.2.2',
          zod: '^3.24.2',
        },
        devDependencies: {
          '@nestjs/testing': '^11.0.0',
          '@types/node': '^22.0.0',
          tsx: '^4.19.3',
          typescript: '^5.8.2',
          vitest: '^1.6.1',
        },
      },
      null,
      2,
    ) + '\n'
  );
}

export function generateNestServiceTsconfig(extendsPath: string): string {
  return `{
  "extends": "${escapeTemplateLiteral(extendsPath)}",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
`;
}

export function generateNestServiceVitestConfig(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**"],
    passWithNoTests: true,
  },
});
`;
}

export function generateNestServiceReadme(input: NestServiceTemplateInput): string {
  return `# ${input.serviceName}

NestJS modular-monolith service template.

## 포함

- Fastify bootstrap via \`@qa-sdk/nest-service-kit\`
- requester-aware event envelope + EventPublisherPort
- db-bootstrap 기반 env schema 예시
- API / Application / Domain / Infrastructure 구조 샘플

## 시작

\`\`\`bash
pnpm --filter ${input.packageName} typecheck
pnpm --filter ${input.packageName} test
\`\`\`
`;
}

export function generateNestServiceEnvTs(input: NestServiceTemplateInput): string {
  return `import { otelEnvSchema } from "@qa-sdk/otel";
import { z } from "zod";
import { dbEnvSchema } from "db-bootstrap";

export const envSchema = dbEnvSchema.merge(otelEnvSchema).extend({
  PORT: z.coerce.number().int().default(${input.port}),
  CORS_ORIGIN: z.string().default("*"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
`;
}

export function generateNestServiceAppModuleTs(input: NestServiceTemplateInput): string {
  return `import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { ExampleModule } from "./domains/example/infrastructure/example.module.js";

@Module({
  imports: [HealthModule, ExampleModule],
})
export class AppModule {}
`;
}

export function generateNestServiceMainTs(input: NestServiceTemplateInput): string {
  return `import "reflect-metadata";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";
import { bootstrapNestService } from "@qa-sdk/nest-service-kit";

await bootstrapNestService({
  rootModule: AppModule,
  serviceName: "${escapeTemplateLiteral(input.serviceName)}",
  port: env.PORT,
  corsOrigin: env.CORS_ORIGIN,
  telemetryEnv: env,
});
`;
}

export function generateNestServiceHealthControllerTs(input: NestServiceTemplateInput): string {
  return `import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  read() {
    return { ok: true, service: "${escapeTemplateLiteral(input.serviceName)}" };
  }
}
`;
}

export function generateNestServiceHealthModuleTs(): string {
  return `import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
`;
}

export function generateNestServiceExamplePortTs(): string {
  return `export interface ProjectStatusDto {
  id: string;
  status: "ACTIVE" | "INACTIVE";
}

export abstract class ProjectQueryPort {
  abstract getProjectStatus(projectId: string): Promise<ProjectStatusDto>;
}
`;
}

export function generateNestServiceExampleServiceTs(input: NestServiceTemplateInput): string {
  return `import { Injectable } from "@nestjs/common";
import {
  EventPublisherPort,
  createEventEnvelope,
} from "@qa-sdk/nest-service-kit";
import { ProjectQueryPort } from "../api/project-query.port.js";

export interface AssignManagerCommand {
  projectId: string;
  managerId: string;
  requesterId: string;
}

@Injectable()
export class AssignManagerService {
  constructor(
    private readonly projectQuery: ProjectQueryPort,
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async execute(command: AssignManagerCommand): Promise<void> {
    const project = await this.projectQuery.getProjectStatus(command.projectId);
    if (project.status !== "ACTIVE") {
      throw new Error("inactive project");
    }

    await this.eventPublisher.publish(
      createEventEnvelope({
        eventKey: "${escapeTemplateLiteral(input.serviceName)}.manager.assigned",
        eventVersion: "v1",
        producerService: "${escapeTemplateLiteral(input.serviceName)}",
        requesterType: "user",
        requesterId: command.requesterId,
        behaviorUnit: "${escapeTemplateLiteral(input.ownerSystem)}.manager.assign.requested",
        requestRoute: "POST /assignments",
        requestMethod: "POST",
        subjectType: "project",
        subjectId: command.projectId,
        effectKind: "updated",
        outcome: "success",
        payload: {
          managerId: command.managerId,
        },
      }),
    );
  }
}
`;
}

export function generateNestServiceExampleModuleTs(): string {
  return `import { Module } from "@nestjs/common";
import { EventPublisherPort, NoopEventPublisher } from "@qa-sdk/nest-service-kit";
import { ProjectQueryPort } from "../api/project-query.port.js";
import { AssignManagerService } from "../application/assign-manager.service.js";

class StaticProjectQueryAdapter extends ProjectQueryPort {
  async getProjectStatus(projectId: string) {
    return { id: projectId, status: "ACTIVE" as const };
  }
}

@Module({
  providers: [
    AssignManagerService,
    {
      provide: ProjectQueryPort,
      useClass: StaticProjectQueryAdapter,
    },
    {
      provide: EventPublisherPort,
      useClass: NoopEventPublisher,
    },
  ],
  exports: [AssignManagerService],
})
export class ExampleModule {}
`;
}

function escapeTemplateLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}
