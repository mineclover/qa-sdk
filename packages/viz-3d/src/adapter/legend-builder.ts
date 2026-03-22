/**
 * legend-builder — Signal Role / Category 범례 DOM 생성.
 *
 * color-tokens의 ROLE_COLORS, CATEGORY_COLORS를 받아
 * 범례 요소를 컨테이너에 렌더한다. Three.js 무의존.
 */

export interface RoleColorLike {
  readonly token: { readonly css: string };
}

export interface CategoryColorLike {
  readonly main: { readonly css: string };
}

/**
 * Signal Role 범례 dot 리스트를 생성한다.
 *
 * @param container  범례를 삽입할 DOM 요소
 * @param roleColors  ROLE_COLORS (key → { token: { css } })
 * @param onClick  role 클릭 시 콜백 (필터용)
 */
export function buildRoleLegend(
  container: HTMLElement,
  roleColors: Record<string, RoleColorLike>,
  onClick?: (role: string, el: HTMLElement) => void,
): void {
  container.innerHTML = "";
  for (const [role, rc] of Object.entries(roleColors)) {
    const sp = document.createElement("span");
    sp.className = "sl-role sl-active";
    sp.dataset.role = role;
    sp.innerHTML = `<span class="sl-dot" style="background:${rc.token.css}"></span>${role}`;
    if (onClick) sp.addEventListener("click", () => onClick(role, sp));
    container.appendChild(sp);
  }
}

/**
 * Category 칩 리스트를 생성한다.
 *
 * @param container  범례를 삽입할 DOM 요소
 * @param categoryColors  CATEGORY_COLORS (key → { main: { css } })
 */
export function buildCategoryLegend(
  container: HTMLElement,
  categoryColors: Record<string, CategoryColorLike>,
): void {
  container.innerHTML = "";
  for (const [cat, cc] of Object.entries(categoryColors)) {
    const sp = document.createElement("span");
    sp.style.cssText = `font-size:8px;color:${cc.main.css};padding:2px 5px;border:1px solid ${cc.main.css}33;border-radius:3px`;
    sp.textContent = cat;
    container.appendChild(sp);
  }
}
