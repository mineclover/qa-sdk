# Docs Control Plane

이 모듈은 문서형 source를 하나의 neutral envelope로 조회하기 위한 local CLI
support boundary다. Definition docs, PRD, ralph JSON, session, evidence,
diagnostic을 원본 schema 병합이나 대체 없이 표현한다.

Repository 파일이 source of truth다. Control plane은 index/coordination layer일
뿐이다. Adapter는 source 파일이나 기존 store를 읽어 `DocumentEnvelope`를 만들고,
`kind`, `status`, relation `type`, diagnostic `severity` 같은 source-owned
vocabulary를 plain string field로 보존한다.

이 story는 REST endpoint, remote service, database migration, 새 artifact
vocabulary를 추가하지 않는다.

## Boundary

- `DocumentEnvelope`는 normalized read model이다.
- `DocumentAdapter`는 read-only collection method만 노출한다.
- `DocumentAdapterCapabilities`는 adapter의 write/transform 가능 여부만 선언한다.
  Control plane 자체는 write path를 만들지 않는다.
- `DocumentChangeSet`은 future adapter가 write/transform을 명시적으로 opt in할 때
  사용할 neutral proposed-change container다.
