# tmux 실전 가이드 (Mac)

## 기본 개념

tmux의 모든 명령은 **prefix 키** 이후에 입력한다.
기본 prefix: `Ctrl+b` (누르고 **손 뗀 후** 다음 키 입력)

> prefix 확인: `tmux show-option -g prefix`

---

## 세션 (Session)

| 동작 | 명령 |
|---|---|
| 새 세션 생성 | `tmux new -s 이름` |
| 세션 목록 | `tmux ls` |
| 세션 연결 | `tmux attach -t 이름` |
| 세션 분리 (detach) | `prefix` → `d` |
| 세션 종료 | `tmux kill-session -t 이름` |

---

## 창 (Window = 탭)

| 동작 | 키 |
|---|---|
| 새 창 | `prefix` → `c` |
| 다음 창 | `prefix` → `n` |
| 이전 창 | `prefix` → `p` |
| 번호로 이동 | `prefix` → `0`~`9` |
| 창 목록 선택 | `prefix` → `w` |
| 현재 창 닫기 | `exit` 또는 `Ctrl+d` |
| 창 이름 변경 | `prefix` → `,` |

---

## 패널 (Pane = 분할)

| 동작 | 키 |
|---|---|
| 세로 분할 | `prefix` → `%` |
| 가로 분할 | `prefix` → `"` |
| 패널 이동 | `prefix` → `방향키` |
| 패널 닫기 | `exit` 또는 `Ctrl+d` |
| 패널 크기 조절 | `prefix` → `Ctrl+방향키` |
| 패널 줌 (전체화면 토글) | `prefix` → `z` |

---

## 중첩 tmux (tmux 안의 tmux)

팀 에이전트 등으로 tmux 안에 tmux가 있을 때:

| 대상 | 방법 |
|---|---|
| **바깥쪽** tmux에 명령 | `prefix` → 명령키 (평소대로) |
| **안쪽** tmux에 명령 | `prefix` → `prefix` → 명령키 (prefix 2번) |

예시: 안쪽 tmux에서 다음 탭 이동 → `Ctrl+b` → `Ctrl+b` → `n`

---

## 스크롤 (복사 모드)

| 동작 | 키 |
|---|---|
| 스크롤 모드 진입 | `prefix` → `[` |
| 스크롤 | `방향키` 또는 `PgUp`/`PgDn` |
| 스크롤 모드 종료 | `q` |

---

## 유용한 명령어

```bash
# 모든 세션 종료
tmux kill-server

# 특정 창 종료
tmux kill-window -t 세션이름:창번호

# 설정 다시 로드
tmux source-file ~/.tmux.conf
```

---

## 참고 링크

- [tmux 공식 GitHub](https://github.com/tmux/tmux)
- [tmux 매뉴얼 (man page)](https://man.openbsd.org/tmux)
- [tmux cheat sheet](https://tmuxcheatsheet.com/)
- [Awesome tmux - 플러그인/리소스 모음](https://github.com/rothgar/awesome-tmux)
