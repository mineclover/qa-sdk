# **아키텍처 설계서: Saga 트랜잭션 및 이벤트 처리 명세**

본 문서는 모듈러 모놀리스 및 분산 환경에서 데이터의 최종적 일관성(Eventual Consistency)을 보장하기 위한 **이벤트 발행/구독(Pub/Sub) 표준**과, 다중 도메인 트랜잭션 관리를 위한 **Saga 오케스트레이션(Saga Orchestration)** 구현 규약을 정의합니다.

## **1\. 이벤트 발행 (Event Publishing) 원칙**

비즈니스 로직 처리 중 발생한 이벤트를 타 도메인이나 외부 시스템(Kafka)으로 전파할 때, 네트워크 장애로 인한 \*\*'데이터는 저장되었으나 이벤트는 유실되는 현상(Dual-write Problem)'\*\*을 원천 차단해야 합니다.

### **1.1. Transactional Outbox Pattern 강제**

어플리케이션 계층(Service)에서 Kafka Producer를 직접 호출하는 것을 엄격히 금지합니다. 이벤트는 반드시 비즈니스 데이터와 함께 **동일한 RDB 트랜잭션 내에서 Outbox 테이블에 INSERT** 되어야 합니다.

// \[Write Adapter\] 비즈니스 로직과 이벤트 적재의 원자성 보장  
@Injectable()  
export class AssignmentDrizzleRepository implements AssignmentRepositoryPort {  
  constructor(@Inject('DB\_CONNECTION') private readonly db: DbType) {}

  async saveWithEvent(assignment: ManagerAssignment, event: DomainEvent): Promise\<void\> {  
    // 단일 트랜잭션으로 묶임  
    await this.db.transaction(async (tx) \=\> {  
      // 1\. 비즈니스 상태 저장  
      await tx.insert(assignments).values(assignment.toSnapshot());  
        
      // 2\. Outbox 테이블에 이벤트 적재 (발행은 인프라 CDC가 담당)  
      await tx.insert(outboxEvents).values({  
        aggregateId: assignment.id,  
        eventType: event.type,  
        payload: JSON.stringify(event.payload),  
        createdAt: new Date(),  
      });  
    });  
  }  
}

## **2\. 이벤트 구독 및 로깅 (Event Subscription & Gateway)**

이벤트를 수신하는 Consumer(Worker)는 HTTP API 컨트롤러와 동일한 수준의 게이트웨이로 취급합니다. NestJS의 AOP(Aspect-Oriented Programming) 기능을 적극 활용하여 비즈니스 로직과 시스템 관심사를 분리합니다.

### **2.1. AOP 기반의 인바운드 방어막 구성**

Kafka 메시지를 수신하는 @EventPattern 핸들러에는 다음 세 가지 AOP 요소가 필수로 부착되어야 합니다.

1. **분산 추적/로깅 (Interceptor):** 이벤트 헤더에 포함된 traceId를 추출하여 로그 컨텍스트에 주입합니다.  
2. **멱등성 보장 (Guard/Interceptor):** 동일한 이벤트(eventId)가 재전송되더라도 중복 처리되지 않도록 Redis 등을 이용해 방어합니다.  
3. **페이로드 검증 (Pipe):** 수신된 JSON 데이터가 DTO 스펙과 일치하는지 검사합니다.

// \[Consumer Controller\] 이벤트 수신 게이트웨이  
@Controller()  
@UseInterceptors(KafkaTracingInterceptor) // 1\. TraceId 기반 분산 로깅  
@UseGuards(EventIdempotencyGuard)         // 2\. 멱등성 검증 (중복 처리 방지)  
export class AssignmentSyncConsumer {  
  constructor(private readonly syncService: ReadModelSyncService) {}

  @EventPattern('domain.assignment.created')  
  @UsePipes(new ValidationPipe({ transform: true })) // 3\. DTO 자동 검증  
  async handleAssignmentCreated(@Payload() eventDto: AssignmentCreatedEventDto) {  
    // 순수 동기화/후속 비즈니스 로직만 호출됨  
    await this.syncService.updateReadModel(eventDto);  
  }  
}

## **3\. Saga 오케스트레이션 (분산 트랜잭션 관리)**

담당자 배정 후 \-\> 프로젝트 상태 변경 \-\> 알림 발송 등 여러 도메인을 거쳐야 하는 하나의 거대한 트랜잭션은 **Saga Orchestrator**가 중앙에서 지휘합니다.

### **3.1. Saga Flow 및 보상 트랜잭션 (Compensating Transaction)**

도메인 간 물리적 ROLLBACK이 불가능하므로, 특정 단계에서 실패할 경우 오케스트레이터가 **이전 단계들의 상태를 취소하는 '보상 트랜잭션(API/Command)'을 역순으로 호출**합니다.

sequenceDiagram  
    participant O as Saga Orchestrator  
    participant A as Assignment Domain  
    participant P as Project Domain

    O-\>\>A: 1\. 담당자 배정 요청 (Create)  
    A--\>\>O: 배정 완료 (Status: PENDING)  
      
    O-\>\>P: 2\. 프로젝트 상태 '진행중' 업데이트  
    alt 프로젝트 도메인 실패 (예: 락 획득 실패)  
        P--\>\>O: 에러 발생\!  
        Note over O,A: 트랜잭션 복구 시작 (보상 트랜잭션)  
        O-\>\>A: 3\. 배정 취소 명령 (Compensate)  
        A--\>\>O: 배정 상태 CANCELED로 변경  
    else 성공  
        P--\>\>O: 업데이트 완료  
        O-\>\>A: 3\. 배정 확정 명령 (Complete)  
    end

### **3.2. Saga Orchestrator 구현체 (NestJS 예시)**

워크플로우 엔진(Temporal 등)을 사용하지 않는 경우, 아래와 같이 상태 머신을 명시적으로 코드로 관리합니다.

@Injectable()  
export class AssignManagerSagaOrchestrator {  
  constructor(  
    private readonly assignmentPort: AssignmentExecutionPort,  
    private readonly projectPort: ProjectExecutionPort,  
  ) {}

  async executeSaga(command: AssignManagerCommand): Promise\<void\> {  
    let assignmentId: string | null \= null;

    try {  
      // Step 1\. 담당자 배정 (Pending 상태로 생성)  
      const result \= await this.assignmentPort.createPendingAssignment(command);  
      assignmentId \= result.id;

      // Step 2\. 타 도메인(프로젝트) 업데이트 시도  
      await this.projectPort.activateProjectStatus(command.projectId);

      // Step 3\. 전체 성공 시 배정 확정  
      await this.assignmentPort.confirmAssignment(assignmentId);

    } catch (error) {  
      // 🚨 보상 트랜잭션 실행 (Rollback 대응)  
      if (assignmentId) {  
        // 이미 생성된 배정 건을 '취소' 상태로 덮어쓰는 명시적 API 호출  
        await this.assignmentPort.cancelAssignment(  
          new CancelAssignmentCommand(assignmentId, '프로젝트 활성화 실패로 인한 롤백')  
        );  
      }  
      throw new SagaExecutionException('Saga 트랜잭션 실패 및 보상 완료', error);  
    }  
  }  
}

## **4\. 구현 규약 및 체크리스트**

1. **절대 직접 발행 금지:** Kafka(또는 외부 브로커) 클라이언트를 Application Service에서 직접 주입받아 send() 메서드를 호출하는 코드는 리뷰에서 전면 반려합니다.  
2. **Consumer의 독립성:** 이벤트를 구독하는 Worker는 자신이 며칠 동안 꺼져 있다가 켜지더라도(Offset 밀림 현상), 재처리 시 데이터 오염이 없도록 철저한 \*\*멱등성(Idempotency)\*\*을 보장해야 합니다.  
3. **분산 추적 컨텍스트 (Trace Context):** 클라이언트의 최초 HTTP 요청에서 생성된 X-Trace-Id는 Outbox 테이블 \-\> Kafka 메시지 헤더 \-\> Consumer 로그까지 끊임없이(End-to-End) 전달되어야 합니다.  
4. **보상 트랜잭션의 필수 구현:** 외부 도메인의 상태를 변경하는 Saga에 참여하는 모든 도메인은 해당 행위를 취소할 수 있는 **보상용 Command(예: CancelXXXCommand)를 반드시 함께 구현하고 Port로 노출**해야 합니다.