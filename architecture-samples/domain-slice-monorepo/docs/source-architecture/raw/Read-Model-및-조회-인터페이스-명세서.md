# **아키텍처 설계서: Read Model 및 도메인 간 조회 인터페이스 명세**

본 문서는 모듈러 모놀리스(Modular Monolith) 및 CQRS 환경에서 \*\*특정 도메인이 타 도메인에게 데이터를 제공하는 방식(조회 인터페이스 노출)\*\*과, 대규모 검색을 처리하기 위한 **Read Model 구축 및 동기화 전략**을 심층적으로 다룹니다.

## **1\. 도메인 간 조회 인터페이스 (In-Process API) 노출 원칙**

마이크로서비스나 모듈러 모놀리스 환경에서 A 도메인이 B 도메인의 데이터를 필요로 할 때, B 도메인의 DB 테이블을 직접 조회하는 것은 결합도를 높이는 심각한 안티패턴입니다. 타 도메인에 데이터를 제공할 때는 반드시 \*\*명시적인 인터페이스(Port)\*\*와 **읽기 전용 DTO**를 노출해야 합니다.

### **1.1. 추상화된 Query Port 제공 (계약 기반 통신)**

데이터를 제공하는 도메인은 내부 구현체(Service, Repository)를 숨기고, 외부 도메인이 호출할 수 있는 추상화된 포트(QueryPort)만 모듈(Module) 밖으로 Export 합니다.

// \[제공자: 프로젝트 도메인\] \- 외부 노출용 Port (interface 또는 abstract class)  
export abstract class ProjectQueryPort {  
  /\*\*  
   \* 프로젝트의 현재 요약 상태를 반환합니다.  
   \* 내부 테이블 구조가 변경되어도 이 인터페이스의 명세는 유지됩니다.  
   \*/  
  abstract getProjectSummary(projectId: string): Promise\<ProjectSummaryReadDto\>;  
  abstract checkProjectIsActive(projectId: string): Promise\<boolean\>;  
}

// \[제공자: 프로젝트 도메인\] \- 외부 노출용 읽기 전용 DTO (Entity 노출 절대 금지)  
export class ProjectSummaryReadDto {  
  projectId: string;  
  projectName: string;  
  status: 'ACTIVE' | 'CLOSED' | 'PENDING';  
  managerCount: number;  
}

### **1.2. 소비자(Consumer) 도메인의 의존성 주입**

데이터를 소비하는 도메인은 네트워크(HTTP/gRPC) 통신 없이, DI(의존성 주입) 컨테이너를 통해 메모리 상에서 해당 포트를 주입받아 사용합니다. (In-Process Call)

// \[소비자: 담당자 배정 도메인\] \- 타 도메인의 Port에만 의존  
@Injectable()  
export class ManagerAssignmentService {  
  constructor(  
    // 프로젝트 도메인이 노출한 Port를 주입받음 (구현체인 Service에 의존하지 않음)  
    private readonly projectQueryPort: ProjectQueryPort,  
  ) {}

  async assign(command: AssignManagerCommand) {  
    // 내부적으로는 메모리 상의 메서드 호출이지만, 논리적으로는 API 호출과 동일한 격리 수준  
    const isActive \= await this.projectQueryPort.checkProjectIsActive(command.projectId);  
    if (\!isActive) throw new DomainException('활성화되지 않은 프로젝트입니다.');  
      
    // ... 배정 비즈니스 로직  
  }  
}

## **2\. Read Model의 개념 및 구축 전략**

단순한 ID 기반의 조회가 아니라 다중 조건 검색(예: 상태가 ACTIVE이고 특정 공정에 속한 프로젝트의 배정 내역 전체)이 필요한 경우, 타 도메인의 API를 매번 호출해서 메모리에서 조인(Join)하는 것은 성능상 불가능합니다. 이때 **Read Model**이 필요합니다.

### **2.1. Read Model 이란?**

* 데이터를 '저장(Write)'할 때의 정규화된 테이블 구조를 버리고, 오직 **'조회(Read)' 목적에 맞게 비정규화(Denormalization)하여 평탄화한 데이터 모델**입니다.  
* 주로 Redis Stack(JSON), ElasticSearch, 또는 읽기 전용으로 분리된 NoSQL 문서 데이터베이스에 적재됩니다.

### **2.2. Event-Driven Read Model 동기화 메커니즘**

Read Model은 Write Model(Primary DB)의 변경 사항을 이벤트를 통해 전달받아 백그라운드에서 갱신됩니다.

sequenceDiagram  
    participant CommandAPI as Command Service (배정)  
    participant PrimaryDB as Primary DB (RDB)  
    participant Kafka as Event Bus (Kafka)  
    participant SyncWorker as Read Model Updater  
    participant ReadDB as Read DB (Redis/ES)

    CommandAPI-\>\>PrimaryDB: 1\. 도메인 저장 & Outbox 적재 (Tx)  
    PrimaryDB--\>\>Kafka: 2\. CDC (Debezium) 폴링 후 발행  
    Kafka-\>\>SyncWorker: 3\. 이벤트 구독 (ManagerAssignedEvent)  
      
    activate SyncWorker  
    Note right of SyncWorker: 4\. 비정규화 및 데이터 합성\<br/\>(필요시 타 도메인 QueryPort 호출)  
    SyncWorker-\>\>ReadDB: 5\. JSON 문서 Upsert (Read Model 갱신)  
    deactivate SyncWorker

### **2.3. 데이터 합성 (Data Composition) 전략**

SyncWorker가 이벤트를 받아 Read DB를 갱신할 때, 타 도메인의 정보(예: 프로젝트 명칭 등)를 합쳐서(Compose) 하나의 완성된 문서(Document)로 만들어야 합니다.

* **이벤트 페이로드(Payload) 비대화:** 이벤트 발생 시점부터 프로젝트 명칭, 과정 명칭 등을 꽉 채워서(Fat Event) 발행하는 방식. (Consumer 작업이 빠르나 발행쪽 로직이 무거워짐)  
* **Back-query (권장):** 이벤트에는 projectId, processId 등 식별자만 담아 발행하고, SyncWorker가 이를 수신했을 때 각 도메인의 QueryPort를 병렬로 호출하여 최신 명칭을 조회한 후 조립하여 Read DB에 저장하는 방식.

## **3\. 데이터 일관성 및 장애 대비 (Eventual Consistency)**

Read Model은 태생적으로 원본 DB와 시간차(지연)를 가지는 \*\*결과적 일관성(Eventual Consistency)\*\*을 띕니다. 이를 제어하기 위한 정책적 합의와 기술적 방어가 필요합니다.

### **3.1. 사용자 경험(UX) 제어 전략**

* **지연 수용:** 1\~2초 내외의 검색 결과 반영 지연은 시스템적으로 정상임을 현업과 합의합니다.  
* **로컬 캐싱(Optimistic UI):** 사용자가 직접 추가/수정한 데이터는 클라이언트(프론트엔드) 상태나 브라우저 캐시에 즉시 반영하여, 서버의 Read DB가 갱신되는 시간 동안 자연스러운 사용자 경험을 제공합니다.

### **3.2. 정합성 복구 (Rebuilding Read Model)**

Redis 장애나 Kafka 메시지 유실, 비즈니스 로직 버그 등으로 원본 DB와 Read Model 간의 데이터가 심각하게 틀어질 경우를 대비한 '재구축(Rebuild)' 프로세스가 필수입니다.

* **Rebuild 배치 잡 (CronJob):** 관리자 기능으로 "Read Model 전체 동기화" 버튼을 제공하거나 심야 스케줄러를 구성합니다.  
* 이 잡은 Primary DB를 통째로 읽어 비정규화 로직을 다시 태운 후 Read DB를 덮어씁니다(Bulk Upsert).

## **4\. 구현 규약 및 요약**

1. **조회 인터페이스 노출:** 도메인 데이터 제공은 반드시 QueryPort (Interface/Abstract Class)와 ReadDto를 통해서만 이루어져야 하며, Entity 직접 노출 및 DB 직접 접근은 엄격히 금지합니다.  
2. **복합 검색의 책임 이동:** 여러 도메인이 얽힌 검색 조건은 Primary DB에 JOIN 쿼리를 날리는 대신, 백그라운드 워커에 의해 비정규화된 Read Model (Read DB)에 전가합니다.  
3. **결과적 일관성의 관리:** Read DB 갱신은 이벤트(Kafka)를 통해 비동기로 처리되며, 시스템 모니터링을 통해 이벤트 처리 지연 시간(Lag)을 핵심 지표로 관제해야 합니다.