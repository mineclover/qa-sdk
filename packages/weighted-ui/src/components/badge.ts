/**
 * badge.ts — 도메인 독립 인라인 배지/태그 유틸리티.
 *
 * 모든 함수는 HTML string을 반환. 프레임워크 의존 없음.
 */

/** 단색 인라인 배지 */
export function badge(text: string, fill: string, ink: string): string {
  return `<span class="ui-badge" style="background:${fill};color:${ink}">${text}</span>`;
}

/** 그룹 배지 (label → value → info 구조) */
export function chip(parts: {
  label?: string;
  value: string;
  info?: string;
  fill: string;
  ink: string;
  isNew?: boolean;
}): string {
  const labelHtml = parts.label
    ? `<span class="ui-chip-label">${parts.label}</span>`
    : "";
  const newHtml = parts.isNew ? ` ${newTag()}` : "";
  const infoHtml = parts.info
    ? `<span class="ui-chip-info">${parts.info}${newHtml}</span>`
    : newHtml;
  return `
    <div class="ui-chip" style="--c:${parts.ink}">
      ${labelHtml}
      <span class="ui-chip-val" style="background:${parts.fill};color:${parts.ink}">${parts.value}</span>
      ${infoHtml}
    </div>
  `;
}

/** 코드 스타일 배지 */
export function codeBadge(text: string): string {
  return `<code class="ui-code">${text}</code>`;
}

/** NEW 태그 */
export function newTag(): string {
  return `<span class="new-tag">NEW</span>`;
}

/** 정보 배지 (variant별 색상) */
export function infoBadge(
  text: string,
  variant: "green" | "gray" | "blue" | "red",
): string {
  return `<span class="info-badge info-badge-${variant}">${text}</span>`;
}
