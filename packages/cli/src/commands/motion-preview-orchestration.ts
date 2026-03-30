import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const DEFAULT_MOTION_PREVIEW_ORIGIN = "http://localhost:4179";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export interface MotionPreviewLaunchOptions {
  readonly previewOrigin: string;
  readonly workspaceBaseUrl: string;
  readonly workspaceId?: string;
}

export interface MotionPreviewLaunchResult {
  readonly url: string;
  readonly previewOrigin: string;
  readonly workspaceBaseUrl: string;
  readonly reusedWorkspaceService: boolean;
  readonly reusedPreviewServer: boolean;
}

interface MotionPreviewCommandOptions {
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface MotionPreviewOrchestrationDeps {
  readonly cwd?: string;
  readonly repoRoot?: string;
  readonly fetchImpl?: typeof fetch;
  readonly runCommand?: (
    command: string,
    args: readonly string[],
    options: MotionPreviewCommandOptions,
  ) => Promise<void>;
  readonly startDetached?: (
    command: string,
    args: readonly string[],
    options: MotionPreviewCommandOptions,
  ) => Promise<void>;
  readonly openUrl?: (url: string) => Promise<void>;
  readonly waitForUrl?: (
    url: string,
    fetchImpl: typeof fetch,
  ) => Promise<boolean>;
}

function pathExists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

async function defaultRunCommand(
  command: string,
  args: readonly string[],
  options: MotionPreviewCommandOptions,
): Promise<void> {
  await execa(command, [...args], {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
  });
}

async function defaultStartDetached(
  command: string,
  args: readonly string[],
  options: MotionPreviewCommandOptions,
): Promise<void> {
  const subprocess = execa(command, [...args], {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: "ignore",
  });

  subprocess.unref();
  void subprocess.catch(() => {});
}

async function defaultOpenUrl(url: string): Promise<void> {
  if (process.platform === "darwin") {
    await execa("open", [url]);
    return;
  }

  if (process.platform === "win32") {
    await execa("cmd", ["/c", "start", "", url]);
    return;
  }

  await execa("xdg-open", [url]);
}

async function defaultWaitForUrl(
  url: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // background process bootstrap is polled until timeout
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  return false;
}

async function resolveRepoRoot(
  deps: MotionPreviewOrchestrationDeps,
): Promise<string | null> {
  if (deps.repoRoot) {
    return deps.repoRoot;
  }

  const candidates = [
    resolve(deps.cwd ?? process.cwd()),
    MODULE_DIR,
  ];

  for (const candidate of candidates) {
    let current = candidate;
    while (true) {
      const hasWorkspace = await pathExists(resolve(current, "pnpm-workspace.yaml"));
      const hasDemoPackage = await pathExists(resolve(current, "packages/motion-content-editor-demo/package.json"));
      const hasServicePackage = await pathExists(resolve(current, "packages/motion-workspace-service/package.json"));
      if (hasWorkspace && hasDemoPackage && hasServicePackage) {
        return current;
      }

      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return null;
}

function ensureUrl(value: string, label: string): string {
  try {
    return new URL(value).toString().replace(/\/+$/, "");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} URL이 올바르지 않습니다: ${value} (${reason})`, { cause: error });
  }
}

function appendUrlPath(baseUrl: string, path: string): string {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBaseUrl}${normalizedPath}`;
}

function isLocalOrigin(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function readPort(url: string, fallback: number): string {
  const parsed = new URL(url);
  if (parsed.port.length > 0) {
    return parsed.port;
  }

  if (parsed.protocol === "https:") {
    return "443";
  }

  if (parsed.protocol === "http:") {
    return "80";
  }

  return String(fallback);
}

function readHost(url: string, fallback: string): string {
  const hostname = new URL(url).hostname;
  return hostname.length > 0 ? hostname : fallback;
}

export function resolveMotionPreviewOrigin(explicitPreviewOrigin?: string): string {
  return ensureUrl(
    explicitPreviewOrigin?.trim()
      || process.env["QA_MOTION_PREVIEW_ORIGIN"]?.trim()
      || process.env["MOTION_CONTENT_EDITOR_DEMO_ORIGIN"]?.trim()
      || DEFAULT_MOTION_PREVIEW_ORIGIN,
    "motion preview",
  );
}

export function buildMotionPreviewUrl(
  previewOrigin: string,
  workspaceId?: string,
): string {
  const url = new URL(`${previewOrigin.replace(/\/+$/, "")}/`);
  const trimmedWorkspaceId = workspaceId?.trim();
  if (trimmedWorkspaceId) {
    url.searchParams.set("workspace", trimmedWorkspaceId);
  }
  return url.toString();
}

export async function launchMotionPreview(
  options: MotionPreviewLaunchOptions,
  deps: MotionPreviewOrchestrationDeps = {},
): Promise<MotionPreviewLaunchResult> {
  const previewOrigin = ensureUrl(options.previewOrigin, "preview");
  const workspaceBaseUrl = ensureUrl(options.workspaceBaseUrl, "workspace service");
  const fetchImpl = deps.fetchImpl ?? fetch;
  const runCommand = deps.runCommand ?? defaultRunCommand;
  const startDetached = deps.startDetached ?? defaultStartDetached;
  const openUrl = deps.openUrl ?? defaultOpenUrl;
  const waitForUrl = deps.waitForUrl ?? defaultWaitForUrl;
  const healthUrl = appendUrlPath(workspaceBaseUrl, "/health");
  const repoRoot = await resolveRepoRoot(deps);

  const workspaceServiceReady = await waitForUrl(healthUrl, fetchImpl);
  let reusedWorkspaceService = workspaceServiceReady;

  if (!workspaceServiceReady) {
    if (!isLocalOrigin(workspaceBaseUrl)) {
      throw new Error(`workspace service에 연결할 수 없습니다: ${healthUrl}`);
    }
    if (!repoRoot) {
      throw new Error("workspace service를 자동 기동하려면 qa-sdk 모노레포 루트에서 실행해야 합니다.");
    }

    await runCommand(
      "pnpm",
      ["--filter", "@qa-sdk/motion-workspace-service", "build"],
      { cwd: repoRoot },
    );
    await startDetached(
      "pnpm",
      ["--filter", "@qa-sdk/motion-workspace-service", "start"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PORT: readPort(workspaceBaseUrl, 3710),
        },
      },
    );

    if (!(await waitForUrl(healthUrl, fetchImpl))) {
      throw new Error(`workspace service 기동 확인 실패: ${healthUrl}`);
    }
    reusedWorkspaceService = false;
  }

  const previewReady = await waitForUrl(previewOrigin, fetchImpl);
  let reusedPreviewServer = previewReady;

  if (!previewReady) {
    if (!isLocalOrigin(previewOrigin)) {
      throw new Error(`preview app에 연결할 수 없습니다: ${previewOrigin}`);
    }
    if (!repoRoot) {
      throw new Error("preview app을 자동 기동하려면 qa-sdk 모노레포 루트에서 실행해야 합니다.");
    }

    await runCommand(
      "pnpm",
      ["--filter", "@qa-sdk/motion-content-editor-demo", "build"],
      { cwd: repoRoot },
    );
    await startDetached(
      "pnpm",
      [
        "--filter",
        "@qa-sdk/motion-content-editor-demo",
        "preview",
        "--",
        "--host",
        readHost(previewOrigin, "127.0.0.1"),
        "--port",
        readPort(previewOrigin, 4179),
        "--strictPort",
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          MOTION_WORKSPACE_SERVICE_ORIGIN: workspaceBaseUrl,
        },
      },
    );

    if (!(await waitForUrl(previewOrigin, fetchImpl))) {
      throw new Error(`preview app 기동 확인 실패: ${previewOrigin}`);
    }
    reusedPreviewServer = false;
  }

  const url = buildMotionPreviewUrl(previewOrigin, options.workspaceId);
  await openUrl(url);

  return {
    url,
    previewOrigin,
    workspaceBaseUrl,
    reusedWorkspaceService,
    reusedPreviewServer,
  };
}
