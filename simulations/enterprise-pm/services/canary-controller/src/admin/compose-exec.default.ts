// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 — ComposeExec 기본 구현. spawn-based + 5s timeout.
// production 환경에서 AdminModule 이 본 기본 구현을 inject 한다. test 는 mock.

import { spawn } from 'node:child_process';
import type { ComposeExec } from './compose-proxy.controller.js';

const TIMEOUT_MS = 5_000;

export const dockerComposeExec: ComposeExec = (argv) =>
  new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const p = spawn('docker', argv, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: ctrl.signal,
    });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (b) => {
      stdout += String(b);
    });
    p.stderr.on('data', (b) => {
      stderr += String(b);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`docker exited ${code}: ${stderr}`));
    });
    p.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
