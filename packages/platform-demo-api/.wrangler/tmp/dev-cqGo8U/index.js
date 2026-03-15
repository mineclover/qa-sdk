var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../node_modules/.pnpm/@cloudflare+unenv-preset@2.15.0_unenv@2.0.0-rc.24_workerd@1.20260312.1/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../node_modules/.pnpm/@cloudflare+unenv-preset@2.15.0_unenv@2.0.0-rc.24_workerd@1.20260312.1/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../node_modules/.pnpm/wrangler@4.73.0_@cloudflare+workers-types@4.20260313.1/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../node_modules/.pnpm/unenv@2.0.0-rc.24/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../node_modules/.pnpm/@cloudflare+unenv-preset@2.15.0_unenv@2.0.0-rc.24_workerd@1.20260312.1/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../node_modules/.pnpm/wrangler@4.73.0_@cloudflare+workers-types@4.20260313.1/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context2, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context2.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context2, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context2.error = err;
            res = await onError(err, context2);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context2.finalized === false && onNotFound) {
          res = await onNotFound(context2);
        }
      }
      if (res && (context2.finalized === false || isError)) {
        context2.res = res;
      }
      return context2;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context2, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context: context2 }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context2, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env2, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env2, "GET")))();
    }
    const path = this.getPath(request, { env: env2 });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env: env2,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context2 = await composed(c);
        if (!context2.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context2.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context2, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context2.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context2, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// ../../node_modules/.pnpm/hono@4.12.7/node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// ../weighted-index/dist/index.js
var WeightedIndexError = class extends Error {
  static {
    __name(this, "WeightedIndexError");
  }
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    const E = Error;
    if (typeof E.captureStackTrace === "function") {
      E.captureStackTrace(this, this.constructor);
    }
  }
};
var ShapeError = class extends WeightedIndexError {
  static {
    __name(this, "ShapeError");
  }
};
var CoordError = class extends WeightedIndexError {
  static {
    __name(this, "CoordError");
  }
};
var IndexRangeError = class extends WeightedIndexError {
  static {
    __name(this, "IndexRangeError");
  }
};
var BufferError = class extends WeightedIndexError {
  static {
    __name(this, "BufferError");
  }
};
var LabelNotFoundError = class extends WeightedIndexError {
  static {
    __name(this, "LabelNotFoundError");
  }
};
var VersionNotFoundError = class extends WeightedIndexError {
  static {
    __name(this, "VersionNotFoundError");
  }
};
var EntityNotFoundError = class extends WeightedIndexError {
  static {
    __name(this, "EntityNotFoundError");
  }
};
var PrefixNotFoundError = class extends WeightedIndexError {
  static {
    __name(this, "PrefixNotFoundError");
  }
};
var SerializeError = class extends WeightedIndexError {
  static {
    __name(this, "SerializeError");
  }
};
var MigrateError = class extends WeightedIndexError {
  static {
    __name(this, "MigrateError");
  }
};
function formatList(items) {
  return [...items].join(", ");
}
__name(formatList, "formatList");
function assertNoColon(value, context2) {
  if (!value) {
    throw new SerializeError(`${context2} must be non-empty`);
  }
  if (value.includes(":")) {
    throw new SerializeError(
      `${context2} cannot contain ":" (used as serialize separator): "${value}"`
    );
  }
}
__name(assertNoColon, "assertNoColon");
function assertPositiveInt(value, context2) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ShapeError(`${context2} must be a positive integer, got ${value}`);
  }
}
__name(assertPositiveInt, "assertPositiveInt");
function assertNonEmptyArray(arr, context2) {
  if (arr.length === 0) {
    throw new ShapeError(`${context2} must have at least one element`);
  }
}
__name(assertNonEmptyArray, "assertNonEmptyArray");
var WeightedIndex = class {
  static {
    __name(this, "WeightedIndex");
  }
  constructor(shape, labels) {
    assertNonEmptyArray(shape, "shape");
    for (let i = 0; i < shape.length; i++) {
      assertPositiveInt(shape[i], `shape[${i}]`);
    }
    if (labels !== void 0 && labels.length !== shape.length) {
      throw new ShapeError(
        `labels length (${labels.length}) must match shape length (${shape.length})`
      );
    }
    this.shape = Object.freeze([...shape]);
    this.labels = Object.freeze(labels ?? shape.map((_, i) => `dim_${i}`));
    const d = shape.length;
    const weights = new Float64Array(d);
    weights[d - 1] = 1;
    for (let i = d - 2; i >= 0; i--) {
      weights[i] = weights[i + 1] * shape[i + 1];
      if (weights[i] > Number.MAX_SAFE_INTEGER) {
        throw new ShapeError(
          `Shape product at dimension ${i} (${weights[i]}) exceeds Number.MAX_SAFE_INTEGER. Reduce shape values or the number of dimensions.`
        );
      }
    }
    this.weights = weights;
    this.shapeBuf = new Float64Array(shape);
    const size = weights[0] * shape[0];
    if (size > Number.MAX_SAFE_INTEGER) {
      throw new ShapeError(
        `Total combinations (${size}) exceeds Number.MAX_SAFE_INTEGER. Reduce shape values.`
      );
    }
    this.size = size;
  }
  // ── 안전한 공개 API ──────────────────────────────────────────────────────
  /** 정변환: 다차원 좌표(1-based) → 정수 인덱스. 경계 검사 포함. */
  encode(coords) {
    this._validateCoords(coords);
    return this._encodeCore(coords);
  }
  /** 역변환: 정수 인덱스 → 다차원 좌표(1-based). 경계 검사 포함. */
  decode(index) {
    this._validateIndex(index);
    const out = new Array(this.shape.length);
    this._decodeCore(index, out);
    return out;
  }
  /** 정수 인덱스 → { label: value } 객체. */
  decodeToRecord(index) {
    const coords = this.decode(index);
    const rec = {};
    for (let i = 0; i < this.labels.length; i++) {
      rec[this.labels[i]] = coords[i];
    }
    return rec;
  }
  /** { label: value } 객체 → 정수 인덱스. */
  encodeFromRecord(record) {
    const coords = new Array(this.labels.length);
    for (let i = 0; i < this.labels.length; i++) {
      const v = record[this.labels[i]];
      if (v === void 0) {
        throw new CoordError(`Missing key "${this.labels[i]}" in record`);
      }
      coords[i] = v;
    }
    return this.encode(coords);
  }
  // ── Hot-path API (경계 검사 생략) ────────────────────────────────────────
  //
  // ⚠️ 계약 위반 시 잘못된 값을 반환하며 오류가 없다.
  //    범위를 보장할 수 없는 경로에서는 안전한 encode / decode 를 사용할 것.
  //    내부적으로 검증된 좌표만 다루는 hot-path (예: MetaRegistry 내부)에서만 사용.
  /** 정변환 (검사 없음). coords[i] ∈ [1, shape[i]] 를 호출자가 보장해야 한다. */
  encodeUnsafe(coords) {
    return this._encodeCore(coords);
  }
  /** 역변환 (검사 없음). index ∈ [0, size-1] 를 호출자가 보장해야 한다. */
  decodeUnsafe(index) {
    const out = new Array(this.shape.length);
    this._decodeCore(index, out);
    return out;
  }
  /**
   * 역변환 결과를 미리 할당된 배열 `out` 에 기록.
   * 배열 할당 제로. 경계 검사 포함. out.length >= shape.length 요구.
   */
  decodeTo(index, out) {
    if (out.length < this.shape.length) {
      throw new BufferError(
        `out buffer length (${out.length}) must be >= shape length (${this.shape.length})`
      );
    }
    this._validateIndex(index);
    this._decodeCore(index, out);
  }
  /** 역변환 결과를 미리 할당된 배열 `out` 에 기록 (검사 없음). */
  decodeToUnsafe(index, out) {
    this._decodeCore(index, out);
  }
  // ── 내부 ────────────────────────────────────────────────────────────────
  _encodeCore(coords) {
    const w = this.weights;
    let index = 0;
    for (let i = 0; i < w.length; i++) {
      index += (coords[i] - 1) * w[i];
    }
    return index;
  }
  _decodeCore(index, out) {
    const s = this.shapeBuf;
    let rest = index;
    for (let i = s.length - 1; i >= 0; i--) {
      const ni = s[i];
      out[i] = rest % ni + 1;
      rest = Math.floor(rest / ni);
    }
  }
  _validateCoords(coords) {
    if (coords.length !== this.shape.length) {
      throw new CoordError(
        `coords length (${coords.length}) must match shape length (${this.shape.length})`
      );
    }
    for (let i = 0; i < this.shape.length; i++) {
      const x = coords[i];
      if (!Number.isInteger(x) || x < 1 || x > this.shape[i]) {
        throw new CoordError(
          `coords[${i}] (label: "${this.labels[i]}") must be in [1, ${this.shape[i]}], got ${x}`
        );
      }
    }
  }
  _validateIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new IndexRangeError(
        `index must be in [0, ${this.size - 1}], got ${index}`
      );
    }
  }
};
function calcWeights(shape) {
  return shape.map(
    (_, i) => shape.slice(i + 1).reduce((product, n) => product * n, 1)
  );
}
__name(calcWeights, "calcWeights");
function mergeRanges(ranges) {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const result = [[...sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    if (sorted[i][0] <= last[1] + 1) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      result.push([...sorted[i]]);
    }
  }
  return result;
}
__name(mergeRanges, "mergeRanges");
function calcAddressRanges(shape, constraints) {
  const weights = calcWeights(shape);
  return _calcRanges(shape, constraints, weights, 0, 0);
}
__name(calcAddressRanges, "calcAddressRanges");
function _normalizeConstraint(c, dimSize) {
  if (c === null) return [{ from: 1, to: dimSize }];
  return c.split(",").map((part) => {
    const dash = part.indexOf("-");
    let from;
    let to;
    if (dash === -1) {
      from = Number(part);
      to = from;
    } else {
      from = Number(part.slice(0, dash));
      to = Number(part.slice(dash + 1));
    }
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      throw new RangeError(
        `Invalid constraint "${part}": from and to must be valid integers (got from=${from}, to=${to})`
      );
    }
    if (from > to) {
      throw new RangeError(
        `Invalid constraint "${part}": from (${from}) must be <= to (${to})`
      );
    }
    if (from < 1 || to > dimSize) {
      throw new RangeError(
        `Constraint "${part}" out of bounds: [${from}, ${to}] must be within [1, ${dimSize}]`
      );
    }
    return { from, to };
  });
}
__name(_normalizeConstraint, "_normalizeConstraint");
function _calcRanges(shape, constraints, weights, dimIndex, baseAddr) {
  if (dimIndex === shape.length) {
    return [[baseAddr, baseAddr]];
  }
  const weight = weights[dimIndex];
  const segments = _normalizeConstraint(constraints[dimIndex], shape[dimIndex]);
  const allRemainingWild = constraints.slice(dimIndex + 1).every((c) => c === null);
  if (allRemainingWild) {
    const raw2 = segments.map(({ from, to }) => [
      baseAddr + (from - 1) * weight,
      baseAddr + to * weight - 1
    ]);
    return mergeRanges(raw2);
  }
  const ranges = [];
  for (const { from, to } of segments) {
    for (let coord = from; coord <= to; coord++) {
      const sub = _calcRanges(
        shape,
        constraints,
        weights,
        dimIndex + 1,
        baseAddr + (coord - 1) * weight
      );
      ranges.push(...sub);
    }
  }
  return mergeRanges(ranges);
}
__name(_calcRanges, "_calcRanges");
var LabelRegistry = class {
  static {
    __name(this, "LabelRegistry");
  }
  constructor(defs) {
    const rawDefs = defs;
    const dataMap = /* @__PURE__ */ new Map();
    const orderMap = /* @__PURE__ */ new Map();
    for (const [name, versions2] of Object.entries(rawDefs)) {
      assertNonEmptyArray(versions2, `Label "${name}" versions`);
      const versionMap = /* @__PURE__ */ new Map();
      const order = [];
      for (const entry of versions2) {
        assertNoColon(entry.version, `Label "${name}" version`);
        if (versionMap.has(entry.version)) {
          throw new ShapeError(
            `Duplicate version "${entry.version}" in label "${name}"`
          );
        }
        assertNonEmptyArray(entry.ids, `Label "${name}" version "${entry.version}" ids`);
        const safeCopy = {
          ...entry,
          ids: [...entry.ids]
        };
        versionMap.set(entry.version, this._buildCache(name, safeCopy));
        order.push(entry.version);
      }
      dataMap.set(name, versionMap);
      orderMap.set(name, order);
    }
    this.data = dataMap;
    this.versionOrder = orderMap;
  }
  // ── max 조회 ─────────────────────────────────────────────────────────────
  getMax(label, version2) {
    return this._getCache(label, version2).max;
  }
  getLatestMax(label) {
    return this._getLatestCache(label).max;
  }
  // ── ID ↔ index 변환 ──────────────────────────────────────────────────────
  /**
   * entity ID → 1-based 순번 인덱스.
   * TSchema로부터 각 레이블의 entity ID 타입이 컴파일 타임에 검증된다.
   */
  getIndex(label, version2, entityId) {
    const cache = this._getCache(label, version2);
    const idx = cache.idToIndex.get(entityId);
    if (idx === void 0) {
      throw new EntityNotFoundError(
        `Entity id "${entityId}" not found in label "${label}" version "${version2}"`
      );
    }
    return idx;
  }
  /**
   * 1-based 순번 인덱스 → entity ID.
   * 반환 타입이 TSchema[K] 로 좁혀진다.
   */
  getEntityId(label, version2, index) {
    const cache = this._getCache(label, version2);
    const id = cache.indexToId.get(index);
    if (id === void 0) {
      throw new EntityNotFoundError(
        `Index ${index} not found in label "${label}" version "${version2}" (max: ${cache.max})`
      );
    }
    return id;
  }
  // ── 버전 조회 ─────────────────────────────────────────────────────────────
  getLatestVersion(label) {
    const order = this._getOrder(label);
    return order[order.length - 1];
  }
  getVersions(label) {
    const order = this._getOrder(label);
    const versionMap = this._getVersionMap(label);
    return order.map(
      (v) => versionMap.get(v).entry
    );
  }
  // ── 존재 확인 ─────────────────────────────────────────────────────────────
  hasLabel(label) {
    return this.data.has(label);
  }
  hasVersion(label, version2) {
    const versionMap = this.data.get(label);
    return versionMap !== void 0 && versionMap.has(version2);
  }
  get labelNames() {
    return [...this.data.keys()];
  }
  // ── 패키지 내부용 untyped 접근 ────────────────────────────────────────────
  /** @internal prefix-registry에서 label 이름을 동적으로 넘길 때 사용 */
  _getMaxRaw(label, version2) {
    return this._getCache(label, version2).max;
  }
  /** @internal */
  _getIndexRaw(label, version2, entityId) {
    const cache = this._getCache(label, version2);
    const idx = cache.idToIndex.get(entityId);
    if (idx === void 0) {
      throw new EntityNotFoundError(
        `Entity id "${entityId}" not found in label "${label}" version "${version2}"`
      );
    }
    return idx;
  }
  /** @internal */
  _getEntityIdRaw(label, version2, index) {
    const cache = this._getCache(label, version2);
    const id = cache.indexToId.get(index);
    if (id === void 0) {
      throw new EntityNotFoundError(
        `Index ${index} not found in label "${label}" version "${version2}" (max: ${cache.max})`
      );
    }
    return id;
  }
  // ── 내부 ────────────────────────────────────────────────────────────────
  _buildCache(labelName, entry) {
    const idToIndex = /* @__PURE__ */ new Map();
    const indexToId = /* @__PURE__ */ new Map();
    const seenIds = /* @__PURE__ */ new Set();
    for (let pos = 0; pos < entry.ids.length; pos++) {
      const raw2 = entry.ids[pos];
      const id = typeof raw2 === "number" && Object.is(raw2, -0) ? 0 : raw2;
      if (seenIds.has(id)) {
        throw new ShapeError(
          `Duplicate entity id "${id}" in label "${labelName}" version "${entry.version}"`
        );
      }
      seenIds.add(id);
      const index = pos + 1;
      idToIndex.set(id, index);
      indexToId.set(index, id);
    }
    return { entry, idToIndex, indexToId, max: entry.ids.length };
  }
  _getVersionMap(label) {
    const versionMap = this.data.get(label);
    if (!versionMap) {
      throw new LabelNotFoundError(
        `Unknown label: "${label}". Registered: [${formatList(this.data.keys())}]`
      );
    }
    return versionMap;
  }
  _getOrder(label) {
    const order = this.versionOrder.get(label);
    if (!order) {
      throw new LabelNotFoundError(`Unknown label: "${label}"`);
    }
    return order;
  }
  _getCache(label, version2) {
    const versionMap = this._getVersionMap(label);
    const cache = versionMap.get(version2);
    if (!cache) {
      throw new VersionNotFoundError(
        `Unknown version "${version2}" for label "${label}". Available: [${formatList(versionMap.keys())}]`
      );
    }
    return cache;
  }
  _getLatestCache(label) {
    const order = this._getOrder(label);
    const versionMap = this._getVersionMap(label);
    return versionMap.get(order[order.length - 1]);
  }
};
function createLabelRegistry(defs) {
  return new LabelRegistry(
    defs
  );
}
__name(createLabelRegistry, "createLabelRegistry");
var PrefixCodec = class {
  static {
    __name(this, "PrefixCodec");
  }
  constructor(labels, prefixes) {
    this.indexCache = /* @__PURE__ */ new Map();
    this.labelReg = labels;
    const map = /* @__PURE__ */ new Map();
    for (const [name, def] of Object.entries(prefixes)) {
      this._validatePrefixDef(name, def);
      map.set(name, def);
    }
    this.prefixes = map;
  }
  // ── 메타 ────────────────────────────────────────────────────────────────
  get prefixNames() {
    return [...this.prefixes.keys()];
  }
  getLabels(prefix) {
    return this._getPrefixDef(prefix).labels;
  }
  getCurrentVersion(prefix) {
    const def = this._getPrefixDef(prefix);
    return def.versions[def.versions.length - 1].version;
  }
  getPrefixVersions(prefix) {
    return this._getPrefixDef(prefix).versions;
  }
  /** LabelRegistry 기반으로 shape을 동적 도출. */
  getShape(prefix, version2) {
    return [
      ...this._getWeightedIndex(prefix, version2 ?? this.getCurrentVersion(prefix)).shape
    ];
  }
  /** 캐시된 WeightedIndex 인스턴스 반환. */
  getIndex(prefix, version2) {
    return this._getWeightedIndex(
      prefix,
      version2 ?? this.getCurrentVersion(prefix)
    );
  }
  // ── 인코딩 ──────────────────────────────────────────────────────────────
  /** 좌표 배열(raw 1-based index) → VersionedIndex. */
  encode(prefix, coords, version2) {
    const v = version2 ?? this.getCurrentVersion(prefix);
    const id = this._getWeightedIndex(prefix, v).encode(coords);
    return { prefix, v, id };
  }
  /** { label: raw_index } 레코드 → VersionedIndex. */
  encodeFromRecord(prefix, record, version2) {
    const v = version2 ?? this.getCurrentVersion(prefix);
    const id = this._getWeightedIndex(prefix, v).encodeFromRecord(record);
    return { prefix, v, id };
  }
  /**
   * 원천 데이터 ID 레코드 → VersionedIndex.
   * LabelRegistry를 통해 각 entity ID를 1-based 인덱스로 변환 후 encode.
   *
   * @example
   * registry.encodeFromIds("api_perm", {
   *   role: 2, action: "write", api: "/posts", tenant: 100,
   * })
   */
  encodeFromIds(prefix, ids, version2) {
    const v = version2 ?? this.getCurrentVersion(prefix);
    const def = this._getPrefixDef(prefix);
    const pv = this._getPrefixVersion(prefix, v);
    const coords = def.labels.map((label) => {
      const entityId = ids[label];
      if (entityId === void 0) {
        throw new CoordError(
          `Missing entity id for label "${label}" in encodeFromIds`
        );
      }
      return this.labelReg._getIndexRaw(label, pv.labelVersions[label], entityId);
    });
    const id = this._getWeightedIndex(prefix, v).encodeUnsafe(coords);
    return { prefix, v, id };
  }
  // ── 디코딩 ──────────────────────────────────────────────────────────────
  /** VersionedIndex → 좌표 배열(raw 1-based index). */
  decode(vi) {
    return this._getWeightedIndex(vi.prefix, vi.v).decode(vi.id);
  }
  /** VersionedIndex → { label: raw_index }. */
  decodeToRecord(vi) {
    return this._getWeightedIndex(vi.prefix, vi.v).decodeToRecord(vi.id);
  }
  /**
   * VersionedIndex → { label: entityId }.
   * 각 인덱스를 LabelRegistry를 통해 원천 데이터 ID로 역변환.
   *
   * @example
   * registry.decodeToIds({ prefix: "api_perm", v: "pv2", id: 42 })
   * // → { role: 2, action: "write", api: "/posts", tenant: 100 }
   */
  decodeToIds(vi) {
    const def = this._getPrefixDef(vi.prefix);
    const pv = this._getPrefixVersion(vi.prefix, vi.v);
    const coords = this._getWeightedIndex(vi.prefix, vi.v).decode(vi.id);
    const result = {};
    for (let i = 0; i < def.labels.length; i++) {
      const label = def.labels[i];
      result[label] = this.labelReg._getEntityIdRaw(
        label,
        pv.labelVersions[label],
        coords[i]
      );
    }
    return result;
  }
  // ── 직렬화 ──────────────────────────────────────────────────────────────
  /**
   * VersionedIndex → 단일 문자열 (DB 단일 컬럼 저장용).
   * 형식: "{prefix}:{v}:{id}"
   */
  serialize(vi) {
    return `${vi.prefix}:${vi.v}:${vi.id}`;
  }
  /**
   * 직렬화 문자열 → VersionedIndex.
   * prefix와 version이 registry에 등록되어 있어야 함.
   */
  parse(serialized) {
    const lastColon = serialized.lastIndexOf(":");
    if (lastColon === -1) {
      throw new SerializeError(
        `Invalid serialized VersionedIndex: "${serialized}". Expected "{prefix}:{version}:{id}"`
      );
    }
    const idStr = serialized.slice(lastColon + 1);
    const rest = serialized.slice(0, lastColon);
    const secondColon = rest.lastIndexOf(":");
    if (secondColon === -1) {
      throw new SerializeError(
        `Invalid serialized VersionedIndex: "${serialized}". Expected "{prefix}:{version}:{id}"`
      );
    }
    const prefix = rest.slice(0, secondColon);
    const v = rest.slice(secondColon + 1);
    if (!prefix || !v || !idStr) {
      throw new SerializeError(
        `Invalid serialized VersionedIndex: "${serialized}". Expected "{prefix}:{version}:{id}"`
      );
    }
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 0) {
      throw new SerializeError(
        `Invalid id "${idStr}" in serialized VersionedIndex: "${serialized}"`
      );
    }
    this._getPrefixVersion(prefix, v);
    return { prefix, v, id };
  }
  // ── 마이그레이션 ────────────────────────────────────────────────────────
  /**
   * 구버전 VersionedIndex를 다른 버전으로 변환.
   * migrator: 구버전 좌표 → 신버전 좌표 변환 함수 (호출자가 직접 제공).
   */
  migrate(vi, toVersion, migrator) {
    const fromWi = this._getWeightedIndex(vi.prefix, vi.v);
    const toWi = this._getWeightedIndex(vi.prefix, toVersion);
    const oldCoords = fromWi.decode(vi.id);
    const newCoords = migrator(oldCoords, fromWi.labels, toWi.labels);
    if (newCoords.length !== toWi.shape.length) {
      throw new MigrateError(
        `migrator returned ${newCoords.length} coordinates but target prefix "${vi.prefix}@${toVersion}" expects ${toWi.shape.length}`
      );
    }
    for (let i = 0; i < newCoords.length; i++) {
      const x = newCoords[i];
      const n = toWi.shape[i];
      if (!Number.isInteger(x) || x < 1 || x > n) {
        throw new MigrateError(
          `migrator returned invalid coordinate at index ${i} (label: "${toWi.labels[i]}"): got ${x}, expected integer in [1, ${n}]`
        );
      }
    }
    return { prefix: vi.prefix, v: toVersion, id: toWi.encodeUnsafe(newCoords) };
  }
  /** 주어진 VersionedIndex가 해당 prefix의 currentVersion인지 확인. */
  isCurrent(vi) {
    return vi.v === this.getCurrentVersion(vi.prefix);
  }
  // ── Diff ────────────────────────────────────────────────────────────────
  /**
   * 두 prefix 버전 사이에서 변경된 레이블과 max 변화량을 반환.
   *
   * @example
   * registry.diff("api_perm", "pv1", "pv2")
   * // → { changedLabels: [{ label: "role", fromMax: 3, toMax: 4, ... }] }
   */
  diff(prefix, fromVersion, toVersion) {
    const fromPv = this._getPrefixVersion(prefix, fromVersion);
    const toPv = this._getPrefixVersion(prefix, toVersion);
    const labels = this._getPrefixDef(prefix).labels;
    const changedLabels = labels.filter((label) => fromPv.labelVersions[label] !== toPv.labelVersions[label]).map((label) => ({
      label,
      fromLabelVersion: fromPv.labelVersions[label],
      fromMax: this.labelReg._getMaxRaw(label, fromPv.labelVersions[label]),
      toLabelVersion: toPv.labelVersions[label],
      toMax: this.labelReg._getMaxRaw(label, toPv.labelVersions[label])
    }));
    return { prefix, from: fromVersion, to: toVersion, changedLabels };
  }
  // ── 내부 ────────────────────────────────────────────────────────────────
  _getWeightedIndex(prefix, version2) {
    const cacheKey = `${prefix}:${version2}`;
    let wi = this.indexCache.get(cacheKey);
    if (!wi) {
      const def = this._getPrefixDef(prefix);
      const pv = this._getPrefixVersion(prefix, version2);
      const shape = def.labels.map(
        (label) => this.labelReg._getMaxRaw(label, pv.labelVersions[label])
      );
      wi = new WeightedIndex(shape, def.labels);
      this.indexCache.set(cacheKey, wi);
    }
    return wi;
  }
  _getPrefixDef(prefix) {
    const def = this.prefixes.get(prefix);
    if (!def) {
      throw new PrefixNotFoundError(
        `Unknown prefix: "${prefix}". Registered: [${formatList(this.prefixes.keys())}]`
      );
    }
    return def;
  }
  _getPrefixVersion(prefix, version2) {
    const def = this._getPrefixDef(prefix);
    const pv = def.versions.find((v) => v.version === version2);
    if (!pv) {
      throw new VersionNotFoundError(
        `Unknown version "${version2}" for prefix "${prefix}". Available: [${formatList(def.versions.map((pv2) => pv2.version))}]`
      );
    }
    return pv;
  }
  _validatePrefixDef(name, def) {
    assertNoColon(name, `Prefix "${name}"`);
    assertNonEmptyArray(def.labels, `Prefix "${name}" labels`);
    assertNonEmptyArray(def.versions, `Prefix "${name}" versions`);
    const versionSet = /* @__PURE__ */ new Set();
    for (const pv of def.versions) {
      assertNoColon(pv.version, `Prefix "${name}" version`);
      if (versionSet.has(pv.version)) {
        throw new ShapeError(
          `Duplicate version "${pv.version}" in prefix "${name}"`
        );
      }
      versionSet.add(pv.version);
      for (const label of def.labels) {
        const labelVer = pv.labelVersions[label];
        if (!labelVer) {
          throw new ShapeError(
            `Prefix "${name}" version "${pv.version}" is missing labelVersion for label "${label}"`
          );
        }
        this.labelReg._getMaxRaw(label, labelVer);
      }
    }
  }
};
function defineFormat(opts) {
  if (!opts.name) throw new RangeError("PackFormat: name is required");
  if (opts.chars <= 0) throw new RangeError(`PackFormat "${opts.name}": chars must be > 0`);
  const groups = opts.groups?.length ? Object.freeze([...opts.groups]) : void 0;
  if (groups) {
    const sum = groups.reduce((a, b) => a + b, 0);
    if (sum !== opts.chars) {
      throw new RangeError(
        `PackFormat "${opts.name}": groups sum (${sum}) \u2260 chars (${opts.chars})`
      );
    }
    if (groups.some((g) => g <= 0)) {
      throw new RangeError(`PackFormat "${opts.name}": each group must be > 0`);
    }
  }
  return Object.freeze({
    name: opts.name,
    chars: opts.chars,
    bits: opts.chars * 4,
    label: opts.label,
    groups
  });
}
__name(defineFormat, "defineFormat");
var PACK_FORMATS = {
  int64: defineFormat({ name: "int64", chars: 16, label: "64-bit Integer" }),
  objectId: defineFormat({ name: "objectId", chars: 24, label: "96-bit ObjectId" }),
  uuid: defineFormat({ name: "uuid", chars: 32, label: "UUID (128-bit)", groups: [8, 4, 4, 4, 12] }),
  sha1: defineFormat({ name: "sha1", chars: 40, label: "160-bit (SHA-1)" }),
  sha256: defineFormat({ name: "sha256", chars: 64, label: "256-bit (SHA-256)" })
};
var PACK_FORMAT_LIST = Object.values(PACK_FORMATS);
function formatHex(format, rawHex) {
  if (!format.groups?.length) return rawHex;
  const parts = [];
  let pos = 0;
  for (const g of format.groups) {
    parts.push(rawHex.slice(pos, pos + g));
    pos += g;
  }
  return parts.join("-");
}
__name(formatHex, "formatHex");
function parseHex(formatted) {
  return formatted.replace(/-/g, "").toLowerCase();
}
__name(parseHex, "parseHex");
var colonProtocol = {
  name: "colon",
  test(input) {
    if (input.includes("://")) return false;
    const parts = input.split(":");
    return parts.length === 3 && parts.every((p) => p.length > 0);
  },
  serialize(addr) {
    return `${addr.schema}:${addr.version}:${addr.index}`;
  },
  parse(input) {
    const parts = input.split(":");
    if (parts.length !== 3 || parts.some((p) => !p)) {
      throw new SyntaxError(`Invalid colon address: "${input}"`);
    }
    const index = Number(parts[2]);
    if (!Number.isFinite(index)) {
      throw new SyntaxError(`Invalid index in colon address: "${parts[2]}"`);
    }
    return { schema: parts[0], version: parts[1], index };
  }
};
var uriProtocol = {
  name: "uri",
  test(input) {
    return input.startsWith("wi://");
  },
  serialize(addr) {
    return `wi://${addr.schema}/${addr.version}/${addr.index}`;
  },
  parse(input) {
    if (!input.startsWith("wi://")) {
      throw new SyntaxError(`Invalid URI address: "${input}" (expected wi:// scheme)`);
    }
    const path = input.slice(5);
    const parts = path.split("/");
    if (parts.length !== 3 || parts.some((p) => !p)) {
      throw new SyntaxError(`Invalid URI address path: "${path}" (expected schema/version/index)`);
    }
    const index = Number(parts[2]);
    if (!Number.isFinite(index)) {
      throw new SyntaxError(`Invalid index in URI address: "${parts[2]}"`);
    }
    return { schema: parts[0], version: parts[1], index };
  }
};
var compactProtocol = {
  name: "compact",
  /**
   * Detect whether an input string matches the compact format.
   *
   * NOTE: If both schema and version consist entirely of hex characters
   * (e.g., "a1b2-c3d4-42"), the input is treated as a layout protocol
   * address and this method returns false. Such compact addresses cannot
   * be auto-detected and must be explicitly parsed via
   * `compactProtocol.parse()`.
   */
  test(input) {
    if (input.includes(":") || input.includes("/")) return false;
    const parts = input.split("-");
    if (parts.length < 3 || !/^\d+$/.test(parts[parts.length - 1])) return false;
    const allHex = parts.every((p) => /^[0-9a-f]+$/i.test(p));
    if (allHex) return false;
    return true;
  },
  serialize(addr) {
    return `${addr.schema}-${addr.version}-${addr.index}`;
  },
  parse(input) {
    const lastDash = input.lastIndexOf("-");
    if (lastDash < 0) throw new SyntaxError(`Invalid compact address: "${input}"`);
    const indexStr = input.slice(lastDash + 1);
    const rest = input.slice(0, lastDash);
    const secondDash = rest.lastIndexOf("-");
    if (secondDash < 0) throw new SyntaxError(`Invalid compact address: "${input}"`);
    const version2 = rest.slice(secondDash + 1);
    const schema = rest.slice(0, secondDash);
    if (!schema || !version2 || !indexStr) {
      throw new SyntaxError(`Invalid compact address: "${input}"`);
    }
    const index = Number(indexStr);
    if (!Number.isFinite(index)) {
      throw new SyntaxError(`Invalid index in compact address: "${indexStr}"`);
    }
    return { schema, version: version2, index };
  }
};
function createLayoutProtocol(opts) {
  const { format, schemaChars, versionChars, schemas, versions: versions2, sharding } = opts;
  const shardChars = sharding?.chars ?? 0;
  if (sharding !== void 0) {
    if (!Number.isInteger(sharding.chars) || sharding.chars <= 0) {
      throw new RangeError(`createLayoutProtocol: sharding.chars must be a positive integer, got ${sharding.chars}`);
    }
    if (!Number.isInteger(sharding.numShards) || sharding.numShards < 1) {
      throw new RangeError(`createLayoutProtocol: sharding.numShards must be a positive integer, got ${sharding.numShards}`);
    }
    const shardCapacity = 16 ** sharding.chars;
    if (sharding.numShards > shardCapacity) {
      throw new RangeError(
        `createLayoutProtocol: sharding.numShards(${sharding.numShards}) exceeds chars(${sharding.chars}) capacity (max ${shardCapacity})`
      );
    }
  }
  const leftChars = schemaChars + versionChars + shardChars;
  const indexChars = format.chars - leftChars;
  if (indexChars <= 0) {
    throw new RangeError(
      `createLayoutProtocol: schema(${schemaChars}) + version(${versionChars}) + shard(${shardChars}) = ${leftChars} \u2265 format.chars(${format.chars})`
    );
  }
  function computeShard(index) {
    return index % sharding.numShards;
  }
  __name(computeShard, "computeShard");
  const schemaByNum = /* @__PURE__ */ new Map();
  for (const [name, num] of Object.entries(schemas)) schemaByNum.set(num, name);
  const versionByNum = /* @__PURE__ */ new Map();
  for (const [name, num] of Object.entries(versions2)) versionByNum.set(num, name);
  const hexPattern = format.groups ? new RegExp(`^${format.groups.map((g) => `[0-9a-f]{${g}}`).join("-")}$`, "i") : new RegExp(`^[0-9a-f]{${format.chars}}$`, "i");
  return {
    name: `layout:${format.name}`,
    test(input) {
      return hexPattern.test(input);
    },
    serialize(addr) {
      const sNum = schemas[addr.schema];
      const vNum = versions2[addr.version];
      if (sNum === void 0) throw new RangeError(`Unknown schema: "${addr.schema}"`);
      if (vNum === void 0) throw new RangeError(`Unknown version: "${addr.version}"`);
      const schemaMax = 16 ** schemaChars - 1;
      if (sNum > schemaMax) {
        throw new RangeError(
          `Schema value ${sNum} exceeds allocated ${schemaChars} hex char(s) (max ${schemaMax})`
        );
      }
      const versionMax = 16 ** versionChars - 1;
      if (vNum > versionMax) {
        throw new RangeError(
          `Version value ${vNum} exceeds allocated ${versionChars} hex char(s) (max ${versionMax})`
        );
      }
      const indexMax = 16 ** indexChars - 1;
      if (addr.index > indexMax) {
        throw new RangeError(
          `Index value ${addr.index} exceeds allocated ${indexChars} hex char(s) (max ${indexMax})`
        );
      }
      const sHex = sNum.toString(16).padStart(schemaChars, "0");
      const vHex = vNum.toString(16).padStart(versionChars, "0");
      const shHex = shardChars > 0 ? computeShard(addr.index).toString(16).padStart(shardChars, "0") : "";
      const iHex = addr.index.toString(16).padStart(indexChars, "0");
      const rawHex = sHex + vHex + shHex + iHex;
      return formatHex(format, rawHex);
    },
    parse(input) {
      const raw2 = parseHex(input);
      if (raw2.length !== format.chars) {
        throw new SyntaxError(`Expected ${format.chars} hex chars, got ${raw2.length}`);
      }
      const sNum = parseInt(raw2.slice(0, schemaChars), 16);
      const vNum = parseInt(raw2.slice(schemaChars, schemaChars + versionChars), 16);
      const shNum = shardChars > 0 ? parseInt(raw2.slice(schemaChars + versionChars, leftChars), 16) : void 0;
      const idx = parseInt(raw2.slice(format.chars - indexChars), 16);
      const schema = schemaByNum.get(sNum);
      const version2 = versionByNum.get(vNum);
      if (schema === void 0) throw new SyntaxError(`Unknown schema number: ${sNum} (0x${sNum.toString(16)})`);
      if (version2 === void 0) throw new SyntaxError(`Unknown version number: ${vNum} (0x${vNum.toString(16)})`);
      return { schema, version: version2, index: idx, ...shNum !== void 0 && { shard: shNum } };
    }
  };
}
__name(createLayoutProtocol, "createLayoutProtocol");
var AddressConverter = class {
  static {
    __name(this, "AddressConverter");
  }
  constructor() {
    this.protos = /* @__PURE__ */ new Map();
    this.order = [];
  }
  /**
   * Register a protocol.
   * Layout protocols (`name.startsWith("layout:")`) are inserted before
   * text protocols so that hex patterns are tested before compact `-` matching.
   * Same name overwrites in place.
   */
  register(protocol) {
    const existed = this.protos.has(protocol.name);
    this.protos.set(protocol.name, protocol);
    if (existed) {
      this.order = this.order.map((p) => p.name === protocol.name ? protocol : p);
    } else if (protocol.name.startsWith("layout:")) {
      const firstTextIdx = this.order.findIndex((p) => !p.name.startsWith("layout:"));
      if (firstTextIdx >= 0) {
        this.order.splice(firstTextIdx, 0, protocol);
      } else {
        this.order.push(protocol);
      }
    } else {
      this.order.push(protocol);
    }
    return this;
  }
  /** Get a protocol by name. */
  get(name) {
    return this.protos.get(name);
  }
  /** Get a protocol by name, throw if not found. */
  require(name) {
    const p = this.protos.get(name);
    if (!p) throw new RangeError(`AddressConverter: unknown protocol "${name}"`);
    return p;
  }
  /** List registered protocol names. */
  protocols() {
    return this.order.map((p) => p.name);
  }
  /** Auto-detect protocol and parse. */
  parse(input) {
    for (const proto of this.order) {
      if (proto.test(input)) return proto.parse(input);
    }
    throw new SyntaxError(`AddressConverter: cannot detect protocol for "${input}"`);
  }
  /** Serialize to a named protocol. */
  serialize(addr, protocolName) {
    return this.require(protocolName).serialize(addr);
  }
  /** Convert from any registered protocol to another. */
  convert(input, to) {
    return this.serialize(this.parse(input), to);
  }
};
function fromVersionedValue(vv) {
  return { schema: vv.indexId, version: vv.versionId, index: vv.value };
}
__name(fromVersionedValue, "fromVersionedValue");
function toVersionedValue(addr) {
  return { indexId: addr.schema, versionId: addr.version, value: addr.index };
}
__name(toVersionedValue, "toVersionedValue");

// ../index-meta/dist/chunk-K3AET35M.js
var IndexMetaError = class extends Error {
  static {
    __name(this, "IndexMetaError");
  }
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
};
var DimNotFoundError = class extends IndexMetaError {
  static {
    __name(this, "DimNotFoundError");
  }
};
var SnapshotNotFoundError = class extends IndexMetaError {
  static {
    __name(this, "SnapshotNotFoundError");
  }
};
var IndexNotFoundError = class extends IndexMetaError {
  static {
    __name(this, "IndexNotFoundError");
  }
};
var IndexVersionNotFoundError = class extends IndexMetaError {
  static {
    __name(this, "IndexVersionNotFoundError");
  }
};
var EntryNotFoundError = class extends IndexMetaError {
  static {
    __name(this, "EntryNotFoundError");
  }
};
var MigrationNotFoundError = class extends IndexMetaError {
  static {
    __name(this, "MigrationNotFoundError");
  }
};
var ValidationError = class extends IndexMetaError {
  static {
    __name(this, "ValidationError");
  }
};
var ParseError = class extends IndexMetaError {
  static {
    __name(this, "ParseError");
  }
};
var NegotiationError = class extends IndexMetaError {
  static {
    __name(this, "NegotiationError");
  }
};
var AddressProtocolManager = class {
  static {
    __name(this, "AddressProtocolManager");
  }
  constructor(config2) {
    this._protocols = /* @__PURE__ */ new Map();
    this._order = [];
    this._fallbackStats = /* @__PURE__ */ new Map();
    this._converterDirty = true;
    this._registerInternal(uriProtocol);
    this._registerInternal(colonProtocol);
    this._registerInternal(compactProtocol);
    this._defaultProtocol = "colon";
    if (config2) {
      this._schemaReverseMap = /* @__PURE__ */ new Map();
      for (const [name, num] of Object.entries(config2.schemas)) {
        this._schemaReverseMap.set(num, name);
      }
      this._schemaChars = config2.schemaChars;
      if (Object.keys(config2.schemas).length > 0 && Object.keys(config2.versions).length > 0) {
        const layoutProto = createLayoutProtocol({
          format: config2.format,
          schemaChars: config2.schemaChars,
          versionChars: config2.versionChars,
          sharding: config2.sharding,
          schemas: config2.schemas,
          versions: config2.versions
        });
        this._registerInternal(layoutProto);
        this._defaultProtocol = layoutProto.name;
      }
    }
  }
  // ── Core operations (§17) ────────────────────────────────────────────────
  /**
   * VersionedValue → 프로토콜 형식 문자열.
   *
   * protocol 생략 시 writeProtocol → defaultProtocol 순으로 사용.
   */
  serialize(vv, protocol) {
    const addr = fromVersionedValue(vv);
    if (typeof protocol === "object") return protocol.serialize(addr);
    const protoName = protocol ?? this._writeProtocol ?? this._defaultProtocol;
    return this._requireProtocol(protoName).serialize(addr);
  }
  /**
   * 프로토콜 형식 문자열 → VersionedValue.
   *
   * registry 검증 없는 loose parsing.
   * fallbackChain > readProtocols > 자동 감지 순으로 파싱 전략 결정.
   */
  parse(input, protocol) {
    let addr;
    try {
      if (typeof protocol === "object") {
        addr = protocol.parse(input);
      } else if (protocol) {
        addr = this._requireProtocol(protocol).parse(input);
      } else if (this._fallbackChain) {
        addr = this._parseWithFallback(input);
      } else if (this._readProtocols) {
        addr = this._parseWithReadProtocols(input);
      } else {
        addr = this._autoDetect(input);
      }
    } catch (e) {
      if (e instanceof ParseError) throw e;
      throw new ParseError(
        `Failed to parse address "${input}": ${e instanceof Error ? e.message : String(e)}`
      );
    }
    return toVersionedValue(addr);
  }
  /**
   * 주소에서 schema(indexId)만 추출.
   *
   * layout 설정이 있으면 hex에서 schema 필드를 직접 읽어 이름 역매핑.
   * 없으면 전체 파싱 후 schema 반환.
   */
  parseSchemaOnly(input) {
    if (this._schemaReverseMap && this._schemaChars) {
      const rawHex = input.replace(/[^0-9a-fA-F]/g, "");
      const schemaHex = rawHex.slice(0, this._schemaChars);
      const schemaNum = parseInt(schemaHex, 16);
      const schema = this._schemaReverseMap.get(schemaNum);
      if (schema === void 0) {
        throw new ParseError(
          `Unknown schema number ${schemaNum} (0x${schemaHex}) in "${input}"`
        );
      }
      return { schema };
    }
    const addr = this._autoDetect(input);
    return { schema: addr.schema };
  }
  /**
   * 프로토콜 간 변환.
   *
   * 입력을 자동 감지 파싱 → targetProtocol로 직렬화.
   */
  convert(input, targetProtocol) {
    const addr = this._autoDetect(input);
    return this._requireProtocol(targetProtocol).serialize(addr);
  }
  // ── Protocol lifecycle (§18-1) ───────────────────────────────────────────
  /**
   * 프로토콜 등록.
   *
   * layout: 접두사 프로토콜은 text 프로토콜보다 앞에 배치된다.
   * 동일 이름이면 덮어쓴다.
   */
  register(protocol) {
    this._registerInternal(protocol);
    this._converterDirty = true;
  }
  /**
   * 프로토콜 해제.
   *
   * 해제 전 생성된 PK는 다른 프로토콜로 파싱 가능.
   * default/write/read/fallback에서도 자동 제거.
   */
  unregister(name) {
    if (!this._protocols.has(name)) {
      throw new ValidationError(`Protocol "${name}" is not registered`);
    }
    this._protocols.delete(name);
    this._order = this._order.filter((p) => p.name !== name);
    this._converterDirty = true;
    if (this._defaultProtocol === name) {
      this._defaultProtocol = this._order.length > 0 ? this._order[0].name : "colon";
    }
    if (this._writeProtocol === name) {
      this._writeProtocol = void 0;
    }
    this._readProtocols?.delete(name);
    if (this._fallbackChain) {
      this._fallbackChain = this._fallbackChain.filter((n) => n !== name);
    }
  }
  // ── Negotiation (§18-2) ──────────────────────────────────────────────────
  /**
   * 포맷 협상.
   *
   * 서버 우선순위에서 클라이언트도 지원하는 첫 번째 프로토콜을 반환.
   * 공통 프로토콜이 없으면 NegotiationError.
   */
  negotiate(clientCapabilities, serverPreferences) {
    for (const pref of serverPreferences) {
      if (clientCapabilities.includes(pref) && this._protocols.has(pref)) {
        return pref;
      }
    }
    throw new NegotiationError(
      `No common protocol: client=[${clientCapabilities.join(", ")}], server=[${serverPreferences.join(", ")}]`
    );
  }
  // ── Protocol versioning (§18-3) ──────────────────────────────────────────
  /**
   * 쓰기 프로토콜 설정.
   *
   * serialize()에서 protocol 인자 생략 시 이 프로토콜 사용.
   */
  setWriteProtocol(name) {
    this._requireProtocol(name);
    this._writeProtocol = name;
  }
  /**
   * 읽기 프로토콜 추가.
   *
   * 최초 호출 시 등록된 모든 프로토콜로 읽기 집합 초기화.
   * 이후 추가/제거로 읽기 허용 범위 관리.
   */
  addReadProtocol(name) {
    this._requireProtocol(name);
    if (!this._readProtocols) {
      this._readProtocols = new Set(this._protocols.keys());
    }
    this._readProtocols.add(name);
  }
  /**
   * 읽기 프로토콜 제거.
   *
   * 제거된 프로토콜 형식의 입력은 parse() 시 ParseError.
   */
  removeReadProtocol(name) {
    if (!this._readProtocols) {
      this._readProtocols = new Set(this._protocols.keys());
    }
    if (!this._readProtocols.has(name)) {
      throw new ValidationError(
        `Read protocol "${name}" is not in the read set`
      );
    }
    this._readProtocols.delete(name);
  }
  // ── Fallback (§18-4) ────────────────────────────────────────────────────
  /**
   * fallback 체인 설정.
   *
   * parse()에서 protocol 인자 생략 시 이 체인 순서대로 시도.
   * 통계는 초기화된다.
   */
  setFallbackChain(protocols) {
    for (const name of protocols) {
      this._requireProtocol(name);
    }
    this._fallbackChain = [...protocols];
    this._fallbackStats.clear();
    for (const name of protocols) {
      this._fallbackStats.set(name, { attempted: 0, succeeded: 0 });
    }
  }
  /**
   * fallback 프로토콜별 시도/성공 통계 반환.
   */
  getFallbackStats() {
    const result = {};
    for (const [name, stats] of this._fallbackStats) {
      result[name] = { ...stats };
    }
    return result;
  }
  // ── Accessors ────────────────────────────────────────────────────────────
  /**
   * AddressConverter 인스턴스 반환.
   *
   * 등록된 프로토콜에서 on-demand 구축. register/unregister 시 재구축.
   */
  get converter() {
    if (this._converterDirty || !this._cachedConverter) {
      const conv = new AddressConverter();
      for (const proto of this._order) {
        conv.register(proto);
      }
      this._cachedConverter = conv;
      this._converterDirty = false;
    }
    return this._cachedConverter;
  }
  /**
   * 현재 기본 프로토콜.
   *
   * writeProtocol이 설정되어 있으면 writeProtocol 반환.
   */
  get defaultProtocol() {
    return this._writeProtocol ?? this._defaultProtocol;
  }
  /** 등록된 프로토콜 이름 목록 (감지 순서). */
  get registeredProtocols() {
    return this._order.map((p) => p.name);
  }
  // ── Internal ─────────────────────────────────────────────────────────────
  /** 프로토콜을 내부 맵과 감지 순서에 등록. */
  _registerInternal(protocol) {
    const existed = this._protocols.has(protocol.name);
    this._protocols.set(protocol.name, protocol);
    if (existed) {
      this._order = this._order.map(
        (p) => p.name === protocol.name ? protocol : p
      );
    } else if (protocol.name.startsWith("layout:")) {
      const firstTextIdx = this._order.findIndex(
        (p) => !p.name.startsWith("layout:")
      );
      if (firstTextIdx >= 0) {
        this._order.splice(firstTextIdx, 0, protocol);
      } else {
        this._order.push(protocol);
      }
    } else {
      this._order.push(protocol);
    }
  }
  /** 이름으로 프로토콜 조회. 없으면 ParseError. */
  _requireProtocol(name) {
    const p = this._protocols.get(name);
    if (!p) throw new ParseError(`Unknown protocol "${name}"`);
    return p;
  }
  /** 등록된 프로토콜을 감지 순서대로 시도. */
  _autoDetect(input) {
    for (const proto of this._order) {
      if (proto.test(input)) return proto.parse(input);
    }
    throw new ParseError(`Cannot detect protocol for "${input}"`);
  }
  /** readProtocols 집합에 포함된 프로토콜만으로 자동 감지. */
  _parseWithReadProtocols(input) {
    for (const proto of this._order) {
      if (this._readProtocols.has(proto.name) && proto.test(input)) {
        return proto.parse(input);
      }
    }
    throw new ParseError(
      `No read protocol matches "${input}". Allowed: [${[...this._readProtocols].join(", ")}]`
    );
  }
  /** fallback 체인 순서대로 시도. 통계 수집. */
  _parseWithFallback(input) {
    for (const name of this._fallbackChain) {
      const proto = this._protocols.get(name);
      if (!proto) continue;
      const stats = this._fallbackStats.get(name);
      if (stats) stats.attempted++;
      try {
        if (proto.test(input)) {
          const addr = proto.parse(input);
          if (stats) stats.succeeded++;
          return addr;
        }
      } catch {
        continue;
      }
    }
    throw new ParseError(
      `All fallback protocols failed for "${input}": [${this._fallbackChain.join(", ")}]`
    );
  }
};
var MetaCodec = class {
  static {
    __name(this, "MetaCodec");
  }
  constructor(map) {
    this._map = map;
    const labelDefs = {};
    for (const dim of map.dims) {
      labelDefs[dim.dimId] = [{ version: dim.snapshotId, ids: [...dim.entries] }];
    }
    const labels = createLabelRegistry(labelDefs);
    this._prefix = new PrefixCodec(labels, {
      [map.indexId]: {
        labels: map.dims.map((d) => d.dimId),
        versions: [
          {
            version: map.versionId,
            labelVersions: Object.fromEntries(
              map.dims.map((d) => [d.dimId, d.snapshotId])
            )
          }
        ]
      }
    });
  }
  /**
   * entity ID 레코드 → VersionedValue.
   *
   * @example
   * codec.encode({ role: "admin", action: "read", resource: 10 })
   * // → { indexId: "perm", versionId: "v1", value: 0 }
   */
  encode(entityIds) {
    try {
      const vi = this._prefix.encodeFromIds(
        this._map.indexId,
        entityIds,
        this._map.versionId
      );
      return { indexId: vi.prefix, versionId: vi.v, value: vi.id };
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        throw new EntryNotFoundError(
          `encode "${this._map.indexId}/${this._map.versionId}": ${e.message}`
        );
      }
      if (e instanceof CoordError) {
        throw new ValidationError(
          `encode "${this._map.indexId}/${this._map.versionId}": ${e.message}`
        );
      }
      throw e;
    }
  }
  /**
   * VersionedValue → entity ID 레코드.
   *
   * indexId/versionId가 이 코덱과 일치하는지 검증한다.
   * inactive entry도 항상 decode 가능하다.
   *
   * @example
   * codec.decode({ indexId: "perm", versionId: "v1", value: 0 })
   * // → { role: "admin", action: "read", resource: 10 }
   */
  decode(vv) {
    if (vv.indexId !== this._map.indexId || vv.versionId !== this._map.versionId) {
      throw new ValidationError(
        `decode: expected "${this._map.indexId}/${this._map.versionId}", got "${vv.indexId}/${vv.versionId}"`
      );
    }
    return this.decodeValue(vv.value);
  }
  /**
   * value(정수) → entity ID 레코드.
   *
   * indexId/versionId 검증 없이 value만으로 decode.
   * 이미 indexId/versionId를 알고 있는 경우 사용.
   */
  decodeValue(value) {
    const ids = this._prefix.decodeToIds({
      prefix: this._map.indexId,
      v: this._map.versionId,
      id: value
    });
    return Object.freeze(ids);
  }
  get indexId() {
    return this._map.indexId;
  }
  get versionId() {
    return this._map.versionId;
  }
  get size() {
    return this._map.size;
  }
  get shape() {
    return this._map.shape;
  }
  /** 내부 DecodeMap의 복사본 반환. */
  toDecodeMap() {
    return structuredClone(this._map);
  }
  /**
   * 부분 좌표 패턴에 매칭되는 value 범위 목록을 반환한다.
   *
   * ── 목적 ────────────────────────────────────────────────────────────────────
   *
   * DB에 VersionedValue.value가 저장되어 있을 때, 특정 dim만 고정하고 나머지를
   * 와일드카드로 두어 해당 패턴에 해당하는 value 범위를 계산한다.
   * 반환된 [from, to] 구간을 DB BETWEEN 쿼리에 그대로 사용할 수 있다.
   *
   * ── 입력 ────────────────────────────────────────────────────────────────────
   *
   *   partial의 각 dim:
   *     - EntityId 지정 → 해당 값만 매칭
   *     - null 또는 키 생략 → 와일드카드 (해당 dim의 모든 값 매칭)
   *
   * ── 반환값 ───────────────────────────────────────────────────────────────────
   *
   *   정렬·병합된 [from, to][] (from 기준 오름차순, 인접·겹치는 구간은 병합됨).
   *   모든 dim이 와일드카드이면 [[0, size-1]] 하나.
   *
   * @throws {EntryNotFoundError} partial에 지정된 entity ID가 해당 dim에 없을 때
   *
   * @example
   * // role × action × resource (3×3×3, size=27)
   * codec.matchRanges({ role: "editor", action: null })
   * // → [[9, 17]]  (role=editor인 모든 주소)
   *
   * codec.matchRanges({ role: "viewer", action: null, resource: 30 })
   * // → [[20,20],[23,23],[26,26]]  (action이 달라 비연속 구간)
   *
   * codec.matchRanges({})
   * // → [[0, 26]]  (전체 범위)
   */
  matchRanges(partial) {
    const constraints = this._map.dims.map((dim) => {
      const val = partial[dim.dimId];
      if (val === void 0 || val === null) return null;
      const idx = dim.entries.indexOf(val);
      if (idx === -1) {
        throw new EntryNotFoundError(
          `matchRanges "${this._map.indexId}/${this._map.versionId}": entity "${val}" not found in dim "${dim.dimId}"`
        );
      }
      return String(idx + 1);
    });
    return calcAddressRanges(this._map.shape, constraints);
  }
};
var MetaRegistry = class {
  static {
    __name(this, "MetaRegistry");
  }
  constructor(input) {
    this.wiCache = /* @__PURE__ */ new Map();
    this._input = structuredClone(input);
    const dimsMap = /* @__PURE__ */ new Map();
    const snapshotsMap = /* @__PURE__ */ new Map();
    const migrationsMap = /* @__PURE__ */ new Map();
    for (const [dimId, dimInput] of Object.entries(input.dims)) {
      if (!dimId) throw new ValidationError("Dim id must not be empty");
      if (dimId.includes(":")) throw new ValidationError(`Dim id must not contain ":": "${dimId}"`);
      dimsMap.set(dimId, {
        id: dimId,
        kind: dimInput.kind,
        description: dimInput.description,
        domain: dimInput.domain
      });
      const snMap = /* @__PURE__ */ new Map();
      for (const [snapshotId, snInput] of Object.entries(dimInput.snapshots)) {
        if (!snapshotId) {
          throw new ValidationError(`Dim "${dimId}": snapshot id must not be empty`);
        }
        if (snapshotId.includes(":")) {
          throw new ValidationError(`Dim "${dimId}": snapshot id must not contain ":": "${snapshotId}"`);
        }
        if (snInput.entries.length === 0) {
          throw new ValidationError(
            `DimSnapshot "${dimId}/${snapshotId}": entries must not be empty`
          );
        }
        this._validateEntriesKind(dimId, snapshotId, snInput.entries, dimInput.kind, snInput.entryRefs);
        const seen = /* @__PURE__ */ new Set();
        for (let pos = 0; pos < snInput.entries.length; pos++) {
          const raw2 = snInput.entries[pos];
          const id = typeof raw2 === "number" && Object.is(raw2, -0) ? 0 : raw2;
          if (seen.has(id)) {
            throw new ValidationError(
              `DimSnapshot "${dimId}/${snapshotId}": duplicate entity id "${id}"`
            );
          }
          seen.add(id);
        }
        if (snInput.entryRefs) {
          for (const [idxStr, ref2] of Object.entries(snInput.entryRefs)) {
            const pos = Number(idxStr);
            if (!Number.isInteger(pos) || pos < 1 || pos > snInput.entries.length) {
              throw new ValidationError(
                `DimSnapshot "${dimId}/${snapshotId}" entryRefs: key ${pos} is out of range [1, ${snInput.entries.length}]`
              );
            }
            const val = snInput.entries[pos - 1];
            if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
              throw new ValidationError(
                `DimSnapshot "${dimId}/${snapshotId}" entryRefs[${pos}]: entry value must be a non-negative integer (got ${JSON.stringify(val)})`
              );
            }
            if (!ref2.indexId || !ref2.versionId) {
              throw new ValidationError(
                `DimSnapshot "${dimId}/${snapshotId}" entryRefs[${pos}]: indexId and versionId must not be empty`
              );
            }
          }
        }
        const snapshot = {
          dimId,
          snapshotId,
          entries: Object.freeze(
            snInput.entries.map((e) => typeof e === "number" && Object.is(e, -0) ? 0 : e)
          ),
          entryFlags: Object.freeze({ ...snInput.entryFlags ?? {} }),
          entryRefs: Object.freeze({ ...snInput.entryRefs ?? {} }),
          capacity: snInput.capacity,
          createdAt: snInput.createdAt,
          changelog: snInput.changelog
        };
        snMap.set(snapshotId, { snapshot });
      }
      if (snMap.size === 0) {
        throw new ValidationError(`Dim "${dimId}" must have at least one snapshot`);
      }
      snapshotsMap.set(dimId, snMap);
      const migMap = /* @__PURE__ */ new Map();
      for (const mig of dimInput.migrations ?? []) {
        const { fromSnapshotId, toSnapshotId, indexMap } = mig;
        if (fromSnapshotId === toSnapshotId) {
          throw new ValidationError(
            `Dim "${dimId}" migration: fromSnapshotId and toSnapshotId must differ ("${fromSnapshotId}")`
          );
        }
        const fromSnap = snMap.get(fromSnapshotId)?.snapshot;
        if (!fromSnap) {
          throw new SnapshotNotFoundError(
            `Dim "${dimId}" migration: unknown fromSnapshotId "${fromSnapshotId}"`
          );
        }
        const toSnap = snMap.get(toSnapshotId)?.snapshot;
        if (!toSnap) {
          throw new SnapshotNotFoundError(
            `Dim "${dimId}" migration: unknown toSnapshotId "${toSnapshotId}"`
          );
        }
        const key = `${fromSnapshotId}:${toSnapshotId}`;
        if (migMap.has(key)) {
          throw new ValidationError(
            `Dim "${dimId}" migration: duplicate migration "${fromSnapshotId}" \u2192 "${toSnapshotId}"`
          );
        }
        const toValues = /* @__PURE__ */ new Set();
        for (const [kStr, v] of Object.entries(indexMap)) {
          const k = Number(kStr);
          if (!Number.isInteger(k) || k < 1 || k > fromSnap.entries.length) {
            throw new ValidationError(
              `Dim "${dimId}" migration "${fromSnapshotId}"\u2192"${toSnapshotId}": key ${k} out of range [1, ${fromSnap.entries.length}]`
            );
          }
          if (!Number.isInteger(v) || v < 1 || v > toSnap.entries.length) {
            throw new ValidationError(
              `Dim "${dimId}" migration "${fromSnapshotId}"\u2192"${toSnapshotId}": value ${v} out of range [1, ${toSnap.entries.length}]`
            );
          }
          if (toValues.has(v)) {
            throw new ValidationError(
              `Dim "${dimId}" migration "${fromSnapshotId}"\u2192"${toSnapshotId}": duplicate target index ${v} (bijection violation)`
            );
          }
          toValues.add(v);
        }
        migMap.set(key, {
          fromSnapshotId,
          toSnapshotId,
          indexMap: Object.freeze({ ...indexMap }),
          createdAt: mig.createdAt,
          changelog: mig.changelog
        });
      }
      migrationsMap.set(dimId, migMap);
    }
    this.dims = dimsMap;
    this.snapshots = snapshotsMap;
    this.migrations = migrationsMap;
    const indicesMap = /* @__PURE__ */ new Map();
    const versionsMap = /* @__PURE__ */ new Map();
    for (const [indexId, indexInput] of Object.entries(input.indices)) {
      if (!indexId) throw new ValidationError("Index id must not be empty");
      if (indexId.includes(":")) throw new ValidationError(`Index id must not contain ":": "${indexId}"`);
      if (indexInput.dims.length === 0) {
        throw new ValidationError(`Index "${indexId}": dims must not be empty`);
      }
      for (const dimId of indexInput.dims) {
        if (!dimsMap.has(dimId)) {
          throw new DimNotFoundError(
            `Index "${indexId}" references unknown dim "${dimId}"`
          );
        }
      }
      indicesMap.set(indexId, {
        id: indexId,
        dims: Object.freeze([...indexInput.dims]),
        description: indexInput.description,
        domain: indexInput.domain
      });
      const vMap = /* @__PURE__ */ new Map();
      for (const [versionId, vInput] of Object.entries(indexInput.versions)) {
        if (!versionId) {
          throw new ValidationError(`Index "${indexId}": version id must not be empty`);
        }
        if (versionId.includes(":")) {
          throw new ValidationError(`Index "${indexId}": version id must not contain ":": "${versionId}"`);
        }
        for (const dimId of indexInput.dims) {
          const snapshotId = vInput.snapshots[dimId];
          if (!snapshotId) {
            throw new ValidationError(
              `IndexVersion "${indexId}/${versionId}": missing snapshot for dim "${dimId}"`
            );
          }
          if (!snapshotsMap.get(dimId)?.has(snapshotId)) {
            throw new SnapshotNotFoundError(
              `IndexVersion "${indexId}/${versionId}": unknown snapshot "${dimId}/${snapshotId}"`
            );
          }
        }
        vMap.set(versionId, {
          indexId,
          versionId,
          snapshots: Object.freeze({ ...vInput.snapshots }),
          createdAt: vInput.createdAt,
          changelog: vInput.changelog
        });
      }
      if (vMap.size === 0) {
        throw new ValidationError(`Index "${indexId}" must have at least one version`);
      }
      versionsMap.set(indexId, vMap);
    }
    this.indices = indicesMap;
    this.versions = versionsMap;
    for (const [dimId, dimDef] of dimsMap) {
      if (dimDef.kind.type !== "index_ref") continue;
      const { indexId } = dimDef.kind;
      if (!indicesMap.has(indexId)) {
        throw new IndexNotFoundError(
          `Dim "${dimId}" (index_ref) references unknown indexId "${indexId}"`
        );
      }
    }
    for (const snMapEntry of snapshotsMap.values()) {
      for (const { snapshot } of snMapEntry.values()) {
        for (const [idxStr, ref2] of Object.entries(snapshot.entryRefs)) {
          const vMap = versionsMap.get(ref2.indexId);
          if (!vMap) {
            throw new IndexNotFoundError(
              `DimSnapshot "${snapshot.dimId}/${snapshot.snapshotId}" entryRefs[${idxStr}]: unknown indexId "${ref2.indexId}"`
            );
          }
          if (!vMap.has(ref2.versionId)) {
            throw new IndexVersionNotFoundError(
              `DimSnapshot "${snapshot.dimId}/${snapshot.snapshotId}" entryRefs[${idxStr}]: unknown versionId "${ref2.versionId}" for index "${ref2.indexId}"`
            );
          }
        }
      }
    }
    for (const [dimId, dimDef] of dimsMap) {
      if (dimDef.kind.type !== "index_ref") continue;
      const { indexId: targetIndexId } = dimDef.kind;
      const targetVersionMap = versionsMap.get(targetIndexId);
      const targetDef = indicesMap.get(targetIndexId);
      let maxTargetSize = 0;
      for (const iv of targetVersionMap.values()) {
        let size = 1;
        for (const d of targetDef.dims) {
          size *= snapshotsMap.get(d).get(iv.snapshots[d]).snapshot.entries.length;
        }
        maxTargetSize = Math.max(maxTargetSize, size);
      }
      const snMap = snapshotsMap.get(dimId);
      for (const { snapshot } of snMap.values()) {
        for (let pos = 0; pos < snapshot.entries.length; pos++) {
          const val = snapshot.entries[pos];
          if (val >= maxTargetSize) {
            throw new ValidationError(
              `DimSnapshot "${dimId}/${snapshot.snapshotId}" entry at position ${pos + 1} (value ${val}) is out of range for index "${targetIndexId}" (max valid value: ${maxTargetSize - 1} across all versions)`
            );
          }
        }
      }
    }
    {
      let dfs2 = /* @__PURE__ */ __name(function(nodeId, path) {
        state.set(nodeId, IN_STACK);
        path.push(nodeId);
        const neighbors = refGraph.get(nodeId);
        if (neighbors) {
          for (const target of neighbors) {
            const targetState = state.get(target);
            if (targetState === IN_STACK) {
              const cycleStart = path.indexOf(target);
              const cyclePath = [...path.slice(cycleStart), target];
              throw new ValidationError(
                `index_ref cycle detected: ${cyclePath.join(" -> ")}`
              );
            }
            if (targetState === NOT_VISITED) {
              dfs2(target, path);
            }
          }
        }
        path.pop();
        state.set(nodeId, DONE);
      }, "dfs2");
      const refGraph = /* @__PURE__ */ new Map();
      for (const [indexId, indexDef] of indicesMap) {
        const targets = /* @__PURE__ */ new Set();
        for (const dimId of indexDef.dims) {
          const dimDef = dimsMap.get(dimId);
          if (dimDef.kind.type === "index_ref" && dimDef.kind.indexId !== indexId) {
            targets.add(dimDef.kind.indexId);
          }
        }
        if (targets.size > 0) {
          refGraph.set(indexId, targets);
        }
      }
      const NOT_VISITED = 0;
      const IN_STACK = 1;
      const DONE = 2;
      const state = /* @__PURE__ */ new Map();
      for (const id of indicesMap.keys()) state.set(id, NOT_VISITED);
      for (const indexId of indicesMap.keys()) {
        if (state.get(indexId) === NOT_VISITED) {
          dfs2(indexId, []);
        }
      }
    }
    if (input.address) {
      this._validateAddressConfig(input.address, indicesMap, versionsMap);
    }
    this.address = new AddressProtocolManager(input.address);
  }
  // ── Manifest ─────────────────────────────────────────────────────────────────
  /**
   * 버전 단위 활성 인덱스 집합 반환.
   * 프로그래밍 레이어에서 선택지 필터 및 인코딩 검증에 사용.
   */
  getActiveManifest(indexId, versionId) {
    const iv = this._getIndexVersion(indexId, versionId);
    const def = this._getIndexDef(indexId);
    const dims = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
      const total = snapshot.entries.length;
      const activeIndices = [];
      for (let i = 1; i <= total; i++) {
        const flag = snapshot.entryFlags[i];
        if (!flag || flag.status === "active") activeIndices.push(i);
      }
      return { dimId, snapshotId, total, activeIndices };
    });
    return { indexId, versionId, dims };
  }
  // ── Codec ────────────────────────────────────────────────────────────────────
  /**
   * 특정 index version에 특화된 독립 코덱을 생성한다.
   *
   * 반환된 MetaCodec은 MetaRegistry 없이 단독으로 encode/decode를 수행할 수 있다.
   * DecodeMap(shape + entries)을 내부적으로 빌드해 코덱에 전달한다.
   *
   * @example
   * const codec = reg.createCodec("perm", "v1");
   * const vv = codec.encode({ role: "admin", action: "read", resource: 10 });
   * const ids = codec.decode(vv);
   */
  createCodec(indexId, versionId) {
    const def = this._getIndexDef(indexId);
    const iv = this._getIndexVersion(indexId, versionId);
    const wi = this._getWeightedIndex(indexId, versionId);
    const dims = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
      const dimDef = this.dims.get(dimId);
      return {
        dimId,
        snapshotId,
        kind: dimDef.kind,
        entries: [...snapshot.entries]
      };
    });
    return new MetaCodec({
      indexId,
      versionId,
      shape: [...wi.shape],
      size: wi.size,
      dims
    });
  }
  // ── 직렬화 ───────────────────────────────────────────────────────────────────
  /**
   * 내부 AddressConverter 반환.
   * text 프로토콜(colon, uri, compact)은 항상 사용 가능.
   * address 설정 시 layout 프로토콜도 등록되어 있다.
   */
  get converter() {
    return this.address.converter;
  }
  /**
   * 현재 기본 프로토콜 이름.
   * address 미설정: "colon", address 설정: "layout:{formatName}"
   */
  get defaultProtocol() {
    return this.address.defaultProtocol;
  }
  /**
   * VersionedValue → 프로토콜 형식 문자열.
   *
   * AddressProtocolManager에 위임한다.
   * protocol 생략 시 기본 프로토콜 사용 (address 설정 시 layout, 아니면 colon).
   *
   * @example
   * reg.serialize(vv)                    // 기본 프로토콜
   * reg.serialize(vv, "colon")           // → "perm:v1:42"
   * reg.serialize(vv, "uri")             // → "wi://perm/v1/42"
   * reg.serialize(vv, "layout:uuid")     // → "00010001-0000-...-002a"
   */
  serialize(vv, protocol) {
    return this.address.serialize(vv, protocol);
  }
  /**
   * 프로토콜 형식의 문자열 → VersionedValue.
   *
   * AddressProtocolManager의 loose parse에 registry 고유 검증을 추가한다:
   * - indexId/versionId 존재 여부
   * - value 범위 (0 ≤ value < WeightedIndex.size)
   *
   * protocol 생략 시 자동 감지 (layout → uri → colon → compact 순).
   *
   * @example
   * reg.parse("perm:iv1:0")
   * reg.parse("wi://perm/iv1/0")
   * reg.parse("00010001-0000-0000-0000-000000000000")
   * reg.parse("perm:iv1:0", "colon")     // 명시적 프로토콜
   */
  parse(input, protocol) {
    const vv = this.address.parse(input, protocol);
    this._getIndexVersion(vv.indexId, vv.versionId);
    const wi = this._getWeightedIndex(vv.indexId, vv.versionId);
    if (vv.value < 0 || vv.value >= wi.size) {
      throw new ParseError(
        `Value ${vv.value} out of range [0, ${wi.size - 1}] for "${vv.indexId}/${vv.versionId}"`
      );
    }
    return vv;
  }
  // ── 조회 ─────────────────────────────────────────────────────────────────────
  getDimDef(dimId) {
    const def = this.dims.get(dimId);
    if (!def) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    return def;
  }
  getDimSnapshot(dimId, snapshotId) {
    return this._getSnapshotCache(dimId, snapshotId).snapshot;
  }
  /**
   * 두 스냅샷 간 직접 등록된 migration을 반환.
   * 직접 연결이 없으면 MigrationNotFoundError.
   */
  getMigration(dimId, fromSnapshotId, toSnapshotId) {
    if (!this.dims.has(dimId)) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    const migMap = this.migrations.get(dimId);
    const mig = migMap?.get(`${fromSnapshotId}:${toSnapshotId}`);
    if (!mig) {
      throw new MigrationNotFoundError(
        `No direct migration for dim "${dimId}": "${fromSnapshotId}" \u2192 "${toSnapshotId}"`
      );
    }
    return mig;
  }
  /**
   * fromSnapshotId → toSnapshotId 경로로 1-based index를 추적한다.
   *
   * 등록된 migration edge를 BFS로 탐색해 경로를 찾고, 각 구간 indexMap을 순서대로 적용.
   * 경로가 없으면 MigrationNotFoundError.
   *
   * ── sparse migration (identity fallback) ──────────────────────────────────
   *
   * indexMap에 명시되지 않은 위치는 identity로 처리된다 (동일 index 유지).
   * 이는 의도적인 설계로, entry가 두 스냅샷에서 같은 위치에 있으면 명시할 필요가 없다.
   *
   * WARNING: ALL positions that changed between snapshots MUST be explicitly
   * mapped in indexMap. Unmapped positions silently fall through with identity
   * (the same index is returned), which will cause silent data inconsistency
   * if the entry at that position actually moved. The caller is responsible
   * for ensuring the indexMap is complete for all changed positions.
   */
  traceMigration(dimId, fromSnapshotId, toSnapshotId, index) {
    if (!this.dims.has(dimId)) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    if (fromSnapshotId === toSnapshotId) return index;
    const path = this._findMigrationPath(dimId, fromSnapshotId, toSnapshotId);
    if (!path) {
      throw new MigrationNotFoundError(
        `No migration path for dim "${dimId}": "${fromSnapshotId}" \u2192 "${toSnapshotId}"`
      );
    }
    let current = index;
    for (let i = 0; i < path.length - 1; i++) {
      const mig = this.migrations.get(dimId)?.get(`${path[i]}:${path[i + 1]}`);
      current = mig?.indexMap[current] ?? current;
    }
    return current;
  }
  getIndexDef(indexId) {
    return this._getIndexDef(indexId);
  }
  getIndexVersion(indexId, versionId) {
    return this._getIndexVersion(indexId, versionId);
  }
  /**
   * migration의 indexMap이 완전한지 검증한다.
   *
   * fromSnapshot과 toSnapshot의 entries를 비교해,
   * 같은 position에 다른 entity가 들어간 경우 indexMap에 해당 position이 명시되어 있는지 확인.
   * 누락된 position이 있으면 ValidationError를 던진다.
   *
   * traceMigration()은 성능상 이 검증을 수행하지 않으므로,
   * migration 등록 시 또는 테스트에서 이 메서드로 완전성을 확인할 수 있다.
   */
  validateMigration(dimId, fromSnapshotId, toSnapshotId) {
    if (!this.dims.has(dimId)) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    const mig = this.getMigration(dimId, fromSnapshotId, toSnapshotId);
    const fromSnap = this._getSnapshotCache(dimId, fromSnapshotId).snapshot;
    const toSnap = this._getSnapshotCache(dimId, toSnapshotId).snapshot;
    const toEntityPos = /* @__PURE__ */ new Map();
    for (let i = 0; i < toSnap.entries.length; i++) {
      toEntityPos.set(toSnap.entries[i], i + 1);
    }
    const unmapped = [];
    for (let pos = 1; pos <= fromSnap.entries.length; pos++) {
      const entity = fromSnap.entries[pos - 1];
      const toPos = toEntityPos.get(entity);
      if (toPos === void 0) {
        continue;
      }
      if (toPos === pos) {
        continue;
      }
      const mapped = mig.indexMap[pos];
      if (mapped === void 0) {
        unmapped.push(pos);
      } else if (mapped !== toPos) {
        throw new ValidationError(
          `Dim "${dimId}" migration "${fromSnapshotId}"\u2192"${toSnapshotId}": position ${pos} maps to ${mapped}, but entity "${entity}" is at position ${toPos} in toSnapshot`
        );
      }
    }
    if (unmapped.length > 0) {
      throw new ValidationError(
        `Dim "${dimId}" migration "${fromSnapshotId}"\u2192"${toSnapshotId}": unmapped positions with changed entities: [${unmapped.join(", ")}]`
      );
    }
  }
  // ── Diff 유틸리티 ──────────────────────────────────────────────────────────
  /**
   * 두 스냅샷 간 diff를 반환한다.
   *
   * entries.length 변화 (= MetaRegistry 수준 shape 변화)와
   * 추가/이동된 entry 목록을 포함한다.
   */
  snapshotDiff(dimId, fromSnapshotId, toSnapshotId) {
    const fromSnap = this._getSnapshotCache(dimId, fromSnapshotId).snapshot;
    const toSnap = this._getSnapshotCache(dimId, toSnapshotId).snapshot;
    const fromSet = new Set(fromSnap.entries);
    const addedEntries = [];
    for (const entry of toSnap.entries) {
      if (!fromSet.has(entry)) {
        addedEntries.push(entry);
      }
    }
    const movedPositions = [];
    const migMap = this.migrations.get(dimId);
    const mig = migMap?.get(`${fromSnapshotId}:${toSnapshotId}`);
    if (mig) {
      for (const [kStr, v] of Object.entries(mig.indexMap)) {
        const k = Number(kStr);
        if (k !== v) {
          movedPositions.push({ position: k, from: k, to: v, entity: fromSnap.entries[k - 1] });
        }
      }
      movedPositions.sort((a, b) => a.position - b.position);
    }
    const fromCapa = fromSnap.capacity ?? fromSnap.entries.length;
    const toCapa = toSnap.capacity ?? toSnap.entries.length;
    return {
      dimId,
      from: {
        snapshotId: fromSnapshotId,
        entriesCount: fromSnap.entries.length,
        capacity: fromCapa,
        headroom: fromCapa - fromSnap.entries.length,
        entries: fromSnap.entries
      },
      to: {
        snapshotId: toSnapshotId,
        entriesCount: toSnap.entries.length,
        capacity: toCapa,
        headroom: toCapa - toSnap.entries.length,
        entries: toSnap.entries
      },
      capacityChanged: fromCapa !== toCapa,
      addedEntries,
      movedPositions
    };
  }
  /**
   * 두 index version 간 shape/weight 영향을 분석한다.
   *
   * capacity 변화가 weight에 영향을 미치는지 판단하고,
   * ID 보존 여부를 반환한다. 마이그레이션 계획의 핵심 입력.
   */
  versionDiff(indexId, fromVersionId, toVersionId) {
    const def = this._getIndexDef(indexId);
    const fromIv = this._getIndexVersion(indexId, fromVersionId);
    const toIv = this._getIndexVersion(indexId, toVersionId);
    const fromWi = this._getWeightedIndex(indexId, fromVersionId);
    const toWi = this._getWeightedIndex(indexId, toVersionId);
    const fromWeights = calcWeights([...fromWi.shape]);
    const toWeights = calcWeights([...toWi.shape]);
    let weightsChanged = fromWeights.length !== toWeights.length;
    if (!weightsChanged) {
      for (let i = 0; i < fromWeights.length; i++) {
        if (fromWeights[i] !== toWeights[i]) {
          weightsChanged = true;
          break;
        }
      }
    }
    const idPreserved = !weightsChanged && toWi.size >= fromWi.size;
    const changedDims = [];
    for (const dimId of def.dims) {
      const fromSnapshotId = fromIv.snapshots[dimId];
      const toSnapshotId = toIv.snapshots[dimId];
      if (fromSnapshotId !== toSnapshotId) {
        const fromSnap = this._getSnapshotCache(dimId, fromSnapshotId).snapshot;
        const toSnap = this._getSnapshotCache(dimId, toSnapshotId).snapshot;
        const fromCapa = fromSnap.capacity ?? fromSnap.entries.length;
        const toCapa = toSnap.capacity ?? toSnap.entries.length;
        changedDims.push({
          dimId,
          fromSnapshot: fromSnapshotId,
          toSnapshot: toSnapshotId,
          fromEntriesCount: fromSnap.entries.length,
          toEntriesCount: toSnap.entries.length,
          fromCapacity: fromCapa,
          toCapacity: toCapa,
          fromHeadroom: fromCapa - fromSnap.entries.length,
          toHeadroom: toCapa - toSnap.entries.length,
          fromEntries: fromSnap.entries,
          toEntries: toSnap.entries
        });
      }
    }
    return {
      indexId,
      from: {
        versionId: fromVersionId,
        shape: fromWi.shape,
        weights: Object.freeze(fromWeights),
        size: fromWi.size
      },
      to: {
        versionId: toVersionId,
        shape: toWi.shape,
        weights: Object.freeze(toWeights),
        size: toWi.size
      },
      weightsChanged,
      idPreserved,
      changedDims
    };
  }
  /** 캐싱된 WeightedIndex 인스턴스 반환. */
  getWeightedIndex(indexId, versionId) {
    return this._getWeightedIndex(indexId, versionId);
  }
  /**
   * 특정 entry의 active 상태를 반환.
   *
   * encode() 자체는 inactive entry도 허용하므로, 인코딩 전에 active 여부를
   * 확인해야 하는 경우 이 메서드를 사용한다.
   *
   * @param dimId - 차원 ID
   * @param snapshotId - 스냅샷 ID
   * @param oneBasedIndex - 1-based 인덱스 (DimSnapshot.entries 기준)
   */
  isEntryActive(dimId, snapshotId, oneBasedIndex) {
    const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
    if (oneBasedIndex < 1 || oneBasedIndex > snapshot.entries.length) {
      throw new ValidationError(
        `isEntryActive "${dimId}/${snapshotId}": index ${oneBasedIndex} out of range [1, ${snapshot.entries.length}]`
      );
    }
    const flag = snapshot.entryFlags[oneBasedIndex];
    return !flag || flag.status === "active";
  }
  get dimIds() {
    return [...this.dims.keys()];
  }
  get indexIds() {
    return [...this.indices.keys()];
  }
  getVersionIds(indexId) {
    const vMap = this.versions.get(indexId);
    if (!vMap) throw new IndexNotFoundError(`Unknown index: "${indexId}"`);
    return [...vMap.keys()];
  }
  getSnapshotIds(dimId) {
    const snMap = this.snapshots.get(dimId);
    if (!snMap) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    return [...snMap.keys()];
  }
  /**
   * 생성자에 전달한 입력의 deep clone을 반환한다.
   *
   * `new MetaRegistry(reg.toInput())`으로 동일한 동작의 인스턴스를 복제하거나,
   * spread로 일부를 교체해 fork 패턴에 사용할 수 있다.
   */
  toInput() {
    return structuredClone(this._input);
  }
  // ── 내부 ─────────────────────────────────────────────────────────────────────
  _getSnapshotCache(dimId, snapshotId) {
    const snMap = this.snapshots.get(dimId);
    if (!snMap) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    const cache = snMap.get(snapshotId);
    if (!cache) {
      throw new SnapshotNotFoundError(`Unknown snapshot: "${dimId}/${snapshotId}"`);
    }
    return cache;
  }
  _getIndexDef(indexId) {
    const def = this.indices.get(indexId);
    if (!def) throw new IndexNotFoundError(`Unknown index: "${indexId}"`);
    return def;
  }
  _getIndexVersion(indexId, versionId) {
    const vMap = this.versions.get(indexId);
    if (!vMap) throw new IndexNotFoundError(`Unknown index: "${indexId}"`);
    const iv = vMap.get(versionId);
    if (!iv) {
      throw new IndexVersionNotFoundError(
        `Unknown version: "${indexId}/${versionId}"`
      );
    }
    return iv;
  }
  _getWeightedIndex(indexId, versionId) {
    const key = `${indexId}:${versionId}`;
    let wi = this.wiCache.get(key);
    if (!wi) {
      const iv = this._getIndexVersion(indexId, versionId);
      const def = this._getIndexDef(indexId);
      const shape = def.dims.map((dimId) => {
        const snapshotId = iv.snapshots[dimId];
        return this._getSnapshotCache(dimId, snapshotId).snapshot.entries.length;
      });
      wi = new WeightedIndex(shape, [...def.dims]);
      this.wiCache.set(key, wi);
    }
    return wi;
  }
  /**
   * entries의 값 타입이 DimKind와 일치하는지 검증.
   *
   * string_enum : 모든 entry가 string이어야 함.
   *               entryRefs로 선언된 위치는 number 허용.
   * number_enum : 모든 entry가 정수(≥ 0)여야 함.
   * index_ref   : 모든 entry가 정수(≥ 0)여야 함.
   *               (값은 다른 WeightedIndex의 VersionedValue.value)
   */
  _validateEntriesKind(dimId, snapshotId, entries, kind, entryRefs) {
    if (kind.type === "string_enum") {
      for (let i = 0; i < entries.length; i++) {
        const pos = i + 1;
        if (entryRefs?.[pos] !== void 0) continue;
        if (typeof entries[i] !== "string") {
          throw new ValidationError(
            `DimSnapshot "${dimId}/${snapshotId}" (string_enum): entry at position ${pos} must be string, got ${typeof entries[i]}`
          );
        }
      }
    } else {
      const kindLabel = kind.type;
      for (let i = 0; i < entries.length; i++) {
        const v = entries[i];
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
          throw new ValidationError(
            `DimSnapshot "${dimId}/${snapshotId}" (${kindLabel}): entry at position ${i + 1} must be a non-negative integer, got ${JSON.stringify(v)}`
          );
        }
      }
    }
  }
  /**
   * BFS로 fromSnapshotId → toSnapshotId 경로를 찾는다.
   * 등록된 migration edge를 순방향으로 탐색.
   * 경로가 없으면 null 반환.
   */
  _findMigrationPath(dimId, from, to) {
    const migMap = this.migrations.get(dimId);
    if (!migMap) return null;
    const queue = [[from]];
    const visited = /* @__PURE__ */ new Set([from]);
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      if (current === to) return path;
      for (const mig of migMap.values()) {
        if (mig.fromSnapshotId === current && !visited.has(mig.toSnapshotId)) {
          visited.add(mig.toSnapshotId);
          queue.push([...path, mig.toSnapshotId]);
        }
      }
    }
    return null;
  }
  /**
   * AddressConfig 유효성 검증.
   *
   * 1. 등록된 모든 indexId가 schemas에 매핑되어 있어야 한다.
   * 2. 등록된 모든 versionId가 versions에 매핑되어 있어야 한다.
   * 3. schemas/versions 매핑 값은 non-negative integer여야 한다.
   * 4. schemas 매핑 값은 unique해야 한다 (역매핑 충돌 방지).
   * 5. versions 매핑 값은 unique해야 한다.
   * 6. sharding이 있으면 chars/numShards 유효성을 검증한다.
   */
  _validateAddressConfig(config2, indicesMap, versionsMap) {
    for (const indexId of indicesMap.keys()) {
      if (config2.schemas[indexId] === void 0) {
        throw new ValidationError(
          `Address config: indexId "${indexId}" not mapped in schemas`
        );
      }
    }
    for (const [indexId, vMap] of versionsMap) {
      for (const versionId of vMap.keys()) {
        if (config2.versions[versionId] === void 0) {
          throw new ValidationError(
            `Address config: versionId "${versionId}" (index "${indexId}") not mapped in versions`
          );
        }
      }
    }
    for (const [name, num] of Object.entries(config2.schemas)) {
      if (typeof num !== "number" || !Number.isInteger(num) || num < 0) {
        throw new ValidationError(
          `Address config schemas["${name}"]: must be a non-negative integer, got ${JSON.stringify(num)}`
        );
      }
    }
    for (const [name, num] of Object.entries(config2.versions)) {
      if (typeof num !== "number" || !Number.isInteger(num) || num < 0) {
        throw new ValidationError(
          `Address config versions["${name}"]: must be a non-negative integer, got ${JSON.stringify(num)}`
        );
      }
    }
    const schemaNums = /* @__PURE__ */ new Map();
    for (const [name, num] of Object.entries(config2.schemas)) {
      const existing = schemaNums.get(num);
      if (existing !== void 0) {
        throw new ValidationError(
          `Address config: duplicate schema number ${num} for "${name}" and "${existing}"`
        );
      }
      schemaNums.set(num, name);
    }
    const versionNums = /* @__PURE__ */ new Map();
    for (const [name, num] of Object.entries(config2.versions)) {
      const existing = versionNums.get(num);
      if (existing !== void 0) {
        throw new ValidationError(
          `Address config: duplicate version number ${num} for "${name}" and "${existing}"`
        );
      }
      versionNums.set(num, name);
    }
    if (config2.sharding !== void 0) {
      const { chars, numShards } = config2.sharding;
      if (!Number.isInteger(chars) || chars <= 0) {
        throw new ValidationError(
          `Address config sharding.chars: must be a positive integer, got ${JSON.stringify(chars)}`
        );
      }
      if (!Number.isInteger(numShards) || numShards < 1) {
        throw new ValidationError(
          `Address config sharding.numShards: must be a positive integer, got ${JSON.stringify(numShards)}`
        );
      }
      const shardCapacity = 16 ** chars;
      if (numShards > shardCapacity) {
        throw new ValidationError(
          `Address config sharding.numShards(${numShards}) exceeds chars(${chars}) capacity (max ${shardCapacity})`
        );
      }
    }
  }
};

// src/registry.ts
var registry = new MetaRegistry({
  dims: {
    env: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["dev", "stage", "prod", "test", "local"] }
      }
    },
    region: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["asia", "usa"] }
      }
    },
    svc_name: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"] }
      }
    },
    namespace: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["shop", "cms"] }
      }
    },
    // Permission dims
    perm_svc: {
      kind: { type: "index_ref", indexId: "service" },
      snapshots: {
        v1: {
          // entries = service index values for prod/asia services
          // prod/asia/shopping-web/shop=40, prod/asia/shopping-web/cms=41, ...
          entries: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
          entryRefs: {
            1: { indexId: "service", versionId: "v1" },
            2: { indexId: "service", versionId: "v1" },
            3: { indexId: "service", versionId: "v1" },
            4: { indexId: "service", versionId: "v1" },
            5: { indexId: "service", versionId: "v1" },
            6: { indexId: "service", versionId: "v1" },
            7: { indexId: "service", versionId: "v1" },
            8: { indexId: "service", versionId: "v1" },
            9: { indexId: "service", versionId: "v1" },
            10: { indexId: "service", versionId: "v1" }
          }
        }
      }
    },
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "developer", "operator", "viewer", "readonly"] },
        v2: { entries: ["admin", "developer", "operator", "customer", "viewer", "readonly"] }
      }
    },
    // Event dims
    event_svc: {
      kind: { type: "index_ref", indexId: "service" },
      snapshots: {
        v1: {
          // dev/asia/shop services + prod/asia/shop services
          entries: [0, 2, 4, 6, 8, 40, 42, 44, 46, 48],
          entryRefs: {
            1: { indexId: "service", versionId: "v1" },
            2: { indexId: "service", versionId: "v1" },
            3: { indexId: "service", versionId: "v1" },
            4: { indexId: "service", versionId: "v1" },
            5: { indexId: "service", versionId: "v1" },
            6: { indexId: "service", versionId: "v1" },
            7: { indexId: "service", versionId: "v1" },
            8: { indexId: "service", versionId: "v1" },
            9: { indexId: "service", versionId: "v1" },
            10: { indexId: "service", versionId: "v1" }
          }
        }
      }
    },
    event_name: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: {
          entries: [
            "user.login",
            "user.logout",
            "order.created",
            "order.paid",
            "payment.failed",
            "session.expired",
            "config.changed"
          ]
        },
        v2: {
          entries: [
            "user.login",
            "user.logout",
            "order.created",
            "order.paid",
            "payment.failed",
            "session.expired",
            "config.changed",
            "payment.cancel_requested",
            "payment.cancel_approved"
          ]
        }
      }
    },
    initiator: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["web", "mobile"] }
      }
    }
  },
  indices: {
    service: {
      dims: ["env", "region", "svc_name", "namespace"],
      versions: {
        v1: {
          snapshots: {
            env: "v1",
            region: "v1",
            svc_name: "v1",
            namespace: "v1"
          }
        }
      }
    },
    permission: {
      dims: ["perm_svc", "role"],
      versions: {
        v1: {
          snapshots: {
            perm_svc: "v1",
            role: "v1"
          }
        },
        v2: {
          snapshots: {
            perm_svc: "v1",
            role: "v2"
          }
        }
      }
    },
    event: {
      dims: ["event_svc", "event_name", "initiator"],
      versions: {
        v1: {
          snapshots: {
            event_svc: "v1",
            event_name: "v1",
            initiator: "v1"
          }
        },
        v2: {
          snapshots: {
            event_svc: "v1",
            event_name: "v2",
            initiator: "v1"
          }
        }
      }
    }
  }
});
var svcCodec = registry.createCodec("service", "v1");
var permCodec = registry.createCodec("permission", "v1");
var evtCodec = registry.createCodec("event", "v1");
var permCodecV2 = registry.createCodec("permission", "v2");
var evtCodecV2 = registry.createCodec("event", "v2");
var ENV_KO = {
  dev: "\uAC1C\uBC1C",
  stage: "\uC2A4\uD14C\uC774\uC9C0",
  prod: "\uC6B4\uC601",
  test: "\uD14C\uC2A4\uD2B8",
  local: "\uB85C\uCEEC"
};
var REGION_KO = {
  asia: "\uC544\uC2DC\uC544",
  usa: "\uBBF8\uAD6D"
};
var SVC_NAME_KO = {
  "shopping-web": "\uC1FC\uD551 \uC6F9",
  "shopping-backend": "\uC1FC\uD551 \uBC31\uC5D4\uB4DC",
  auth: "\uC778\uC99D",
  payment: "\uACB0\uC81C",
  gateway: "\uAC8C\uC774\uD2B8\uC6E8\uC774"
};
var NS_KO = {
  shop: "\uC1FC\uD551\uBAB0",
  cms: "CMS"
};
var ROLE_KO = {
  admin: "\uAD00\uB9AC\uC790",
  developer: "\uAC1C\uBC1C\uC790",
  operator: "\uC6B4\uC601\uC790",
  customer: "\uACE0\uAC1D",
  viewer: "\uBDF0\uC5B4",
  readonly: "\uC77D\uAE30\uC804\uC6A9"
};
var EVT_KO = {
  "user.login": "\uB85C\uADF8\uC778",
  "user.logout": "\uB85C\uADF8\uC544\uC6C3",
  "order.created": "\uC8FC\uBB38 \uC0DD\uC131",
  "order.paid": "\uC8FC\uBB38 \uACB0\uC81C",
  "payment.failed": "\uACB0\uC81C \uC2E4\uD328",
  "session.expired": "\uC138\uC158 \uB9CC\uB8CC",
  "config.changed": "\uC124\uC815 \uBCC0\uACBD",
  "payment.cancel_requested": "\uCDE8\uC18C \uC694\uCCAD",
  "payment.cancel_approved": "\uCDE8\uC18C \uC2B9\uC778"
};
var ENVS = ["dev", "stage", "prod", "test", "local"];
var REGIONS = ["asia", "usa"];
var SVCS = ["shopping-web", "shopping-backend", "auth", "payment", "gateway"];
var NSS = ["shop", "cms"];
var ROLES = ["admin", "developer", "operator", "customer", "viewer", "readonly"];
var EVENTS = [
  "user.login",
  "user.logout",
  "order.created",
  "order.paid",
  "payment.failed",
  "session.expired",
  "config.changed",
  "payment.cancel_requested",
  "payment.cancel_approved"
];
var INITIATORS = ["web", "mobile"];
var PERM_SVC_VALUES = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49];
var EVT_SVC_VALUES = [0, 2, 4, 6, 8, 40, 42, 44, 46, 48];

// src/index.ts
var ALL_SVC_DIMS = ["env", "region", "svc_name", "namespace"];
var DIM_ENTRIES = {
  env: ENVS,
  region: REGIONS,
  svc_name: SVCS,
  namespace: NSS
};
var DIM_KO_FNS = {
  env: /* @__PURE__ */ __name((v) => ENV_KO[v] ?? v, "env"),
  region: /* @__PURE__ */ __name((v) => REGION_KO[v] ?? v, "region"),
  svc_name: /* @__PURE__ */ __name((v) => SVC_NAME_KO[v] ?? v, "svc_name"),
  namespace: /* @__PURE__ */ __name((v) => NS_KO[v] ?? v, "namespace")
};
var SVC_WEIGHTS = [20, 10, 2, 1];
function computeSvcValue(envIdx, regionIdx, svcIdx, nsIdx) {
  return (envIdx - 1) * SVC_WEIGHTS[0] + (regionIdx - 1) * SVC_WEIGHTS[1] + (svcIdx - 1) * SVC_WEIGHTS[2] + (nsIdx - 1) * SVC_WEIGHTS[3];
}
__name(computeSvcValue, "computeSvcValue");
function decodeSvcValue(value) {
  const decoded = svcCodec.decodeValue(value);
  return {
    env: String(decoded["env"]),
    region: String(decoded["region"]),
    svc_name: String(decoded["svc_name"]),
    namespace: String(decoded["namespace"])
  };
}
__name(decodeSvcValue, "decodeSvcValue");
var app = new Hono2();
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type"],
  allowMethods: ["GET", "POST", "PATCH", "OPTIONS"]
}));
app.get("/api/health", (c) => c.json({ ok: true }));
app.get("/api/service/cells", (c) => {
  try {
    const xDim = c.req.query("xDim");
    const yDim = c.req.query("yDim");
    if (!xDim || !ALL_SVC_DIMS.includes(xDim)) {
      return c.json({ error: "Invalid or missing xDim" }, 400);
    }
    if (!yDim || !ALL_SVC_DIMS.includes(yDim)) {
      return c.json({ error: "Invalid or missing yDim" }, 400);
    }
    if (xDim === yDim) {
      return c.json({ error: "xDim and yDim must be different" }, 400);
    }
    const fixedDims = ALL_SVC_DIMS.filter((d) => d !== xDim && d !== yDim);
    const fixed = { env: 1, region: 1, svc_name: 1, namespace: 1 };
    for (const dim of fixedDims) {
      const raw2 = c.req.query(`fix_${dim}`);
      if (raw2 !== void 0) {
        const pos = parseInt(raw2, 10);
        if (!isNaN(pos) && pos >= 1 && pos <= DIM_ENTRIES[dim].length) {
          fixed[dim] = pos;
        }
      }
    }
    const xEntries = DIM_ENTRIES[xDim];
    const yEntries = DIM_ENTRIES[yDim];
    const xLabels = xEntries.map((id, i) => ({
      id,
      ko: DIM_KO_FNS[xDim](id),
      pos: i + 1
    }));
    const yLabels = yEntries.map((id, i) => ({
      id,
      ko: DIM_KO_FNS[yDim](id),
      pos: i + 1
    }));
    const fixedInfo = {};
    for (const dim of fixedDims) {
      const pos = fixed[dim];
      const id = DIM_ENTRIES[dim][pos - 1];
      fixedInfo[dim] = { id, ko: DIM_KO_FNS[dim](id), pos };
    }
    const cells = [];
    for (let yi = 0; yi < yEntries.length; yi++) {
      for (let xi = 0; xi < xEntries.length; xi++) {
        const indices = { ...fixed };
        indices[xDim] = xi + 1;
        indices[yDim] = yi + 1;
        const value = computeSvcValue(
          indices.env,
          indices.region,
          indices.svc_name,
          indices.namespace
        );
        cells.push({ xPos: xi + 1, yPos: yi + 1, value });
      }
    }
    return c.json({ xDim, yDim, xLabels, yLabels, fixed: fixedInfo, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.get("/api/service/decode/:value", (c) => {
  try {
    const raw2 = c.req.param("value");
    const value = parseInt(raw2, 10);
    if (isNaN(value)) return c.json({ error: "Invalid value" }, 400);
    const { env: env2, region, svc_name, namespace } = decodeSvcValue(value);
    return c.json({
      env: env2,
      region,
      svc_name,
      namespace,
      envKo: ENV_KO[env2] ?? env2,
      regionKo: REGION_KO[region] ?? region,
      svcNameKo: SVC_NAME_KO[svc_name] ?? svc_name,
      namespaceKo: NS_KO[namespace] ?? namespace
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});
app.get("/api/permission/cells", (c) => {
  try {
    const svcLabels = PERM_SVC_VALUES.map((svcValue, si) => {
      const { env: env2, region, svc_name, namespace } = decodeSvcValue(svcValue);
      return {
        pos: si + 1,
        svcValue,
        svcName: SVC_NAME_KO[svc_name] ?? svc_name,
        env: env2,
        region,
        namespace
      };
    });
    const roleLabels = ROLES.map((role, ri) => ({
      pos: ri + 1,
      id: role,
      ko: ROLE_KO[role] ?? role
    }));
    const cells = [];
    for (let si = 0; si < PERM_SVC_VALUES.length; si++) {
      for (let ri = 0; ri < ROLES.length; ri++) {
        cells.push({ svcPos: si + 1, rolePos: ri + 1, value: si * 6 + ri });
      }
    }
    return c.json({ svcLabels, roleLabels, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.get("/api/permission/decode/:value", (c) => {
  try {
    const raw2 = c.req.param("value");
    const permValue = parseInt(raw2, 10);
    if (isNaN(permValue)) return c.json({ error: "Invalid value" }, 400);
    const decoded = permCodecV2.decodeValue(permValue);
    const permSvc = Number(decoded["perm_svc"]);
    const role = String(decoded["role"]);
    const svc = decodeSvcValue(permSvc);
    return c.json({
      permValue,
      perm_svc: permSvc,
      role,
      svc,
      address: `permission:v2:${permValue}`
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});
app.get("/api/event/cells", (c) => {
  try {
    const initiator = c.req.query("initiator") ?? "web";
    if (!INITIATORS.includes(initiator)) {
      return c.json({ error: "Invalid initiator" }, 400);
    }
    const initiatorPos = INITIATORS.indexOf(initiator) + 1;
    const svcLabels = EVT_SVC_VALUES.map((svcValue, si) => {
      const { env: env2, svc_name } = decodeSvcValue(svcValue);
      return {
        pos: si + 1,
        svcValue,
        svcName: SVC_NAME_KO[svc_name] ?? svc_name,
        env: env2
      };
    });
    const eventLabels = EVENTS.map((evt, ei) => ({
      pos: ei + 1,
      id: evt,
      ko: EVT_KO[evt] ?? evt
    }));
    const cells = [];
    for (let si = 0; si < EVT_SVC_VALUES.length; si++) {
      for (let ei = 0; ei < EVENTS.length; ei++) {
        const value = si * 18 + ei * 2 + (initiatorPos - 1);
        cells.push({ svcPos: si + 1, evtPos: ei + 1, value });
      }
    }
    return c.json({ initiator, svcLabels, eventLabels, cells });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.get("/api/event/decode/:value", (c) => {
  try {
    const raw2 = c.req.param("value");
    const evtValue = parseInt(raw2, 10);
    if (isNaN(evtValue)) return c.json({ error: "Invalid value" }, 400);
    const decoded = evtCodecV2.decodeValue(evtValue);
    const eventSvc = Number(decoded["event_svc"]);
    const eventName = String(decoded["event_name"]);
    const initiator = String(decoded["initiator"]);
    const svc = decodeSvcValue(eventSvc);
    return c.json({
      evtValue,
      event_svc: eventSvc,
      event_name: eventName,
      initiator,
      svc,
      address: `event:v2:${evtValue}`
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 400);
  }
});
var ROLE_POS = {
  admin: 1,
  developer: 2,
  operator: 3,
  customer: 4,
  viewer: 5,
  readonly: 6
};
var FEATURE_DEFS = [
  { id: "product_list", name: "\uC0C1\uD488 \uBAA9\uB85D \uC870\uD68C", svcName: "shopping-web", svcValue: 40, permSvcPos: 1, grantedRoles: ["admin", "developer", "operator", "customer", "viewer", "readonly"], successEventValue: 90, failEventValue: null },
  { id: "order_list", name: "\uC8FC\uBB38 \uBAA9\uB85D \uC870\uD68C", svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin", "developer", "operator", "viewer"], successEventValue: 112, failEventValue: null },
  { id: "payment_history", name: "\uACB0\uC81C \uB0B4\uC5ED \uC870\uD68C", svcName: "payment", svcValue: 46, permSvcPos: 7, grantedRoles: ["admin", "developer", "operator"], successEventValue: 150, failEventValue: 152 },
  { id: "payment_cancel_req", name: "\uACB0\uC81C \uCDE8\uC18C \uC694\uCCAD", svcName: "payment", svcValue: 46, permSvcPos: 7, grantedRoles: ["admin", "customer"], successEventValue: 158, failEventValue: 152 },
  { id: "payment_cancel_approve", name: "\uACB0\uC81C \uCDE8\uC18C \uC2B9\uC778", svcName: "payment", svcValue: 46, permSvcPos: 7, grantedRoles: ["admin", "operator"], successEventValue: 160, failEventValue: 152 },
  { id: "user_mgmt", name: "\uC0AC\uC6A9\uC790 \uAD00\uB9AC", svcName: "auth", svcValue: 44, permSvcPos: 5, grantedRoles: ["admin"], successEventValue: 138, failEventValue: 136 },
  { id: "config_change", name: "\uC124\uC815 \uBCC0\uACBD", svcName: "shopping-backend", svcValue: 42, permSvcPos: 3, grantedRoles: ["admin"], successEventValue: 120, failEventValue: 118 }
];
var ROLE_LIST = ["admin", "developer", "operator", "customer", "viewer", "readonly"];
var grantState = new Map(
  FEATURE_DEFS.map((f) => [f.id, new Set(f.grantedRoles)])
);
function isGranted(featureId, role) {
  return grantState.get(featureId)?.has(role) ?? false;
}
__name(isGranted, "isGranted");
function getGrantedRoles(featureId) {
  return [...grantState.get(featureId) ?? []];
}
__name(getGrantedRoles, "getGrantedRoles");
function getGrantedRolesKo(featureId) {
  return getGrantedRoles(featureId).map((r) => ROLE_KO[r] ?? r);
}
__name(getGrantedRolesKo, "getGrantedRolesKo");
app.get("/api/features", (c) => {
  try {
    const features2 = FEATURE_DEFS.map((f) => ({
      id: f.id,
      name: f.name,
      grantedRoles: getGrantedRoles(f.id),
      grantedRolesKo: getGrantedRolesKo(f.id)
    }));
    const roles = ROLE_LIST.map((r) => ({ id: r, ko: ROLE_KO[r] ?? r }));
    const matrix = FEATURE_DEFS.map(
      (f) => ROLE_LIST.map((r) => isGranted(f.id, r))
    );
    return c.json({ features: features2, roles, matrix });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.get("/api/scenario", (c) => {
  try {
    const roleParam = c.req.query("role") ?? "viewer";
    if (!(roleParam in ROLE_POS)) {
      return c.json({ error: `Invalid role: ${roleParam}. Must be one of: ${ROLE_LIST.join(", ")}` }, 400);
    }
    const role = roleParam;
    const roleKo = ROLE_KO[role] ?? role;
    const rolePos = ROLE_POS[role];
    const mainPermValue = (7 - 1) * 6 + (rolePos - 1);
    const mainPermAddr = `permission:v2:${mainPermValue}`;
    const features2 = FEATURE_DEFS.map((f) => {
      const permValue = (f.permSvcPos - 1) * 6 + (rolePos - 1);
      const hasAccess = isGranted(f.id, role);
      return {
        id: f.id,
        name: f.name,
        svcName: f.svcName,
        svcAddr: `service:v1:${f.svcValue}`,
        hasAccess,
        permAddr: `permission:v2:${permValue}`,
        permValue,
        grantedRoles: getGrantedRoles(f.id),
        grantedRolesKo: getGrantedRolesKo(f.id)
      };
    });
    const simulation = FEATURE_DEFS.map((f, idx) => {
      const permValue = (f.permSvcPos - 1) * 6 + (rolePos - 1);
      const hasAccess = isGranted(f.id, role);
      const permAddr = `permission:v2:${permValue}`;
      const grantedAddrs = getGrantedRoles(f.id).map((r) => `permission:v2:${(f.permSvcPos - 1) * 6 + ((ROLE_POS[r] ?? 1) - 1)}`);
      const deniedReason = hasAccess ? `\uBD80\uC5EC\uB428` : `\uBBF8\uBD80\uC5EC \u2014 \uD5C8\uC6A9: [${grantedAddrs.join(", ")}]`;
      const svcDecoded = decodeSvcValue(f.svcValue);
      const svcNameKo = SVC_NAME_KO[svcDecoded.svc_name] ?? svcDecoded.svc_name;
      const permStep = {
        addr: permAddr,
        value: permValue,
        status: hasAccess ? "ok" : "denied",
        svcName: f.svcName,
        svcNameKo,
        roleName: role,
        roleNameKo: roleKo,
        grantedAddrs,
        deniedReason
      };
      let eventStep = null;
      const evtValue = hasAccess ? f.successEventValue : f.failEventValue;
      if (evtValue !== null) {
        const evtRaw = evtCodecV2.decodeValue(evtValue);
        const evtSvcValue = Number(evtRaw["event_svc"]);
        const evtName = String(evtRaw["event_name"]);
        const evtInit = String(evtRaw["initiator"]);
        const evtSvcDecoded = decodeSvcValue(evtSvcValue);
        eventStep = {
          addr: `event:v1:${evtValue}`,
          value: evtValue,
          status: hasAccess ? "ok" : "denied",
          svcName: evtSvcDecoded.svc_name,
          svcNameKo: SVC_NAME_KO[evtSvcDecoded.svc_name] ?? evtSvcDecoded.svc_name,
          eventName: evtName,
          eventNameKo: EVT_KO[evtName] ?? evtName,
          initiator: evtInit
        };
      }
      return {
        featureNum: idx + 1,
        featureId: f.id,
        featureName: f.name,
        hasAccess,
        perm: permStep,
        event: eventStep
      };
    });
    return c.json({
      role,
      roleKo,
      user: {
        name: "\uD64D\uAE38\uB3D9",
        role,
        roleKo,
        mainPermAddr,
        mainPermValue
      },
      features: features2,
      simulation
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.get("/api/grant-table", (c) => {
  try {
    const rows = FEATURE_DEFS.map(
      (f) => ROLE_LIST.map((role) => {
        const rolePos = ROLE_POS[role];
        const permValue = (f.permSvcPos - 1) * 6 + (rolePos - 1);
        const granted = isGranted(f.id, role);
        const svcValue = PERM_SVC_VALUES[f.permSvcPos - 1];
        const svcInfo = decodeSvcValue(svcValue);
        const evtValue = granted ? f.successEventValue : f.failEventValue;
        let eventAddr = null;
        let eventValue = null;
        let eventNameKo = null;
        const eventType = evtValue !== null ? granted ? "success" : "fail" : "none";
        if (evtValue !== null) {
          const evtRaw = evtCodecV2.decodeValue(evtValue);
          eventAddr = `event:v1:${evtValue}`;
          eventValue = evtValue;
          eventNameKo = EVT_KO[String(evtRaw["event_name"])] ?? String(evtRaw["event_name"]);
        }
        return {
          featureId: f.id,
          featureName: f.name,
          permAddr: `permission:v2:${permValue}`,
          permValue,
          svcValue,
          svcNameKo: SVC_NAME_KO[svcInfo.svc_name] ?? svcInfo.svc_name,
          env: svcInfo.env,
          envKo: ENV_KO[svcInfo.env] ?? svcInfo.env,
          region: svcInfo.region,
          regionKo: REGION_KO[svcInfo.region] ?? svcInfo.region,
          namespace: svcInfo.namespace,
          namespaceKo: NS_KO[svcInfo.namespace] ?? svcInfo.namespace,
          role,
          roleKo: ROLE_KO[role] ?? role,
          granted,
          grantedRoles: getGrantedRoles(f.id),
          grantedRolesKo: getGrantedRolesKo(f.id),
          eventAddr,
          eventValue,
          eventNameKo,
          eventType
        };
      })
    ).flat();
    return c.json({ rows });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.patch("/api/grants", async (c) => {
  try {
    const body = await c.req.json();
    const { featureId, role, granted } = body;
    if (!grantState.has(featureId)) return c.json({ error: "Unknown featureId" }, 400);
    if (!ROLE_LIST.includes(role)) return c.json({ error: "Unknown role" }, 400);
    if (granted) {
      grantState.get(featureId).add(role);
    } else {
      grantState.get(featureId).delete(role);
    }
    return c.json({
      featureId,
      grantedRoles: getGrantedRoles(featureId),
      grantedRolesKo: getGrantedRolesKo(featureId)
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.patch("/api/grants/batch", async (c) => {
  try {
    const body = await c.req.json();
    for (const change of body.changes) {
      const { featureId, role, granted } = change;
      if (!grantState.has(featureId) || !ROLE_LIST.includes(role)) continue;
      if (granted) {
        grantState.get(featureId).add(role);
      } else {
        grantState.get(featureId).delete(role);
      }
    }
    const result = {};
    for (const f of FEATURE_DEFS) {
      result[f.id] = getGrantedRoles(f.id);
    }
    return c.json({ grants: result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
app.post("/api/grants/reset", (c) => {
  for (const f of FEATURE_DEFS) {
    grantState.set(f.id, new Set(f.grantedRoles));
  }
  return c.json({ ok: true });
});
var src_default = app;

// ../../node_modules/.pnpm/wrangler@4.73.0_@cloudflare+workers-types@4.20260313.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@4.73.0_@cloudflare+workers-types@4.20260313.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-KUfP6a/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/.pnpm/wrangler@4.73.0_@cloudflare+workers-types@4.20260313.1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-KUfP6a/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
