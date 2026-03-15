/**
 * mode-toggle.ts — 상호 배타적 모드 선택 버튼 그룹.
 *
 * DOM Element를 반환하며, 이벤트 바인딩 포함.
 */

export interface ToggleOption {
  id: string;
  label: string;
}

/** 모드 토글 버튼 그룹 생성. */
export function createModeToggle(
  options: ToggleOption[],
  activeId: string,
  onChange: (id: string) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "ui-toggle";

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "ui-toggle-btn";
    btn.dataset.id = opt.id;
    btn.textContent = opt.label;
    if (opt.id === activeId) btn.classList.add("ui-toggle-active");
    btn.addEventListener("click", () => {
      if (opt.id === wrap.dataset.activeId) return;
      setModeToggleActive(wrap, opt.id);
      onChange(opt.id);
    });
    wrap.appendChild(btn);
  }

  wrap.dataset.activeId = activeId;
  return wrap;
}

/** 활성 버튼 상태 업데이트. */
export function setModeToggleActive(el: HTMLElement, activeId: string): void {
  el.dataset.activeId = activeId;
  for (const btn of el.querySelectorAll<HTMLButtonElement>(".ui-toggle-btn")) {
    btn.classList.toggle("ui-toggle-active", btn.dataset.id === activeId);
  }
}
