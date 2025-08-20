import { AIProvider, createLogger } from '@kpc/shared';
import { OpenAIProvider, AnthropicProvider, MockAIProvider } from './ai-provider';

const logger = createLogger('AIProviderFactory');

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'mock';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * AI Provider 工厂类
 * 支持根据环境变量和配置自动创建合适的 AI 服务实例
 */
export class AIProviderFactory {
  /**
   * 根据环境变量创建默认的 AI Provider
   */
  static createDefaultProvider(): AIProvider {
    // 检查是否有可用的 API 密钥
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (openaiKey) {
      logger.info('Creating OpenAI provider with environment configuration');
      return new OpenAIProvider(
        openaiKey,
        process.env.OPENAI_BASE_URL,
        process.env.OPENAI_MODEL
      );
    }

    if (anthropicKey) {
      logger.info('Creating Anthropic provider with environment configuration');
      return new AnthropicProvider(
        anthropicKey,
        process.env.ANTHROPIC_BASE_URL,
        process.env.ANTHROPIC_MODEL
      );
    }

    logger.warn('No AI API keys found, using mock provider');
    return new MockAIProvider();
  }

  /**
   * 根据配置创建指定的 AI Provider
   */
  static createProvider(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        return new OpenAIProvider(
          config.apiKey,
          config.baseUrl,
          config.model
        );

      case 'anthropic':
        if (!config.apiKey) {
          throw new Error('Anthropic API key is required');
        }
        return new AnthropicProvider(
          config.apiKey,
          config.baseUrl,
          config.model
        );

      case 'mock':
        return new MockAIProvider();

      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * 创建支持自定义 base URL 的 OpenAI 兼容 Provider
   * 适用于 Azure OpenAI、本地部署等兼容 OpenAI API 的服务
   */
  static createOpenAICompatibleProvider(
    apiKey: string,
    baseUrl: string,
    model: string = 'gpt-4'
  ): AIProvider {
    logger.info(`Creating OpenAI-compatible provider with base URL: ${baseUrl}`);
    return new OpenAIProvider(apiKey, baseUrl, model);
  }

  /**
   * 验证 AI Provider 配置
   */
  static validateConfig(config: AIProviderConfig): boolean {
    switch (config.provider) {
      case 'openai':
      case 'anthropic':
        return !!config.apiKey;
      case 'mock':
        return true;
      default:
        return false;
    }
  }

  /**
   * 获取当前环境的最佳 AI Provider 配置
   */
  static getOptimalConfig(): AIProviderConfig {
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL,
      };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        model: process.env.ANTHROPIC_MODEL,
      };
    }

    return { provider: 'mock' };
  }
} 