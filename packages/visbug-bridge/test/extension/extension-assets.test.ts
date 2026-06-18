import { test, expect, chromium } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const extensionPath = resolve(__dirname, '../../../../vendor/projectvisbug/extension')
const tutorialGifs = [
  'guides',
  'inspector',
  'accessibility',
  'position',
  'margin',
  'align',
  'move',
  'padding',
  'hueshift',
  'boxshadow',
  'font',
  'text',
  'search',
]

test('unpacked extension serves tutorial gif assets', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'visbug-ext-'))
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })

  try {
    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent('serviceworker')
    const extensionBaseURL = worker.url().replace(/\/[^/]*$/, '')

    expect(extensionBaseURL).toMatch(/^chrome-extension:\/\//)

    const page = await context.newPage()
    for (const name of tutorialGifs) {
      const response = await page.goto(`${extensionBaseURL}/tuts/${name}.gif`, { waitUntil: 'commit' })
      expect(response?.status(), `${name}.gif should be served by the extension`).toBe(200)
    }
  } finally {
    await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
})
