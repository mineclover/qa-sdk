# **표준 컨벤션: CQRS 데이터 흐름 및 격리 다이어그램**

본 다이어그램은 Application Service 계층을 중심으로 \*\*Command(쓰기)\*\*와 \*\*Query(읽기)\*\*의 데이터 흐름이 어떻게 완벽하게 격리되며, 인프라스트럭처(DB, Kafka)와 어떻게 상호작용하는지를 추상화한 구현 표준입니다.

## **1\. CQRS Architecture Diagram (Mermaid)**

graph TD  
    %% 스타일 정의  
    classDef writeFlow fill:\#ffebee,stroke:\#c62828,stroke-width:2px;  
    classDef readFlow fill:\#e3f2fd,stroke:\#1565c0,stroke-width:2px;  
    classDef infra fill:\#eceff1,stroke:\#607d8b,stroke-width:2px,stroke-dasharray: 5 5;  
    classDef event fill:\#fff3e0,stroke:\#e65100,stroke-width:2px;

    Client(\[클라이언트 / API Gateway\])

    subgraph "Presentation & AOP Layer (진입점)"  
        Controller\[API Controller\]  
        CommandAOP(AOP: 권한, 분산 락, 트랜잭션) ::: writeFlow  
        QueryAOP(AOP: 권한, 쿼리 캐싱) ::: readFlow  
    end

    subgraph "Application Layer (포트와 어댑터)"  
        subgraph "Write Model (Command)"  
            AppService\[App Service\<br/\>(Execution/Management Port)\] ::: writeFlow  
            Domain\[도메인 모델 / 비즈니스 규칙\] ::: writeFlow  
            WriteAdapter\[Write DB Adapter\] ::: writeFlow  
        end

        subgraph "Read Model (Query)"  
            QueryService\[Query Service\<br/\>(Query Port)\] ::: readFlow  
            ReadAdapter\[Read DB Adapter\] ::: readFlow  
        end  
    end

    subgraph "Infrastructure Layer (데이터 및 메시징)"  
        PrimaryDB\[(Primary DB\<br/\>RDB)\] ::: infra  
        Outbox\[(Outbox Table\<br/\>RDB)\] ::: infra  
          
        Debezium\[CDC 커넥터\<br/\>Debezium\] ::: event  
        Kafka{{Event Bus\<br/\>Kafka}} ::: event  
          
        ReadDB\[(Read DB\<br/\>Redis Stack)\] ::: infra  
    end

    subgraph "Background Workers"  
        SyncWorker\[Sync Worker\<br/\>Read Model Updater\] ::: event  
    end

    %% 흐름 연결  
    Client \--\>|1. HTTP/gRPC 요청| Controller  
      
    %% 쓰기 흐름  
    Controller \--\>|2. Command DTO| CommandAOP  
    CommandAOP \--\>|3. 비즈니스 로직 위임| AppService  
    AppService \--\>|4. 무결성 검증| Domain  
    AppService \--\>|5. Port 호출| WriteAdapter  
    WriteAdapter \--\>|6. Save (Tx)| PrimaryDB  
    WriteAdapter \--\>|6. Save (Tx)| Outbox

    %% 이벤트 및 동기화 흐름  
    Outbox \-.-\>|7. Binlog Polling| Debezium  
    Debezium \--\>|8. 이벤트 발행| Kafka  
    Kafka \--\>|9. 이벤트 구독| SyncWorker  
    SyncWorker \--\>|10. 데이터 정제 후 Upsert| ReadDB

    %% 읽기 흐름  
    Controller \--\>|2. Query DTO| QueryAOP  
    QueryAOP \--\>|3. 단순 조회 위임| QueryService  
    QueryService \--\>|4. Port 호출| ReadAdapter  
    ReadAdapter \--\>|5. 비정규화 데이터 검색| ReadDB

## **2\. 데이터 흐름 구현 컨벤션 해설**

위 다이어그램에 나타난 숫자의 흐름에 따라, 개발 시 반드시 지켜야 할 구현 규칙을 명시합니다.

### **🔴 Write Flow (Command 데이터 흐름)**

* **\[2\~3\] AOP 방어막:** 쓰기 요청은 컨트롤러에서 DTO 검증 후, AOP 레벨에서 @DistributedLock(식별자 기반 분산 락)과 @Transactional 설정이 선행되어야 합니다.  
* **\[4\] 도메인 순수성:** App Service는 데이터를 가공할 때 외부 인프라 코드를 사용하지 않고, 순수 TypeScript 객체인 도메인 모델의 메서드를 호출하여 상태를 변경합니다.  
* **\[5\~6\] Outbox 패턴 동기화:** DB Adapter는 데이터를 RDB에 저장할 때, 반드시 동일한 트랜잭션 내에서 **비즈니스 테이블**과 **Outbox 테이블** 양쪽에 데이터를 INSERT/UPDATE 합니다. 여기서 Application 코드는 종료되며 클라이언트에게 즉시 응답을 반환합니다.

### **🟠 Sync Flow (이벤트 및 동기화 흐름)**

* **\[7\~8\] 인프라 위임 (CDC):** 애플리케이션 코드는 Kafka 프로듀싱에 관여하지 않습니다. 인프라에 구성된 Debezium이 RDB의 트랜잭션 로그를 긁어내어(Polling) Kafka로 전달합니다. (애플리케이션 결합도 제로)  
* **\[9\~10\] 비동기 Read Model 갱신:** 분리된 컨슈머 그룹을 가진 Sync Worker가 이벤트를 수신하여, 복잡한 검색에 최적화된 형태(JSON 등)로 데이터를 가공한 뒤 Read DB(Redis Stack)에 Upsert 합니다.

### **🔵 Read Flow (Query 데이터 흐름)**

* **\[2\~3\] 직접 우회 (Bypass):** 읽기 요청은 도메인 모델이나 복잡한 Application Service를 거치지 않고, Query Service로 직행합니다.  
* **\[4\~5\] 오직 Read DB만 타겟팅:** Read DB Adapter는 절대 Primary DB(RDB)를 바라보지 않습니다. 이미 Sync Worker에 의해 조회하기 좋은 형태로 완성된 Read DB(Redis Stack)의 데이터만 빠르게 퍼올려 클라이언트에게 반환합니다. 무거운 JOIN 쿼리는 원천적으로 발생하지 않습니다.