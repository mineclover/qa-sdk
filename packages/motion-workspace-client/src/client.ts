import type { MotionEditorCommand } from "motion-content";
import type { MotionWorkspaceSnapshotV1 } from "motion-workspace";
import type {
  MotionWorkspaceApplyRequest,
  MotionWorkspaceClientFetch,
  MotionWorkspaceClientOptions,
  MotionWorkspaceClientRequestInit,
  MotionWorkspaceConflictErrorShape,
  MotionWorkspaceGetResponse,
  MotionWorkspaceListResponse,
} from "./types.js";

export class MotionWorkspaceClientError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "MotionWorkspaceClientError";
    this.status = status;
    this.payload = payload;
  }

  toJSON(): {
    readonly name: string;
    readonly message: string;
    readonly status: number;
    readonly payload?: unknown;
  } {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      payload: this.payload,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMotionWorkspaceConflictErrorShape(
  payload: unknown,
): payload is MotionWorkspaceConflictErrorShape {
  return isRecord(payload)
    && payload["code"] === "revision_conflict"
    && typeof payload["message"] === "string"
    && (
      payload["expectedRevision"] === undefined
      || typeof payload["expectedRevision"] === "number"
    )
    && (
      payload["actualRevision"] === undefined
      || typeof payload["actualRevision"] === "number"
    );
}

export function isMotionWorkspaceConflictError(
  error: unknown,
): error is MotionWorkspaceClientError & {
  readonly payload: MotionWorkspaceConflictErrorShape;
} {
  return error instanceof MotionWorkspaceClientError
    && isMotionWorkspaceConflictErrorShape(error.payload);
}

function resolveFetch(
  customFetch?: MotionWorkspaceClientFetch,
): MotionWorkspaceClientFetch {
  if (customFetch) {
    return customFetch;
  }
  if (typeof globalThis.fetch !== "function") {
    throw new Error("global fetch가 없어 MotionWorkspaceClient를 초기화할 수 없습니다.");
  }
  return globalThis.fetch.bind(globalThis) as unknown as MotionWorkspaceClientFetch;
}

async function parseResponse(response: Awaited<ReturnType<MotionWorkspaceClientFetch>>) {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class MotionWorkspaceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: MotionWorkspaceClientFetch;

  constructor(options: MotionWorkspaceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = resolveFetch(options.fetch);
  }

  async list(): Promise<MotionWorkspaceListResponse> {
    return this.request<MotionWorkspaceListResponse>("/workspaces");
  }

  async get(id: string): Promise<MotionWorkspaceGetResponse> {
    return this.request<MotionWorkspaceGetResponse>(`/workspaces/${encodeURIComponent(id)}`);
  }

  async create(id: string, workspace: MotionWorkspaceSnapshotV1): Promise<MotionWorkspaceGetResponse> {
    return this.request<MotionWorkspaceGetResponse>(`/workspaces/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ workspace }),
    });
  }

  async update(id: string, workspace: MotionWorkspaceSnapshotV1): Promise<MotionWorkspaceGetResponse> {
    return this.request<MotionWorkspaceGetResponse>(`/workspaces/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ workspace }),
    });
  }

  async delete(id: string): Promise<void> {
    await this.request<void>(`/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" });
    return undefined;
  }

  async applyCommand(
    id: string,
    command: MotionEditorCommand,
    revision: number,
  ): Promise<MotionWorkspaceGetResponse> {
    const payload: MotionWorkspaceApplyRequest = { revision, command };
    return this.request<MotionWorkspaceGetResponse>(`/workspaces/${encodeURIComponent(id)}/apply-command`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  private async request<T = void>(
    path: string,
    init: MotionWorkspaceClientRequestInit = {},
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body,
    });
    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new MotionWorkspaceClientError(
        typeof payload === "object" && payload && "message" in payload
          ? String((payload as MotionWorkspaceConflictErrorShape).message)
          : `HTTP ${response.status}`,
        response.status,
        payload,
      );
    }
    return (payload ?? {}) as T;
  }
}
