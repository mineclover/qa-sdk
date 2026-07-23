import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

let appProcess;
let shuttingDown = false;
let compileSucceeded = false;
let restartQueue = Promise.resolve();

const compiler = spawn('tsc', ['--watch', '--preserveWatchOutput'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

function stopApp() {
  if (!appProcess) return Promise.resolve();

  const processToStop = appProcess;
  appProcess = undefined;
  processToStop.__stoppedForCompile = true;

  return new Promise((resolve) => {
    processToStop.once('exit', resolve);
    processToStop.kill('SIGTERM');
  });
}

function queueAppRestart() {
  restartQueue = restartQueue.then(async () => {
    await stopApp();
    if (shuttingDown || !compileSucceeded || appProcess) return;

    const child = spawn('node', ['dist/main.js'], { stdio: 'inherit' });
    appProcess = child;
    child.on('exit', (code, signal) => {
      if (appProcess === child) appProcess = undefined;

      if (!shuttingDown && !child.__stoppedForCompile && code !== 0) {
        process.exit(code ?? (signal ? 1 : 0));
      }
    });
  });
}

const output = createInterface({ input: compiler.stdout });
output.on('line', (line) => {
  process.stdout.write(`${line}\n`);

  if (line.includes('Starting incremental compilation')) {
    compileSucceeded = false;
    restartQueue = restartQueue.then(() => stopApp());
  }

  if (line.includes('Found 0 errors. Watching for file changes.')) {
    compileSucceeded = true;
    queueAppRestart();
  }
});

compiler.stderr.pipe(process.stderr);

compiler.on('exit', (code) => {
  if (!shuttingDown) process.exit(code ?? 1);
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  output.close();
  appProcess?.kill(signal);
  compiler.kill(signal);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
