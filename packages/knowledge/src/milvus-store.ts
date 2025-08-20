import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';
import { 
  VectorStore, 
  VectorData, 
  VectorSearchFilter, 
  CollectionStats,
  SearchResult,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('MilvusStore');

export class MilvusVectorStore implements VectorStore {
  private client: MilvusClient;
  private connected: boolean = false;
  
  constructor(
    private config: MilvusConfig = {
      address: process.env.MILVUS_HOST || 'localhost:19530',
      username: process.env.MILVUS_USERNAME,
      password: process.env.MILVUS_PASSWORD,
      ssl: process.env.MILVUS_SSL === 'true',
    }
  ) {
    this.client = new MilvusClient(this.config);
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Milvus connection');
    
    try {
      // 测试连接
      const health = await this.client.checkHealth();
      if (!health.isHealthy) {
        throw new Error('Milvus server is not healthy');
      }
      
      this.connected = true;
      logger.info('Milvus connection established successfully');
      
    } catch (error) {
      logger.error(`Failed to initialize Milvus connection: ${error}`);
      throw error;
    }
  }

  async createCollection(name: string, dimension: number, description?: string): Promise<void> {
    this.ensureConnected();
    
    logger.info(`Creating collection: ${name} with dimension: ${dimension}`);
    
    try {
      const schema = {
        collection_name: name,
        description: description || `Collection for ${name}`,
        fields: [
          {
            name: 'id',
            data_type: DataType.VarChar,
            max_length: 255,
            is_primary_key: true,
            description: 'Primary key',
          },
          {
            name: 'vector',
            data_type: DataType.FloatVector,
            dim: dimension,
            description: 'Embedding vector',
          },
          {
            name: 'content',
            data_type: DataType.VarChar,
            max_length: 65535,
            description: 'Original content',
          },
          {
            name: 'framework',
            data_type: DataType.VarChar,
            max_length: 50,
            description: 'Framework type',
          },
          {
            name: 'component_name',
            data_type: DataType.VarChar,
            max_length: 255,
            description: 'Component name',
          },
          {
            name: 'category',
            data_type: DataType.VarChar,
            max_length: 100,
            description: 'Component category',
          },
          {
            name: 'source_file',
            data_type: DataType.VarChar,
            max_length: 500,
            description: 'Source file path',
          },
          {
            name: 'metadata',
            data_type: DataType.JSON,
            description: 'Additional metadata',
          },
        ],
      };
      
      await this.client.createCollection(schema);
      
      // 创建索引以提高搜索性能
      await this.createIndex(name, 'vector', {
        index_type: IndexType.IVF_FLAT,
        metric_type: MetricType.COSINE,
        params: { nlist: 1024 },
      });
      
      // 加载集合到内存
      await this.client.loadCollection({ collection_name: name });
      
      logger.info(`Collection ${name} created and loaded successfully`);
      
    } catch (error) {
      logger.error(`Failed to create collection ${name}: ${error}`);
      throw error;
    }
  }

  async hasCollection(name: string): Promise<boolean> {
    this.ensureConnected();
    
    try {
      const result = await this.client.hasCollection({ collection_name: name });
      return result.value;
    } catch (error) {
      logger.error(`Failed to check collection ${name}: ${error}`);
      return false;
    }
  }

  async dropCollection(name: string): Promise<void> {
    this.ensureConnected();
    
    logger.info(`Dropping collection: ${name}`);
    
    try {
      await this.client.dropCollection({ collection_name: name });
      logger.info(`Collection ${name} dropped successfully`);
    } catch (error) {
      logger.error(`Failed to drop collection ${name}: ${error}`);
      throw error;
    }
  }

  async insert(collectionName: string, vectors: VectorData[]): Promise<void> {
    this.ensureConnected();
    
    if (vectors.length === 0) {
      logger.warn('No vectors to insert');
      return;
    }
    
    logger.info(`Inserting ${vectors.length} vectors into collection: ${collectionName}`);
    
    try {
      const data = vectors.map(v => ({
        id: v.id,
        vector: v.vector,
        content: v.metadata.content || '',
        framework: v.metadata.framework || '',
        component_name: v.metadata.componentName || '',
        category: v.metadata.category || '',
        source_file: v.metadata.sourceFile || '',
        metadata: v.metadata,
      }));
      
      await this.client.insert({
        collection_name: collectionName,
        data,
      });
      
      // 刷新数据到磁盘
      await this.client.flush({ collection_names: [collectionName] });
      
      logger.info(`Successfully inserted ${vectors.length} vectors`);
      
    } catch (error) {
      logger.error(`Failed to insert vectors into ${collectionName}: ${error}`);
      throw error;
    }
  }

  async batchInsert(collectionName: string, vectors: VectorData[], batchSize: number = 1000): Promise<void> {
    this.ensureConnected();
    
    logger.info(`Batch inserting ${vectors.length} vectors with batch size: ${batchSize}`);
    
    try {
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.insert(collectionName, batch);
        
        // 添加小延迟以避免过载
        if (i + batchSize < vectors.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      logger.info(`Batch insert completed for ${vectors.length} vectors`);
      
    } catch (error) {
      logger.error(`Failed to batch insert vectors: ${error}`);
      throw error;
    }
  }

  async search(
    collectionName: string,
    queryVector: number[],
    topK: number,
    filter?: VectorSearchFilter
  ): Promise<SearchResult[]> {
    this.ensureConnected();
    
    logger.debug(`Searching in collection: ${collectionName}, topK: ${topK}`);
    
    try {
      // 构建过滤表达式
      const expr = this.buildFilterExpression(filter);
      
      const searchParams = {
        collection_name: collectionName,
        vectors: [queryVector],
        search_params: {
          anns_field: 'vector',
          topk: topK,
          metric_type: MetricType.COSINE,
          params: { nprobe: 10 },
        },
        output_fields: ['content', 'framework', 'component_name', 'category', 'source_file', 'metadata'],
        expr: expr || undefined,
      };
      
      const result = await this.client.search(searchParams);
      
      if (!result.results || result.results.length === 0) {
        return [];
      }
      
      const searchResults: SearchResult[] = result.results[0].map((item: any) => ({
        content: item.content || '',
        score: item.score,
        metadata: {
          componentName: item.component_name,
          framework: item.framework,
          sourceRef: {
            filePath: item.source_file,
            startLine: 1,
            endLine: 1,
          },
          type: 'component_definition' as const,
          ...item.metadata,
        },
      }));
      
      logger.debug(`Found ${searchResults.length} search results`);
      return searchResults;
      
    } catch (error) {
      logger.error(`Failed to search in collection ${collectionName}: ${error}`);
      throw error;
    }
  }

  async hybridSearch(
    collectionName: string,
    queryVector: number[],
    scalarFilters: Record<string, any>,
    topK: number
  ): Promise<SearchResult[]> {
    // 将标量过滤器转换为VectorSearchFilter格式
    const filter: VectorSearchFilter = {
      framework: scalarFilters.framework,
      componentName: scalarFilters.component_name,
      category: scalarFilters.category,
      minScore: scalarFilters.min_score,
    };
    
    return this.search(collectionName, queryVector, topK, filter);
  }

  async delete(collectionName: string, ids: string[]): Promise<void> {
    this.ensureConnected();
    
    if (ids.length === 0) {
      logger.warn('No IDs provided for deletion');
      return;
    }
    
    logger.info(`Deleting ${ids.length} vectors from collection: ${collectionName}`);
    
    try {
      const expr = `id in [${ids.map(id => `"${id}"`).join(', ')}]`;
      
      await this.client.delete({
        collection_name: collectionName,
        expr,
      });
      
      logger.info(`Successfully deleted ${ids.length} vectors`);
      
    } catch (error) {
      logger.error(`Failed to delete vectors from ${collectionName}: ${error}`);
      throw error;
    }
  }

  async update(collectionName: string, vectors: VectorData[]): Promise<void> {
    // Milvus不支持直接更新，需要先删除再插入
    const ids = vectors.map(v => v.id);
    await this.delete(collectionName, ids);
    await this.insert(collectionName, vectors);
  }

  async getCollectionStats(collectionName: string): Promise<CollectionStats> {
    this.ensureConnected();
    
    try {
      const stats = await this.client.getCollectionStatistics({
        collection_name: collectionName,
      });
      
      const info = await this.client.describeCollection({
        collection_name: collectionName,
      });
      
      // 获取向量维度
      const vectorField = info.schema.fields.find(f => f.name === 'vector');
      const dimension = vectorField?.dim || 0;
      
      return {
        name: collectionName,
        dimension,
        totalCount: parseInt(stats.stats.row_count) || 0,
        indexedCount: parseInt(stats.stats.row_count) || 0, // Milvus中所有数据都会被索引
        memoryUsage: 0, // Milvus SDK暂不提供内存使用信息
        diskUsage: 0, // Milvus SDK暂不提供磁盘使用信息
      };
      
    } catch (error) {
      logger.error(`Failed to get collection stats for ${collectionName}: ${error}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      logger.info('Closing Milvus connection');
      await this.client.closeConnection();
      this.connected = false;
    }
  }

  private async createIndex(collectionName: string, fieldName: string, indexParams: any): Promise<void> {
    try {
      await this.client.createIndex({
        collection_name: collectionName,
        field_name: fieldName,
        index_name: `${fieldName}_index`,
        ...indexParams,
      });
      
      logger.info(`Index created for field ${fieldName} in collection ${collectionName}`);
      
    } catch (error) {
      logger.error(`Failed to create index for ${fieldName}: ${error}`);
      throw error;
    }
  }

  private buildFilterExpression(filter?: VectorSearchFilter): string | null {
    if (!filter) return null;
    
    const conditions: string[] = [];
    
    if (filter.framework) {
      conditions.push(`framework == "${filter.framework}"`);
    }
    
    if (filter.componentName) {
      conditions.push(`component_name == "${filter.componentName}"`);
    }
    
    if (filter.category) {
      conditions.push(`category == "${filter.category}"`);
    }
    
    return conditions.length > 0 ? conditions.join(' && ') : null;
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Milvus client is not connected. Call initialize() first.');
    }
  }
}

export interface MilvusConfig {
  address: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  token?: string;
}