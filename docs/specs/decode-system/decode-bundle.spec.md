---
def:
  id: decode-bundle
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decode-service
  tags: [tier-infra]
  links:
    - target: meta-registry-spec
      type: depends_on
---
# DecodeMap 번들 관리

## 목적 ^purpose

decode에 필요한 최소 데이터(entity name → ID 매핑)를 DecodeMap 번들로 패키징하고, 캐시/갱신을 관리한다. 전체 MetaRegistry 대신 필요한 prefix의 DecodeMap만 로드한다.

## 구성 ^overview

- **DecoderPool** — prefix/version별 PrefixDecoder 인스턴스를 TTL 기반으로 캐시.
- **DecodeMap 구조** — `{ indexId, versionId, shape, size, dims[] }` 형태의 경량 번들.
- **로딩 소스** — registry-service `/api/decode-map` 또는 D1 바인딩에서 catalog 직접 조회.
- **dim 종류** — axis(string_enum), prefix_ref(index_ref), table_ref(string_enum, `_ref` 고정).

## DecoderPool 동작

`DecoderPool`은 decode-service의 핵심 캐시 레이어다.

| 메서드 | 설명 |
|--------|------|
| `load(config)` | PrefixDecoderConfig → PrefixDecoder 생성 후 캐시 등록 |
| `loadMap(map)` | DecodeMap으로 직접 등록 (refs 없이) |
| `get(prefix, version)` | decoder 조회. TTL 만료 시 null 반환하고 캐시에서 제거 |
| `values()` | 유효한 모든 decoder 반환 (TTL 만료 항목은 제거 후 제외) |
| `evict(prefix, version)` | 특정 decoder 명시 제거 |
| `clear()` | 전체 캐시 초기화 |

- 캐시 키: `${prefix}:${version}`
- TTL: `CACHE_TTL_MS` (기본 60초). 0이면 만료 없음 (Worker 모드).

## DecodeMap 빌드 규칙

Catalog에서 DecodeMap을 생성하는 규칙:

1. **axis dim** — catalog의 해당 축 버전에서 entries 목록과 capacity를 추출
2. **prefix_ref dim** — `refEntries`가 있으면 정수 배열을 entries로 변환. **refEntries 없으면 해당 prefix 전체를 무효화** (CON-006)
3. **table_ref dim** — `_ref` 단일 entries로 처리 (shape=1)
4. size는 shape의 곱으로 계산

## 번들 공급 경로

### Node.js (Standalone)

```
서비스 시작 → loadFromRegistry(REGISTRY_URL) → fetch /api/decode-map
→ pool.loadMap(map) × N → 서비스 준비 완료
```

실패 시 빈 pool로 시작 (fail-open). 이후 요청 시 DECODER_NOT_LOADED 에러.

### Cloudflare Workers (Sidecar)

```
첫 요청 → ensureLoaded(env)
  → REGISTRY_DB 있으면: D1에서 catalog 직접 조회 (loadFromD1)
  → 없으면: HTTP fetch fallback (loadFromHttp)
→ buildDecodeMaps(catalog) → pool.loadMap(map) × N
```

- D1 경로가 더 빠름 (같은 Cloudflare 인프라 내 바인딩)
- `/debug` 엔드포인트로 poolSize, loadError, loadStats 진단 가능

## 갱신 전략

- TTL 만료 시 다음 접근에서 null 반환 → 클라이언트가 재요청
- 능동적 갱신은 구현되지 않음 (pull 모델)
- Worker 모드에서는 TTL=0 (한 번 로드 후 프로세스 수명 동안 유지)
