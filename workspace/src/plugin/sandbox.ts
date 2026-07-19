import vm from 'vm';
import { Plugin, PluginContext } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('plugin-sandbox');

export class PluginSandbox {
  static validateSyntax(code: string): { valid: boolean; error?: string } {
    try {
      new vm.Script(code);
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  static validatePluginCode(code: string): { valid: boolean; error?: string } {
    const result = PluginSandbox.validateSyntax(code);
    if (!result.valid) {
      return result;
    }

    if (!code.includes('module.exports')) {
      return { valid: false, error: 'Plugin must export using module.exports' };
    }

    if (!code.includes('manifest')) {
      return { valid: false, error: 'Plugin must export a manifest object' };
    }

    return { valid: true };
  }

  static loadPlugin(code: string, ctx: PluginContext): Plugin | null {
    const validation = PluginSandbox.validatePluginCode(code);
    if (!validation.valid) {
      logger.error(`Plugin validation failed: ${validation.error}`);
      return null;
    }

    try {
      const sandbox = {
        module: { exports: {} as any },
        exports: {} as any,
        require,
        process: {
          cwd: () => process.cwd(),
          env: {},
        },
        __dirname: process.cwd(),
        __filename: '',
        console: {
          log: (...args: any[]) => ctx.logger.info(args.join(' ')),
          warn: (...args: any[]) => ctx.logger.warn(args.join(' ')),
          error: (...args: any[]) => ctx.logger.error(args.join(' ')),
        },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Promise,
        JSON,
        Buffer,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Date,
        Math,
        RegExp,
        Error,
        Map,
        Set,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
      };

      const script = new vm.Script(code);
      const context = vm.createContext(sandbox);
      script.runInContext(context);

      const plugin = sandbox.module.exports as Plugin;

      if (!plugin || !plugin.manifest) {
        logger.error('Plugin did not export a valid manifest');
        return null;
      }

      if (!plugin.manifest.id || !plugin.manifest.name) {
        logger.error('Plugin manifest missing required fields (id, name)');
        return null;
      }

      logger.info(`Plugin validated: ${plugin.manifest.name} v${plugin.manifest.version}`);
      return plugin;
    } catch (err: any) {
      logger.error(`Plugin load failed: ${err.message}`);
      return null;
    }
  }
}
