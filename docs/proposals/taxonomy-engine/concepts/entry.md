# Entry — 좌표값

> 한 [[axis]] 위의 한 점. 텍소노미의 가장 작은 의미 단위.

## 정의

[[axis]] 한 차원에 속한 좌표값 하나. **두 이름을 동시에 가진다** — id와 address.

## 목적

- "이 차원의 이 값이 무엇인가"를 사람이 읽을 수 있게 라벨링 (id)
- 동시에 영구 안전한 주소를 부여해 외부 참조에서 깨지지 않게 함 (address)
- 의미와 위치를 분리하여 rename에 강건

## 구조 (개념)

| 속성 | 의미 |
|------|------|
| `id` | kebab-case 라벨 — 사람용, **변경 가능** |
| `address` | 정수 — 시스템용, **불변** |
| `label?` | UI 표시용 자연어 (선택) |
| `meta?` | 도메인 부가 정보 (선택) |

## 핵심 원리

### id vs address — 이중 이름의 이유

| 차원 | id | address |
|------|-----|--------|
| 청중 | 사람 | 시스템 |
| 형식 | kebab-case 단어 | 정수 |
| 변경 | 자유롭게 | 불변 (한 번 부여하면) |
| 사용 | yaml, CLI, 진단 메시지 | 코드, DB row, 영구 링크 |

좌표를 영구 저장하는 모든 곳(코드, 데이터베이스, 링크)은 address를 잡고, 사람이 말하는 모든 곳(문서, UI)은 id를 쓴다. id rename은 시스템 어디도 깨지 않는다.

### 자동 address 할당

yaml에 `address` 미명시 시 indexer가 sequential(0, 1, 2, ...) 할당. 명시한 경우 그 값 보존. 한 번 할당된 address는 yaml에 명시되어 이후 보존.

### 중복 금지

한 axis 안에서 두 entry가 같은 address를 가지면 안 됨 (`structural-duplicate-address` error). id도 마찬가지 (`structural-duplicate-id` error).

### `_loc` — 원본 위치 추적

parser가 yaml 줄/칸을 entry에 부착. IDE/LSP의 jump-to-definition 기반. 단 codegen 출력에서는 제거 (IR 본질 아님).

## 다른 개념과의 관계

- [[axis]] — Entry의 소속 차원
- [[coordinate]] — Entry들의 튜플로 만든 좌표점
- [[relation]] rules — Entry id로 점 사이 화살표를 선언

## 사용 예시

`qa-sdk-coordinate-system:scope.apm`은 Entry 하나:
- id: `apm`
- address: 0
- axis: `scope`

`qa-sdk-coordinate-system::scope#0` (address-based ref)도 같은 Entry. id가 `apm`에서 `apm-system`으로 rename되어도 이 address ref는 그대로 유효.

## 참조

- spec: `docs/proposals/taxonomy-engine/00-design.md` §4.2, §5.1 (ref tier)
- address 분리 결정: 메모리 `project_adr-address-separation`
- 좌표계 본질: 메모리 `project_coordinate-system-identity`
