---
def:
  id: canonical-format-spec
  address: def_document:v2:342151
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: address-spec
      type: depends_on
---

# Canonical Format Specification

## 목적 ^purpose

4-표현 체계(A=tuple key, B=packed int, C=hierarchical id, D=hash/uuid)에서 **C 표현(hierarchical id)**의 정규 형식을 지정한다.

## 구성 ^overview

- **C-text (colon)**: `{schema}:{version}:{index}` — API/로그/디버깅용 사람이 읽는 정규 형식
- **C-binary (layout)**: hex 컨테이너(UUID, int64) — DB PK/바이너리 저장/네트워크 전송용
- **동등성 원칙**: 모든 텍스트 프로토콜(colon, uri, compact)은 의미적으로 동등, colon은 기본값일 뿐
- **선택 근거**: colon은 hex 패턴과 충돌 없고 기존 PrefixCodec/MetaRegistry 직렬화와 호환

## C-text: colon protocol

```
{schema}:{version}:{index}
```

- **용도**: API 응답, 로그 출력, 디버깅, 사람이 읽는 모든 맥락
- **상수**: `CANONICAL_TEXT_PROTOCOL = "colon"`
- **예시**: `perm:v1:42`

### 선택 근거

- colon(`:`)은 hex 패턴(`[0-9a-f-]`)과 충돌하지 않아 가장 비모호하다.
- URI(`wi://`)는 scheme prefix로 인해 길고, compact(`-`)는 hex-only schema/version과 구분 불가능한 경우가 있다.
- 기존 PrefixCodec.serialize() / MetaRegistry.serialize()의 기본 형식과 호환된다.

## C-binary: layout protocol

```
hex container (UUID, int64, custom)
```

- **용도**: DB 기본 키, 바이너리 저장, 네트워크 전송
- **상수**: `CANONICAL_BINARY_PREFIX = "layout:"`
- **예시**: `00010001-0000-0000-0000-00000000002a` (layout:uuid)

### 선택 근거

- layout protocol은 SemanticAddress 필드를 고정 크기 hex 컨테이너에 packed하여 DB 네이티브 타입(UUID, BIGINT)에 직접 저장 가능.
- 바이너리 저장은 정렬/인덱싱/비교에서 텍스트보다 효율적.

## 동등성 원칙

모든 텍스트 프로토콜(colon, uri, compact)은 **의미적으로 동등**하다. 어느 프로토콜로 직렬화/역직렬화해도 동일한 SemanticAddress를 복원한다. colon이 canonical인 것은 기본값(default)이라는 의미이지, 다른 프로토콜이 열등하다는 의미가 아니다.

## 관련 상수

| 상수 | 값 | 위치 |
|------|------|------|
| `CANONICAL_TEXT_PROTOCOL` | `"colon"` | `weighted-index/src/semantic-address.ts` |
| `CANONICAL_BINARY_PREFIX` | `"layout:"` | `weighted-index/src/semantic-address.ts` |
