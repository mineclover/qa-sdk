import { describe, it, expect, vi } from 'vitest'
import { createDomRefSymbolResolver } from '../src/coordinate-symbols.js'

describe('createDomRefSymbolResolver', () => {
  it('converts rlsc locateElement result into an rlsc DomRef symbol', () => {
    const button = document.createElement('button')
    const locateElement = vi.fn(() => ({ address: 'button:v1:42' }))
    const resolve = createDomRefSymbolResolver({ rlsc: { locateElement } })

    expect(resolve(button)).toEqual([
      {
        kind: 'rlsc',
        value: 'button:v1:42',
        matchCount: 1,
        stability: 90,
        provenance: 'rlsc.locateElement:address',
      },
    ])
    expect(locateElement).toHaveBeenCalledWith(button)
  })

  it('supports qa coordinate locators alongside rlsc', () => {
    const section = document.createElement('section')
    const resolve = createDomRefSymbolResolver({
      rlsc: { locateElement: () => 'rlsc-node:hero' },
      qaCoord: { locateElement: () => ({ id: 'qa:hero:1' }) },
    })

    expect(resolve(section)).toEqual([
      expect.objectContaining({ kind: 'rlsc', value: 'rlsc-node:hero' }),
      expect.objectContaining({ kind: 'qa-coord', value: 'qa:hero:1' }),
    ])
  })

  it('drops null locator results and locator errors', () => {
    const div = document.createElement('div')
    const resolve = createDomRefSymbolResolver({
      rlsc: { locateElement: () => null },
      qaCoord: { locateElement: () => { throw new Error('boom') } },
    })

    expect(resolve(div)).toEqual([])
  })
})
