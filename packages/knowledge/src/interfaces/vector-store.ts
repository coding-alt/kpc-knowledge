import { SearchResult, SearchFilter } from '@kpc/shared';

export interface VectorStore {
  /**
   * 初始化向量数据库连接
   */
  initialize(): Promise<void>;
  
  /**
   * 创建集合
   */
  createCollection(name: string, dimension: number, description?: string): Promise<void>;
  
  /**
   * 检查集合是否存在
   */
  hasCollection(name: string): Promise<boolean>;
  
  /**
   * 删除集合
   */
  dropCollection(name: string): Promise<void>;
  
  /**
   * 插入向量数据
   */
  insert(collectionName: string, vectors: VectorData[]): Promise<void>;
  
  /**
   * 批量插入向量数据
   */
  batchInsert(collectionName: string, vectors: VectorData[], batchSize?: number): Promise<void>;
  
  /**
   * 向量相似性搜索
   */
  search(
    collectionName: string, 
    queryVector: number[], 
    topK: number,
    filter?: VectorSearchFilter
  ): Promise<SearchResult[]>;
  
  /**
   * 混合搜索（向量 + 标量过滤）
   */
  hybridSearch(
    collectionName: string,
    queryVector: number[],
    scalarFilters: Record<string, any>,
    topK: number
  ): Promise<SearchResult[]>;
  
  /**
   * 删除向量数据
   */
  delete(collectionName: string, ids: string[]): Promise<void>;
  
  /**
   * 更新向量数据
   */
  update(collectionName: string, vectors: VectorData[]): Promise<void>;
  
  /**
   * 获取集合统计信息
   */
  getCollectionStats(collectionName: string): Promise<CollectionStats>;
  
  /**
   * 关闭连接
   */
  close(): Promise<void>;
}

export interface VectorData {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

export interface VectorSearchFilter {
  framework?: string;
  componentName?: string;
  category?: string;
  minScore?: number;
}

export interface CollectionStats {
  name: string;
  dimension: number;
  totalCount: number;
  indexedCount: number;
  memoryUsage: number;
  diskUsage: number;
}

export interface EmbeddingProvider {
  /**
   * 生成文本嵌入向量
   */
  embed(text: string): Promise<number[]>;
  
  /**
   * 批量生成嵌入向量
   */
  batchEmbed(texts: string[]): Promise<number[][]>;
  
  /**
   * 获取嵌入维度
   */
  getDimension(): number;
  
  /**
   * 获取模型信息
   */
  getModelInfo(): EmbeddingModelInfo;
}

export interface EmbeddingModelInfo {
  name: string;
  dimension: number;
  maxTokens: number;
  provider: string;
}