export interface MotionEditorScenePresenceUser {
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  readonly initials?: string;
  readonly isCurrentUser?: boolean;
}

export interface MotionEditorScenePresenceEntry {
  readonly sceneId: string;
  readonly users: readonly MotionEditorScenePresenceUser[];
  readonly locked?: boolean;
  readonly lockLabel?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deriveInitials(user: MotionEditorScenePresenceUser): string {
  const explicit = user.initials?.trim();
  if (explicit) {
    return explicit.slice(0, 2);
  }

  const source = (user.name || user.userId).trim();
  if (source.length === 0) {
    return "?";
  }

  const parts = source.split(/[\s/_-]+/).filter((part) => part.length > 0);
  if (parts.length >= 2) {
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    return `${first[0] ?? ""}${second[0] ?? ""}`.slice(0, 2);
  }

  return source.slice(0, 2).toUpperCase();
}

function formatUserLabel(user: MotionEditorScenePresenceUser): string {
  return user.isCurrentUser ? `${user.name} (나)` : user.name;
}

function formatUserSummary(users: readonly MotionEditorScenePresenceUser[]): string {
  if (users.length === 0) {
    return "";
  }

  const visible = users.slice(0, 2).map((user) => formatUserLabel(user));
  if (users.length <= 2) {
    return visible.join(", ");
  }

  return `${visible.join(", ")} +${users.length - 2}`;
}

export function renderScenePresenceBadges(
  entry: MotionEditorScenePresenceEntry | null | undefined,
  options: {
    readonly compact?: boolean;
    readonly showNames?: boolean;
  } = {},
): string {
  if (!entry) {
    return "";
  }

  const compact = options.compact ?? false;
  const showNames = options.showNames ?? false;
  const maxAvatars = compact ? 2 : 3;
  const users = entry.users;
  if (users.length === 0 && !entry.locked) {
    return "";
  }

  const avatarMarkup = users
    .slice(0, maxAvatars)
    .map((user) => {
      const label = formatUserLabel(user);
      return `
        <span
          class="mce-user-badge"
          data-user-self="${user.isCurrentUser ? "true" : "false"}"
          title="${escapeHtml(label)}"
          style="--mce-user-color:${escapeHtml(user.color)}"
        >${escapeHtml(deriveInitials(user))}</span>
      `;
    })
    .join("");

  const extraMarkup = users.length > maxAvatars
    ? `<span class="mce-user-badge mce-user-badge--more" title="${escapeHtml(formatUserSummary(users.slice(maxAvatars)))}">+${users.length - maxAvatars}</span>`
    : "";

  const namesMarkup = showNames && users.length > 0
    ? `<span class="mce-scene-presence__names">${escapeHtml(formatUserSummary(users))}</span>`
    : "";

  const lockLabel = entry.lockLabel?.trim() || "다른 사용자가 편집 중";
  const lockMarkup = entry.locked
    ? `<span class="mce-lock-pill" title="${escapeHtml(lockLabel)}" aria-label="${escapeHtml(lockLabel)}">LOCK</span>`
    : "";

  return `
    <span
      class="mce-scene-presence ${compact ? "mce-scene-presence--compact" : ""}"
      data-scene-users="${users.length}"
      data-scene-locked="${entry.locked ? "true" : "false"}"
    >
      <span class="mce-scene-presence__avatars">${avatarMarkup}${extraMarkup}</span>
      ${namesMarkup}
      ${lockMarkup}
    </span>
  `;
}
