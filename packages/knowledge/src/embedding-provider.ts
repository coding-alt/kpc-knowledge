import { HfInference } from '@huggingface/inference';
import { EmbeddingProvider, EmbeddingModelInfo, createLogger } from '@kpc/shared';

const logger = createLogger('EmbeddingProvider');

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  private hf: HfInference;
  private modelName: string;
  private dimension: number;
  private maxTokens: number;

  constructor(
    apiKey: string = process.env.HUGGINGFACE_API_KEY || '',
    modelName: string = 'sentence-transformers/all-MiniLM-L6-v2'
  ) {
    if (!apiKey) {
      throw new Error('HuggingFace API key is required');
    }

    this.hf = new HfInference(apiKey);
    this.modelName = modelName;
    
    // 模型配置映射
    const modelConfigs: Record<string, { dimension: number; maxTokens: number }> = {
      'sentence-transformers/all-MiniLM-L6-v2': { dimension: 384, maxTokens: 256 },
      'sentence-transformers/all-mpnet-base-v2': { dimension: 768, maxTokens: 384 },
      'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2': { dimension: 384, maxTokens: 128 },
      'BAAI/bge-small-en-v1.5': { dimension: 384, maxTokens: 512 },
      'BAAI/bge-base-en-v1.5': { dimension: 768, maxTokens: 512 },
    };

    const config = modelConfigs[modelName] || { dimension: 384, maxTokens: 256 };
    this.dimension = config.dimension;
    this.maxTokens = config.maxTokens;
  }

  async embed(text: string): Promise<number[]> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    // 截断过长的文本
    const truncatedText = this.truncateText(text);
    
    try {
      logger.debug(`Generating embedding for text: ${truncatedText.substring(0, 100)}...`);
      
      const result = await this.hf.featureExtraction({
        model: this.modelName,
        inputs: truncatedText,
      });

      // 处理不同的返回格式
      let embedding: number[];
      
      if (Array.isArray(result)) {
        if (Array.isArray(result[0])) {
          // 二维数组，取第一个
          embedding = result[0] as number[];
        } else {
          // 一维数组
          embedding = result as number[];
        }
      } else {
        throw new Error('Unexpected embedding format');
      }

      if (embedding.length !== this.dimension) {
        throw new Error(`Expected embedding dimension ${this.dimension}, got ${embedding.length}`);
      }

      logger.debug(`Generated embedding with dimension: ${embedding.length}`);
      return embedding;

    } catch (error) {
      logger.error(`Failed to generate embedding: ${error}`);
      throw error;
    }
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    logger.info(`Generating embeddings for ${texts.length} texts`);

    try {
      // 批量处理，避免API限制
      const batchSize = 10;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const truncatedBatch = batch.map(text => this.truncateText(text));

        const batchResult = await this.hf.featureExtraction({
          model: this.modelName,
          inputs: truncatedBatch,
        });

        // 处理批量结果
        if (Array.isArray(batchResult) && Array.isArray(batchResult[0])) {
          if (Array.isArray(batchResult[0][0])) {
            // 三维数组 [batch][sentence][embedding]
            results.push(...(batchResult as number[][][]).map(item => item[0]));
          } else {
            // 二维数组 [batch][embedding]
            results.push(...(batchResult as number[][]));
          }
        } else {
          throw new Error('Unexpected batch embedding format');
        }

        // 添加延迟以避免API限制
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info(`Generated ${results.length} embeddings`);
      return results;

    } catch (error) {
      logger.error(`Failed to generate batch embeddings: ${error}`);
      throw error;
    }
  }

  getDimension(): number {
    return this.dimension;
  }

  getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.modelName,
      dimension: this.dimension,
      maxTokens: this.maxTokens,
      provider: 'HuggingFace',
    };
  }

  private truncateText(text: string): string {
    // 简单的token估算：平均每个token约4个字符
    const estimatedTokens = text.length / 4;
    
    if (estimatedTokens <= this.maxTokens) {
      return text;
    }

    // 截断到最大token数
    const maxChars = this.maxTokens * 4;
    return text.substring(0, maxChars);
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private modelName: string;
  private dimension: number;
  private maxTokens: number;

  constructor(
    apiKey: string = process.env.OPENAI_API_KEY || '',
    modelName: string = 'text-embedding-3-small'
  ) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.apiKey = apiKey;
    this.modelName = modelName;

    // OpenAI模型配置
    const modelConfigs: Record<string, { dimension: number; maxTokens: number }> = {
      'text-embedding-3-small': { dimension: 1536, maxTokens: 8191 },
      'text-embedding-3-large': { dimension: 3072, maxTokens: 8191 },
      'text-embedding-ada-002': { dimension: 1536, maxTokens: 8191 },
    };

    const config = modelConfigs[modelName] || { dimension: 1536, maxTokens: 8191 };
    this.dimension = config.dimension;
    this.maxTokens = config.maxTokens;
  }

  async embed(text: string): Promise<number[]> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    try {
      logger.debug(`Generating OpenAI embedding for text: ${text.substring(0, 100)}...`);

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI');
      }

      const embedding = data.data[0].embedding;
      
      if (embedding.length !== this.dimension) {
        throw new Error(`Expected embedding dimension ${this.dimension}, got ${embedding.length}`);
      }

      logger.debug(`Generated OpenAI embedding with dimension: ${embedding.length}`);
      return embedding;

    } catch (error) {
      logger.error(`Failed to generate OpenAI embedding: ${error}`);
      throw error;
    }
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    logger.info(`Generating OpenAI embeddings for ${texts.length} texts`);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          input: texts,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI');
      }

      const embeddings = data.data.map((item: any) => item.embedding);
      
      logger.info(`Generated ${embeddings.length} OpenAI embeddings`);
      return embeddings;

    } catch (error) {
      logger.error(`Failed to generate OpenAI batch embeddings: ${error}`);
      throw error;
    }
  }

  getDimension(): number {
    return this.dimension;
  }

  getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.modelName,
      dimension: this.dimension,
      maxTokens: this.maxTokens,
      provider: 'OpenAI',
    };
  }
}