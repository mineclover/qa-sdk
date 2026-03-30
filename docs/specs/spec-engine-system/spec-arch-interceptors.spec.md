---
def:
  id: spec-arch-interceptors
  address: def_document:v2:68808
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: spec-core
  tags: [runtime, structural, observability]
  links:
    - target: spec-core-types-group
      type: depends_on
---
# Decorator와 Interceptor 설계

## 목적 ^purpose

Decorator와 Interceptor 설계. 횡단 관심사(로깅, 검증, 캐시)를 모듈 수준에서 처리.

## 구성 ^overview

- **Decorator 3종**: @Boundary(경계 바인딩, controller), @Contract(계약 바인딩, handler), @Schema(스키마 바인딩, handler) — SetMetadata 기반
- **DiscoveryService**: 런타임에 controller의 boundary_id, contract_id 메타데이터를 자동 수집·인덱싱
- **TraceInterceptor**: trace ID 추출 또는 생성 후 TraceContextService.run()으로 전파
- **ContractBindingInterceptor**: Reflector로 boundary_id·contract_id를 읽어 TraceContext에 바인딩

---

## 1. Decorator 설계

decorator는 **source of truth가 아니라 binding metadata**.

### 1.1 정의

```typescript
// 경계 바인딩 — controller에 부착
export const Boundary = (id: string) => SetMetadata("boundary_id", id);

// 계약 바인딩 — handler에 부착
export const Contract = (id: string) => SetMetadata("contract_id", id);

// 스키마 바인딩 — handler에 부착
export const Schema = (id: string) => SetMetadata("schema_id", id);
```

### 1.2 사용

```typescript
@Controller("teams")
@Boundary("boundary.cms.team")
export class TeamController {
  @Post()
  @Contract("contract.api.team.create")
  @Schema("schema:event.team_create:v1")
  async create(@Body() body: CreateTeamDto) {
    // ...
  }
}
```

### 1.3 수집

`DiscoveryService`로 런타임에 metadata 수집 가능:

```typescript
@Injectable()
export class ContractDiscoveryService implements OnModuleInit {
  constructor(private discovery: DiscoveryService) {}

  async onModuleInit() {
    const controllers = this.discovery.getControllers();
    // metadata에서 boundary_id, contract_id 수집 → 인덱싱
  }
}
```

---

## 2. Interceptor 설계

### 2.1 TraceInterceptor

```typescript
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(private trace: TraceContextService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const traceId = extractOrGenerate(ctx);
    return this.trace.run(traceId, () => next.handle());
  }
}
```

### 2.2 ContractBindingInterceptor

```typescript
@Injectable()
export class ContractBindingInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private trace: TraceContextService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const boundaryId = this.reflector.get("boundary_id", ctx.getClass());
    const contractId = this.reflector.get("contract_id", ctx.getHandler());
    this.trace.setBoundary(boundaryId);
    this.trace.setContract(contractId);
    return next.handle();
  }
}
```
