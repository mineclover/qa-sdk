# **아키텍처 설계서: Write Model 및 Command 인터페이스 명세**

본 문서는 CQRS 아키텍처의 **Command(쓰기) 흐름**을 담당하는 Write Model의 설계 원칙과, 외부(클라이언트 또는 타 도메인의 오케스트레이터)로부터 상태 변경 요청을 안전하게 수신하기 위한 **인터페이스(Inbound Port) 노출 방식**을 정의합니다.

## **1\. Command 인터페이스 (Inbound Port) 노출 원칙**

도메인의 상태를 변경하는 행위는 단순한 데이터베이스 UPDATE가 아닙니다. 비즈니스 규칙이 실행되는 진입점이므로, 의도가 명확한 인터페이스를 통해서만 접근을 허용해야 합니다.

### **1.1. 목적형 Command DTO 사용**

상태 변경을 요청할 때는 파라미터를 개별적으로 나열하지 않고, 행위의 의도를 명확히 나타내는 **Command DTO** 클래스로 캡슐화하여 전달해야 합니다.

// ❌ 안티패턴: 의도가 불분명하고 파라미터가 파편화됨  
async assign(projectId: string, courseId: string, processType: string, managerId: string) { ... }

// 🟢 표준 (Command DTO): '담당자 배정'이라는 비즈니스 의도가 명확함  
export class AssignManagerCommand {  
  constructor(  
    public readonly projectId: string,  
    public readonly courseId: string,  
    public readonly processType: string,  
    public readonly managerId: string,  
    // 필요 시 1차 구조적 유효성 검증(Validation) 로직 포함 가능  
  ) {}  
}

### **1.2. UseCase 인터페이스 (Inbound Port) 정의**

Application Service는 자신이 수행할 수 있는 비즈니스 유스케이스(Use Case)를 인터페이스로 정의하여 모듈 외부에 노출합니다. API Controller나 Saga Orchestrator는 이 인터페이스만 바라보고 명령을 내립니다.

// \[Inbound Port\] 외부에서 도메인에 명령을 내리기 위한 계약서  
export interface AssignManagerUseCase {  
  execute(command: AssignManagerCommand): Promise\<void\>;  
}

## **2\. Write Model (Domain Aggregate) 설계 원칙**

Write Model의 핵심 존재 이유는 \*\*"비즈니스 무결성(Invariant)의 보호"\*\*입니다. 데이터베이스 스키마(Table)와 1:1로 매핑되는 빈약한 데이터 객체(Anemic Domain Model)를 지양하고, 행동(Behavior)을 가진 풍부한 도메인 객체를 설계해야 합니다.

### **2.1. 애그리거트 루트 (Aggregate Root) 중심 제어**

* 관련된 도메인 객체들을 하나의 묶음(Aggregate)으로 다루며, 외부에서는 오직 **애그리거트 루트**를 통해서만 내부 상태를 변경할 수 있습니다.  
* 예: 담당자 배정(Assignment)이라는 애그리거트 루트를 통하지 않고, 그 하위의 배정 이력(AssignmentHistory) 테이블을 직접 INSERT 하는 것을 엄격히 금지합니다.

### **2.2. 도메인 객체 내부에서의 상태 변경 (행위 캡슐화)**

상태 변경 로직(조건문, 비즈니스 룰)을 Application Service에 늘어놓지 않고, 도메인 객체 내부의 메서드로 캡슐화합니다.

// \[Write Model / Domain Entity\] 순수 TypeScript 클래스 (DB 기술 종속성 없음)  
export class ManagerAssignment {  
  private status: 'PENDING' | 'COMPLETED' | 'CANCELED';  
  private assignedAt: Date;

  constructor(  
    private readonly id: string,  
    private readonly targetProcess: ProcessInfo,  
    private managerId: string,  
  ) {}

  // 🟢 비즈니스 규칙이 캡슐화된 상태 변경 메서드  
  public assignManager(newManagerId: string): void {  
    if (this.status \=== 'COMPLETED') {  
      throw new DomainException('이미 배정이 완료된 공정은 담당자를 변경할 수 없습니다.');  
    }  
    this.managerId \= newManagerId;  
    this.status \= 'PENDING';  
    this.assignedAt \= new Date();  
  }  
}

## **3\. 영속성 및 외부 통신 위임 (Outbound Port)**

순수한 Write Model(도메인 객체)이 변경된 상태를 DB에 저장하거나 이벤트를 발행하려면, 인프라 계층의 기술(ORM, Kafka 등)이 필요합니다. 이때 도메인이 인프라에 종속되지 않도록 **Outbound Port**를 사용합니다.

### **3.1. Repository Port (저장소 계약)**

Application Service는 DB에 어떻게 저장하는지(SQL 쿼리) 모릅니다. 단지 "저장해달라"는 추상화된 포트만 호출합니다.

// \[Outbound Port\] 인프라 계층이 구현해야 할 계약서  
export interface AssignmentRepositoryPort {  
  findById(id: string): Promise\<ManagerAssignment | null\>;  
  save(assignment: ManagerAssignment): Promise\<void\>;  
}

### **3.2. 단일 트랜잭션과 Outbox 패턴 결합**

데이터의 상태 변경(Write DB 저장)과 이벤트 발행(Event Bus)의 원자성(Atomicity)을 보장하기 위해, Repository Adapter 내부에서 **비즈니스 데이터와 Outbox 이벤트 데이터를 하나의 DB 트랜잭션으로 커밋**합니다.

// \[Application Service\] 명령의 실행 흐름을 오케스트레이션 (비즈니스 로직은 도메인에 위임)  
@Injectable()  
export class ManagerAssignmentService implements AssignManagerUseCase {  
  constructor(  
    private readonly repository: AssignmentRepositoryPort,  
    private readonly outbox: OutboxPort, // 이벤트 적재용 포트  
  ) {}

  @Transactional() // AOP 기반 트랜잭션 제어  
  @DistributedLock({ key: "'assign:' \+ \#command.projectId" }) // 동시성 제어  
  async execute(command: AssignManagerCommand): Promise\<void\> {  
    // 1\. 도메인 모델 로드 (또는 생성)  
    const assignment \= await this.repository.findById(command.getAggregateId());  
      
    // 2\. 도메인 로직 실행 (상태 변경 및 비즈니스 무결성 검증)  
    assignment.assignManager(command.managerId);  
      
    // 3\. 영속화 위임 (Primary DB 저장)  
    await this.repository.save(assignment);  
      
    // 4\. Outbox 이벤트 적재 (동일 트랜잭션에 묶임)  
    await this.outbox.saveEvent(new ManagerAssignedEvent(assignment));  
  }  
}

## **4\. 구현 규약 및 요약**

1. **Inbound 통제:** 클라이언트의 모든 쓰기 요청은 파라미터가 캡슐화된 Command DTO 객체를 통해서만 수신해야 합니다.  
2. **도메인 순수성 (Rich Domain):** 비즈니스 규칙(예: 배정 가능 상태 체크)은 Service 클래스의 if문이 아닌, Write Model(Domain Entity) 내부의 메서드로 구현되어야 합니다.  
3. **Outbound 추상화:** Service 계층은 Drizzle, TypeORM 등의 구현체를 직접 호출하지 않고, 오직 RepositoryPort(Interface)만 호출하여 데이터 영속화를 인프라 계층(Adapter)으로 위임합니다.  
4. **상태 변경과 알림의 원자성:** 비즈니스 엔티티의 상태 변경(save)과 해당 사실의 전파를 위한 이벤트 생성(outbox)은 반드시 동일한 물리적 트랜잭션 라이프사이클 안에서 이루어져야 합니다.