import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeWorkspaceArgs,
  resolveAdapterCli,
  resolveSpecPlatformRoot,
} from './run-spec-platform-workspace.mjs';

test('resolves the sibling spec-management-platform workspace by default', () => {
  assert.equal(
    resolveSpecPlatformRoot('/workspace/qa-sdk', {}),
    '/workspace/spec-management-platform',
  );
});

test('allows an explicit platform workspace root and keeps the adapter boundary stable', () => {
  const root = resolveSpecPlatformRoot('/workspace/qa-sdk', {
    SPEC_PLATFORM_ROOT: '/opt/spec-management-platform',
  });
  assert.equal(root, '/opt/spec-management-platform');
  assert.equal(
    resolveAdapterCli(root),
    '/opt/spec-management-platform/harnesses/qa-sdk/adapter/dist/cli.js',
  );
});

test("strips pnpm's command separator before forwarding CLI arguments", () => {
  assert.deepEqual(normalizeWorkspaceArgs(['--', 'def', 'validate']), ['def', 'validate']);
  assert.deepEqual(normalizeWorkspaceArgs(['def', 'validate']), ['def', 'validate']);
});
