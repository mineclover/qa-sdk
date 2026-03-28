const WS_OPEN_READY_STATE = 1;
const DEFAULT_RECONNECT_INITIAL_DELAY_MS = 250;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 5_000;
const DEFAULT_RECONNECT_MULTIPLIER = 2;

export interface MotionWorkspacePresenceCursor {
  readonly x: number;
  readonly y: number;
}

export interface MotionWorkspacePresenceInfo {
  readonly userId: string;
  readonly activeSceneId?: string;
  readonly cursor?: MotionWorkspacePresenceCursor;
}

export interface MotionWorkspaceWsSceneLockInfo {
  readonly sceneId: string;
  readonly userId: string;
}

export type MotionWorkspaceWsSceneUnlockReason =
  | "explicit"
  | "disconnect"
  | "timeout";

export interface MotionWorkspaceWsConnectedMessage {
  readonly type: "connected";
  readonly workspaceId: string;
  readonly userId: string;
  readonly sceneLocks: readonly MotionWorkspaceWsSceneLockInfo[];
  readonly presences: readonly MotionWorkspacePresenceInfo[];
}

export interface MotionWorkspaceWsBroadcastMessage {
  readonly type: "workspace-message";
  readonly workspaceId: string;
  readonly userId: string;
  readonly payload: unknown;
}

export interface MotionWorkspaceWsSceneLockMessage extends MotionWorkspaceWsSceneLockInfo {
  readonly type: "scene:lock";
  readonly workspaceId: string;
  readonly holders: readonly string[];
  readonly warning: boolean;
}

export interface MotionWorkspaceWsSceneUnlockMessage extends MotionWorkspaceWsSceneLockInfo {
  readonly type: "scene:unlock";
  readonly workspaceId: string;
  readonly holders: readonly string[];
  readonly reason: MotionWorkspaceWsSceneUnlockReason;
}

export interface MotionWorkspaceWsPresenceMessage extends MotionWorkspacePresenceInfo {
  readonly type: "presence";
  readonly workspaceId: string;
}

export interface MotionWorkspaceWsSceneUpdatedMessage {
  readonly type: "scene:updated";
  readonly workspaceId: string;
  readonly sceneId: string;
  readonly revision: number;
}

export interface MotionWorkspaceWsResourceUpdatedMessage {
  readonly type: "resource:updated";
  readonly workspaceId: string;
  readonly revision: number;
}

export interface MotionWorkspaceWsErrorMessage {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
}

export type MotionWorkspaceWsServerMessage =
  | MotionWorkspaceWsBroadcastMessage
  | MotionWorkspaceWsConnectedMessage
  | MotionWorkspaceWsSceneLockMessage
  | MotionWorkspaceWsSceneUnlockMessage
  | MotionWorkspaceWsPresenceMessage
  | MotionWorkspaceWsSceneUpdatedMessage
  | MotionWorkspaceWsResourceUpdatedMessage
  | MotionWorkspaceWsErrorMessage;

export interface MotionWorkspaceWsPresenceInput {
  readonly activeSceneId?: string;
  readonly cursor?: MotionWorkspacePresenceCursor;
}

export interface MotionWorkspaceWsReconnectOptions {
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly multiplier?: number;
}

export interface MotionWorkspaceWsReconnectEvent {
  readonly attempt: number;
  readonly delayMs: number;
  readonly workspaceId: string;
  readonly userId: string;
}

export interface MotionWorkspaceWsCloseEvent {
  readonly code?: number;
  readonly reason?: string;
  readonly wasClean?: boolean;
}

export interface MotionWorkspaceWsMessageEvent {
  readonly data: unknown;
}

export interface MotionWorkspaceWebSocketLike {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: MotionWorkspaceWsMessageEvent) => void) | null;
  onclose: ((event: MotionWorkspaceWsCloseEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type MotionWorkspaceWebSocketFactory = (
  url: string,
) => MotionWorkspaceWebSocketLike | Promise<MotionWorkspaceWebSocketLike>;

export interface MotionWorkspaceWsHandlers {
  readonly userId: string;
  readonly createWebSocket?: MotionWorkspaceWebSocketFactory;
  readonly reconnect?: MotionWorkspaceWsReconnectOptions;
  onConnected?(message: MotionWorkspaceWsConnectedMessage): void;
  onMessage?(message: MotionWorkspaceWsServerMessage): void;
  onWorkspaceMessage?(message: MotionWorkspaceWsBroadcastMessage): void;
  onSceneLock?(message: MotionWorkspaceWsSceneLockMessage): void;
  onSceneUnlock?(message: MotionWorkspaceWsSceneUnlockMessage): void;
  onPresence?(message: MotionWorkspaceWsPresenceMessage): void;
  onSceneUpdated?(message: MotionWorkspaceWsSceneUpdatedMessage): void;
  onResourceUpdated?(message: MotionWorkspaceWsResourceUpdatedMessage): void;
  onServerError?(message: MotionWorkspaceWsErrorMessage): void;
  onTransportError?(error: unknown): void;
  onReconnect?(event: MotionWorkspaceWsReconnectEvent): void;
  onDisconnected?(event: MotionWorkspaceWsCloseEvent): void;
}

interface MotionWorkspaceWsConnectionOptions {
  readonly baseUrl: string;
  readonly workspaceId: string;
  readonly handlers: MotionWorkspaceWsHandlers;
}

interface ResolvedMotionWorkspaceWsReconnectOptions {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
}

interface MotionWorkspaceWsSceneControlMessage {
  readonly type: "scene:lock" | "scene:unlock";
  readonly sceneId: string;
  readonly userId: string;
}

interface MotionWorkspaceWsPresenceClientMessage extends MotionWorkspaceWsPresenceInput {
  readonly type: "presence";
  readonly userId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function normalizeNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName}는 비어 있을 수 없습니다.`);
  }
  return normalized;
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function isPresenceCursor(value: unknown): value is MotionWorkspacePresenceCursor {
  return isRecord(value)
    && isFiniteNumber(value["x"])
    && isFiniteNumber(value["y"]);
}

function isPresenceInfo(value: unknown): value is MotionWorkspacePresenceInfo {
  return isRecord(value)
    && isNonEmptyString(value["userId"])
    && (
      value["activeSceneId"] === undefined
      || isNonEmptyString(value["activeSceneId"])
    )
    && (
      value["cursor"] === undefined
      || isPresenceCursor(value["cursor"])
    );
}

function isSceneLockInfo(value: unknown): value is MotionWorkspaceWsSceneLockInfo {
  return isRecord(value)
    && isNonEmptyString(value["sceneId"])
    && isNonEmptyString(value["userId"]);
}

function isConnectedMessage(value: unknown): value is MotionWorkspaceWsConnectedMessage {
  return isRecord(value)
    && value["type"] === "connected"
    && isNonEmptyString(value["workspaceId"])
    && isNonEmptyString(value["userId"])
    && Array.isArray(value["sceneLocks"])
    && value["sceneLocks"].every(isSceneLockInfo)
    && Array.isArray(value["presences"])
    && value["presences"].every(isPresenceInfo);
}

function isBroadcastMessage(value: unknown): value is MotionWorkspaceWsBroadcastMessage {
  return isRecord(value)
    && value["type"] === "workspace-message"
    && isNonEmptyString(value["workspaceId"])
    && isNonEmptyString(value["userId"])
    && "payload" in value;
}

function isSceneLockMessage(value: unknown): value is MotionWorkspaceWsSceneLockMessage {
  return isRecord(value)
    && value["type"] === "scene:lock"
    && isNonEmptyString(value["workspaceId"])
    && isNonEmptyString(value["sceneId"])
    && isNonEmptyString(value["userId"])
    && isStringArray(value["holders"])
    && typeof value["warning"] === "boolean";
}

function isSceneUnlockReason(value: unknown): value is MotionWorkspaceWsSceneUnlockReason {
  return value === "explicit" || value === "disconnect" || value === "timeout";
}

function isSceneUnlockMessage(value: unknown): value is MotionWorkspaceWsSceneUnlockMessage {
  return isRecord(value)
    && value["type"] === "scene:unlock"
    && isNonEmptyString(value["workspaceId"])
    && isNonEmptyString(value["sceneId"])
    && isNonEmptyString(value["userId"])
    && isStringArray(value["holders"])
    && isSceneUnlockReason(value["reason"]);
}

function isPresenceMessage(value: unknown): value is MotionWorkspaceWsPresenceMessage {
  return isRecord(value)
    && value["type"] === "presence"
    && isNonEmptyString(value["workspaceId"])
    && isPresenceInfo(value);
}

function isSceneUpdatedMessage(value: unknown): value is MotionWorkspaceWsSceneUpdatedMessage {
  return isRecord(value)
    && value["type"] === "scene:updated"
    && isNonEmptyString(value["workspaceId"])
    && isNonEmptyString(value["sceneId"])
    && isFiniteNumber(value["revision"]);
}

function isResourceUpdatedMessage(value: unknown): value is MotionWorkspaceWsResourceUpdatedMessage {
  return isRecord(value)
    && value["type"] === "resource:updated"
    && isNonEmptyString(value["workspaceId"])
    && isFiniteNumber(value["revision"]);
}

function isErrorMessage(value: unknown): value is MotionWorkspaceWsErrorMessage {
  return isRecord(value)
    && value["type"] === "error"
    && isNonEmptyString(value["code"])
    && isNonEmptyString(value["message"]);
}

export function isMotionWorkspaceWsServerMessage(
  value: unknown,
): value is MotionWorkspaceWsServerMessage {
  return isConnectedMessage(value)
    || isBroadcastMessage(value)
    || isSceneLockMessage(value)
    || isSceneUnlockMessage(value)
    || isPresenceMessage(value)
    || isSceneUpdatedMessage(value)
    || isResourceUpdatedMessage(value)
    || isErrorMessage(value);
}

export function parseMotionWorkspaceWsMessage(
  value: string,
): MotionWorkspaceWsServerMessage | null {
  let payload: unknown;
  try {
    payload = JSON.parse(value) as unknown;
  } catch {
    return null;
  }

  return isMotionWorkspaceWsServerMessage(payload) ? payload : null;
}

function normalizeReconnectOptions(
  options: MotionWorkspaceWsReconnectOptions | undefined,
): ResolvedMotionWorkspaceWsReconnectOptions {
  const initialDelayMs = isFiniteNumber(options?.initialDelayMs) && options.initialDelayMs >= 0
    ? options.initialDelayMs
    : DEFAULT_RECONNECT_INITIAL_DELAY_MS;
  const maxDelayMs = isFiniteNumber(options?.maxDelayMs) && options.maxDelayMs >= initialDelayMs
    ? options.maxDelayMs
    : DEFAULT_RECONNECT_MAX_DELAY_MS;
  const multiplier = isFiniteNumber(options?.multiplier) && options.multiplier >= 1
    ? options.multiplier
    : DEFAULT_RECONNECT_MULTIPLIER;

  return {
    initialDelayMs,
    maxDelayMs,
    multiplier,
  };
}

function computeReconnectDelay(
  options: ResolvedMotionWorkspaceWsReconnectOptions,
  attempt: number,
): number {
  if (attempt <= 1) {
    return options.initialDelayMs;
  }

  const scaled = options.initialDelayMs * (options.multiplier ** (attempt - 1));
  return Math.min(options.maxDelayMs, scaled);
}

function resolveBaseUrl(baseUrl: string): URL {
  try {
    return new URL(baseUrl);
  } catch {
    const locationHref = globalThis.location?.href;
    if (typeof locationHref !== "string") {
      throw new Error("상대 baseUrl은 globalThis.location이 있는 환경에서만 사용할 수 있습니다.");
    }
    return new URL(baseUrl, locationHref);
  }
}

export function createMotionWorkspaceWsUrl(
  baseUrl: string,
  workspaceId: string,
  userId: string,
): string {
  const url = resolveBaseUrl(baseUrl);
  const normalizedPath = `${url.pathname.replace(/\/+$/, "")}/workspaces/${encodeURIComponent(workspaceId)}/ws`;
  url.pathname = normalizedPath.replace(/\/{2,}/g, "/");
  url.search = "";
  url.searchParams.set("userId", userId);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }

  return url.toString();
}

function resolveWebSocketFactory(
  createWebSocket?: MotionWorkspaceWebSocketFactory,
): MotionWorkspaceWebSocketFactory {
  if (createWebSocket) {
    return createWebSocket;
  }

  if (typeof globalThis.WebSocket !== "function") {
    throw new Error(
      "global WebSocket가 없어 WS 연결을 초기화할 수 없습니다. createWebSocket 옵션을 제공하세요.",
    );
  }

  return (url) => new globalThis.WebSocket(url) as unknown as MotionWorkspaceWebSocketLike;
}

export class MotionWorkspaceWsConnection {
  readonly workspaceId: string;
  readonly userId: string;

  private readonly url: string;
  private readonly handlers: MotionWorkspaceWsHandlers;
  private readonly createWebSocket: MotionWorkspaceWebSocketFactory;
  private readonly reconnectOptions: ResolvedMotionWorkspaceWsReconnectOptions;
  private readonly desiredSceneLocks = new Set<string>();
  private desiredPresence?: MotionWorkspaceWsPresenceInput;
  private socket: MotionWorkspaceWebSocketLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private generation = 0;
  private closedByClient = false;

  constructor(options: MotionWorkspaceWsConnectionOptions) {
    this.workspaceId = normalizeNonEmptyString(options.workspaceId, "workspaceId");
    this.userId = normalizeNonEmptyString(options.handlers.userId, "userId");
    this.url = createMotionWorkspaceWsUrl(options.baseUrl, this.workspaceId, this.userId);
    this.handlers = options.handlers;
    this.createWebSocket = resolveWebSocketFactory(options.handlers.createWebSocket);
    this.reconnectOptions = normalizeReconnectOptions(options.handlers.reconnect);
    void this.openSocket();
  }

  get connected(): boolean {
    return this.socket?.readyState === WS_OPEN_READY_STATE;
  }

  disconnect(code = 1000, reason = "client_disconnect"): void {
    this.closedByClient = true;
    this.clearReconnectTimer();

    const socket = this.socket;
    if (socket) {
      socket.close(code, reason);
      return;
    }

    this.socket = null;
  }

  lockScene(sceneId: string): void {
    const normalizedSceneId = normalizeNonEmptyString(sceneId, "sceneId");
    this.desiredSceneLocks.add(normalizedSceneId);
    this.sendJson({
      type: "scene:lock",
      sceneId: normalizedSceneId,
      userId: this.userId,
    } satisfies MotionWorkspaceWsSceneControlMessage);
  }

  unlockScene(sceneId: string): void {
    const normalizedSceneId = normalizeNonEmptyString(sceneId, "sceneId");
    this.desiredSceneLocks.delete(normalizedSceneId);
    this.sendJson({
      type: "scene:unlock",
      sceneId: normalizedSceneId,
      userId: this.userId,
    } satisfies MotionWorkspaceWsSceneControlMessage);
  }

  sendPresence(input: MotionWorkspaceWsPresenceInput = {}): void {
    const activeSceneId = parseOptionalString(input.activeSceneId);
    if (input.activeSceneId !== undefined && activeSceneId === undefined) {
      throw new Error("activeSceneId는 비어 있을 수 없습니다.");
    }
    if (input.cursor !== undefined && !isPresenceCursor(input.cursor)) {
      throw new Error("cursor는 { x, y } 형식의 finite number여야 합니다.");
    }

    this.desiredPresence = {
      ...(activeSceneId ? { activeSceneId } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    };

    this.sendJson({
      type: "presence",
      userId: this.userId,
      ...this.desiredPresence,
    } satisfies MotionWorkspaceWsPresenceClientMessage);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async openSocket(): Promise<void> {
    const generation = ++this.generation;

    try {
      const socket = await this.createWebSocket(this.url);
      if (this.closedByClient || generation !== this.generation) {
        socket.close(1000, "stale_connection");
        return;
      }

      this.attachSocket(socket, generation);
    } catch (error) {
      this.handlers.onTransportError?.(error);
      this.scheduleReconnect();
    }
  }

  private attachSocket(
    socket: MotionWorkspaceWebSocketLike,
    generation: number,
  ): void {
    this.socket = socket;

    socket.onopen = () => {
      if (!this.isCurrentSocket(socket, generation)) {
        return;
      }
      this.clearReconnectTimer();
    };

    socket.onmessage = (event) => {
      if (!this.isCurrentSocket(socket, generation)) {
        return;
      }

      const raw = typeof event.data === "string" ? event.data : String(event.data);
      const message = parseMotionWorkspaceWsMessage(raw);
      if (!message) {
        this.handlers.onTransportError?.(
          new Error(`알 수 없는 WS 메시지를 수신했습니다: ${raw}`),
        );
        return;
      }

      this.handlers.onMessage?.(message);

      switch (message.type) {
        case "connected":
          this.reconnectAttempt = 0;
          this.handlers.onConnected?.(message);
          this.flushDesiredState();
          return;
        case "workspace-message":
          this.handlers.onWorkspaceMessage?.(message);
          return;
        case "scene:lock":
          this.handlers.onSceneLock?.(message);
          return;
        case "scene:unlock":
          this.handlers.onSceneUnlock?.(message);
          return;
        case "presence":
          this.handlers.onPresence?.(message);
          return;
        case "scene:updated":
          this.handlers.onSceneUpdated?.(message);
          return;
        case "resource:updated":
          this.handlers.onResourceUpdated?.(message);
          return;
        case "error":
          this.handlers.onServerError?.(message);
          return;
      }
    };

    socket.onerror = (event) => {
      if (!this.isCurrentSocket(socket, generation)) {
        return;
      }
      this.handlers.onTransportError?.(event);
    };

    socket.onclose = (event) => {
      if (!this.isCurrentSocket(socket, generation)) {
        return;
      }

      this.socket = null;
      this.handlers.onDisconnected?.(event);
      if (!this.closedByClient) {
        this.scheduleReconnect();
      }
    };
  }

  private isCurrentSocket(
    socket: MotionWorkspaceWebSocketLike,
    generation: number,
  ): boolean {
    return this.socket === socket && generation === this.generation;
  }

  private scheduleReconnect(): void {
    if (this.closedByClient || this.reconnectTimer) {
      return;
    }

    const attempt = this.reconnectAttempt + 1;
    const delayMs = computeReconnectDelay(this.reconnectOptions, attempt);
    this.reconnectAttempt = attempt;
    this.handlers.onReconnect?.({
      attempt,
      delayMs,
      workspaceId: this.workspaceId,
      userId: this.userId,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delayMs);
  }

  private flushDesiredState(): void {
    for (const sceneId of this.desiredSceneLocks) {
      this.sendJson({
        type: "scene:lock",
        sceneId,
        userId: this.userId,
      } satisfies MotionWorkspaceWsSceneControlMessage);
    }

    if (this.desiredPresence) {
      this.sendJson({
        type: "presence",
        userId: this.userId,
        ...this.desiredPresence,
      } satisfies MotionWorkspaceWsPresenceClientMessage);
    }
  }

  private sendJson(payload: MotionWorkspaceWsSceneControlMessage | MotionWorkspaceWsPresenceClientMessage): void {
    if (!this.socket || this.socket.readyState !== WS_OPEN_READY_STATE) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }
}
