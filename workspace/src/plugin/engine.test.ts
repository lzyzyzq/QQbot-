import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus } from '../core/event-bus'
import { PluginEngine } from './engine'
import { PluginSandbox } from './sandbox'
import { initDb, closeDb, getDb } from '../db/index'
import { v4 as uuidv4 } from 'uuid'

const VALID_PLUGIN_CODE = `
module.exports = {
  manifest: {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'tester'
  },
  onLoad: function(ctx) {
    ctx.logger.info('Plugin loaded');
  },
  onEnable: function(ctx) {
    ctx.logger.info('Plugin enabled');
  },
  onDisable: function(ctx) {
    ctx.logger.info('Plugin disabled');
  },
  onUnload: function(ctx) {
    ctx.logger.info('Plugin unloaded');
  }
};
`

describe('PluginSandbox', () => {
  it('should validate correct syntax', () => {
    const result = PluginSandbox.validateSyntax('var x = 1;')
    expect(result.valid).toBe(true)
  })

  it('should reject invalid syntax', () => {
    const result = PluginSandbox.validateSyntax('var x = ;')
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should validate plugin code format', () => {
    const result = PluginSandbox.validatePluginCode(VALID_PLUGIN_CODE)
    expect(result.valid).toBe(true)
  })

  it('should reject code without module.exports', () => {
    const result = PluginSandbox.validatePluginCode('var x = 1;')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('module.exports')
  })

  it('should reject code without manifest', () => {
    const result = PluginSandbox.validatePluginCode('module.exports = {};')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('manifest')
  })

  it('should load a valid plugin', () => {
    const ctx = {
      bot: {} as any,
      eventBus: new EventBus(),
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      storage: { get: () => null, set: () => {}, delete: () => {} },
      config: {},
    }

    const plugin = PluginSandbox.loadPlugin(VALID_PLUGIN_CODE, ctx)
    expect(plugin).not.toBeNull()
    expect(plugin!.manifest.name).toBe('Test Plugin')
  })
})

describe('PluginEngine', () => {
  let engine: PluginEngine
  let eventBus: EventBus
  const testDir = '/tmp/plugin-test-' + uuidv4()

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    initDb()
    eventBus = new EventBus()
    engine = new PluginEngine(eventBus, {} as any, testDir)
  })

  afterEach(() => {
    engine.shutdown().catch(() => {})
    closeDb()
  })

  it('should load a plugin from code', async () => {
    const info = await engine.loadFromCode('test-1', 'Test Plugin', VALID_PLUGIN_CODE)
    expect(info.name).toBe('Test Plugin')
    expect(info.loaded).toBe(true)
    expect(info.enabled).toBe(false)
  })

  it('should list plugins', async () => {
    await engine.loadFromCode('test-list', 'List Test', VALID_PLUGIN_CODE)
    const list = engine.list()
    expect(list.length).toBeGreaterThan(0)
    expect(list.some((p) => p.id === 'test-list')).toBe(true)
  })

  it('should enable and disable a plugin', async () => {
    await engine.loadFromCode('test-toggle', 'Toggle Test', VALID_PLUGIN_CODE)
    await engine.enable('test-toggle')
    expect(engine.isEnabled('test-toggle')).toBe(true)

    await engine.disable('test-toggle')
    expect(engine.isEnabled('test-toggle')).toBe(false)
  })

  it('should reload a plugin', async () => {
    await engine.loadFromCode('test-reload', 'Reload Test', VALID_PLUGIN_CODE)
    await engine.reload('test-reload')
    expect(engine.list().some((p) => p.id === 'test-reload')).toBe(true)
  })

  it('should delete a plugin', async () => {
    await engine.loadFromCode('test-delete', 'Delete Test', VALID_PLUGIN_CODE)
    await engine.deletePlugin('test-delete')
    expect(engine.list().some((p) => p.id === 'test-delete')).toBe(false)
  })

  it('should toggle plugin enabled state', async () => {
    await engine.loadFromCode('test-toggle2', 'Toggle2', VALID_PLUGIN_CODE)
    const result1 = await engine.toggleEnabled('test-toggle2')
    expect(result1).toBe(true)
    expect(engine.isEnabled('test-toggle2')).toBe(true)

    const result2 = await engine.toggleEnabled('test-toggle2')
    expect(result2).toBe(false)
    expect(engine.isEnabled('test-toggle2')).toBe(false)
  })

  it('should throw when enabling non-loaded plugin', async () => {
    await expect(engine.enable('nonexistent')).rejects.toThrow()
  })

  it('should throw when loading invalid plugin', async () => {
    await expect(engine.loadFromCode('test-invalid', 'Invalid', 'invalid code')).rejects.toThrow()
  })
})
