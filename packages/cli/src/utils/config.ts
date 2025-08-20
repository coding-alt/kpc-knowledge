import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '@kpc/shared';

const logger = createLogger('ConfigUtils');

export interface KPCConfig {
  framework: 'react' | 'vue' | 'intact';
  typescript: boolean;
  componentsDir: string;
  outputDir: string;
  features: string[];
  api: {
    endpoint: string;
    timeout: number;
    apiKey?: string;
  };
  generation: {
    includeTests: boolean;
    includeStories: boolean;
    includeTypes: boolean;
    autoImports: boolean;
    codeStyle: 'standard' | 'prettier' | 'custom';
  };
  validation: {
    eslint: boolean;
    typescript: boolean;
    accessibility: boolean;
    performance: boolean;
  };
  testing: {
    unit: boolean;
    integration: boolean;
    visual: boolean;
    e2e: boolean;
    coverage: boolean;
  };
  preview: {
    port: number;
    host: string;
    hotReload: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

export const DEFAULT_CONFIG: KPCConfig = {
  framework: 'react',
  typescript: true,
  componentsDir: './src/components',
  outputDir: './src/generated',
  features: [],
  api: {
    endpoint: 'http://localhost:4000/graphql',
    timeout: 30000,
  },
  generation: {
    includeTests: true,
    includeStories: false,
    includeTypes: true,
    autoImports: false,
    codeStyle: 'prettier',
  },
  validation: {
    eslint: true,
    typescript: true,
    accessibility: false,
    performance: false,
  },
  testing: {
    unit: true,
    integration: false,
    visual: false,
    e2e: false,
    coverage: false,
  },
  preview: {
    port: 3000,
    host: 'localhost',
    hotReload: true,
    theme: 'light',
  },
};

export class ConfigManager {
  private configPath: string;
  private config: KPCConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || this.findConfigFile();
  }

  private findConfigFile(): string {
    const possiblePaths = [
      '.kpc.config.js',
      '.kpc.config.json',
      'kpc.config.js',
      'kpc.config.json',
      '.kpcrc',
      '.kpcrc.json',
    ];

    for (const configFile of possiblePaths) {
      if (fs.existsSync(configFile)) {
        return configFile;
      }
    }

    return '.kpc.config.js'; // Default path
  }

  load(): KPCConfig {
    if (this.config) {
      return this.config;
    }

    try {
      if (fs.existsSync(this.configPath)) {
        if (this.configPath.endsWith('.js')) {
          // Clear require cache to get fresh config
          delete require.cache[path.resolve(this.configPath)];
          this.config = require(path.resolve(this.configPath));
        } else {
          const configContent = fs.readFileSync(this.configPath, 'utf8');
          this.config = JSON.parse(configContent);
        }

        // Merge with defaults
        this.config = this.mergeWithDefaults(this.config);
        
        logger.info(`Loaded config from ${this.configPath}`);
      } else {
        logger.info('No config file found, using defaults');
        this.config = { ...DEFAULT_CONFIG };
      }
    } catch (error) {
      logger.error('Failed to load config:', error);
      this.config = { ...DEFAULT_CONFIG };
    }

    return this.config;
  }

  save(config: Partial<KPCConfig>): void {
    try {
      const currentConfig = this.load();
      const newConfig = { ...currentConfig, ...config };

      if (this.configPath.endsWith('.js')) {
        const configContent = `module.exports = ${JSON.stringify(newConfig, null, 2)};`;
        fs.writeFileSync(this.configPath, configContent);
      } else {
        fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2));
      }

      this.config = newConfig;
      logger.info(`Config saved to ${this.configPath}`);
    } catch (error) {
      logger.error('Failed to save config:', error);
      throw error;
    }
  }

  update(updates: Partial<KPCConfig>): void {
    const currentConfig = this.load();
    const newConfig = this.deepMerge(currentConfig, updates);
    this.save(newConfig);
  }

  get(key?: keyof KPCConfig): any {
    const config = this.load();
    return key ? config[key] : config;
  }

  set(key: keyof KPCConfig, value: any): void {
    const updates = { [key]: value } as Partial<KPCConfig>;
    this.update(updates);
  }

  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  getPath(): string {
    return this.configPath;
  }

  validate(): { valid: boolean; errors: string[] } {
    const config = this.load();
    const errors: string[] = [];

    // Validate framework
    if (!['react', 'vue', 'intact'].includes(config.framework)) {
      errors.push(`Invalid framework: ${config.framework}`);
    }

    // Validate directories
    if (!config.componentsDir || typeof config.componentsDir !== 'string') {
      errors.push('componentsDir must be a valid string');
    }

    if (!config.outputDir || typeof config.outputDir !== 'string') {
      errors.push('outputDir must be a valid string');
    }

    // Validate API endpoint
    if (!config.api.endpoint || typeof config.api.endpoint !== 'string') {
      errors.push('api.endpoint must be a valid string');
    }

    // Validate port
    if (config.preview.port < 1 || config.preview.port > 65535) {
      errors.push('preview.port must be between 1 and 65535');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save(this.config);
    logger.info('Config reset to defaults');
  }

  private mergeWithDefaults(config: any): KPCConfig {
    return this.deepMerge(DEFAULT_CONFIG, config);
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  // Environment variable overrides
  loadFromEnv(): Partial<KPCConfig> {
    const envConfig: any = {};

    if (process.env.KPC_FRAMEWORK) {
      envConfig.framework = process.env.KPC_FRAMEWORK;
    }

    if (process.env.KPC_TYPESCRIPT) {
      envConfig.typescript = process.env.KPC_TYPESCRIPT === 'true';
    }

    if (process.env.KPC_API_ENDPOINT) {
      envConfig.api = { ...envConfig.api, endpoint: process.env.KPC_API_ENDPOINT };
    }

    if (process.env.KPC_API_KEY) {
      envConfig.api = { ...envConfig.api, apiKey: process.env.KPC_API_KEY };
    }

    if (process.env.KPC_PREVIEW_PORT) {
      const port = parseInt(process.env.KPC_PREVIEW_PORT, 10);
      if (!isNaN(port)) {
        envConfig.preview = { ...envConfig.preview, port };
      }
    }

    return envConfig;
  }

  // Project-specific config detection
  detectProjectConfig(): Partial<KPCConfig> {
    const detectedConfig: any = {};

    // Detect framework from package.json
    if (fs.existsSync('package.json')) {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (dependencies.react) {
          detectedConfig.framework = 'react';
        } else if (dependencies.vue) {
          detectedConfig.framework = 'vue';
        } else if (dependencies.intact) {
          detectedConfig.framework = 'intact';
        }

        // Detect TypeScript
        if (dependencies.typescript || fs.existsSync('tsconfig.json')) {
          detectedConfig.typescript = true;
        }

        // Detect testing frameworks
        if (dependencies.jest || dependencies.vitest) {
          detectedConfig.testing = { ...detectedConfig.testing, unit: true };
        }

        if (dependencies['@storybook/react'] || dependencies['@storybook/vue']) {
          detectedConfig.generation = { ...detectedConfig.generation, includeStories: true };
        }

        if (dependencies.eslint) {
          detectedConfig.validation = { ...detectedConfig.validation, eslint: true };
        }
      } catch (error) {
        logger.warn('Failed to parse package.json:', error);
      }
    }

    // Detect common directory structures
    if (fs.existsSync('src/components')) {
      detectedConfig.componentsDir = './src/components';
    } else if (fs.existsSync('components')) {
      detectedConfig.componentsDir = './components';
    }

    return detectedConfig;
  }

  // Create config with smart defaults
  createWithDefaults(overrides: Partial<KPCConfig> = {}): KPCConfig {
    const envConfig = this.loadFromEnv();
    const projectConfig = this.detectProjectConfig();
    
    return this.deepMerge(
      this.deepMerge(
        this.deepMerge(DEFAULT_CONFIG, projectConfig),
        envConfig
      ),
      overrides
    );
  }
}

// Global config instance
let globalConfigManager: ConfigManager | null = null;

export function getConfig(): KPCConfig {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager.load();
}

export function updateConfig(updates: Partial<KPCConfig>): void {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  globalConfigManager.update(updates);
}

export function resetConfig(): void {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  globalConfigManager.reset();
}

export function configExists(): boolean {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager.exists();
}