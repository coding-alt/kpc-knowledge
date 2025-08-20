import { GraphNode, GraphRelationship, GraphResult } from '@kpc/shared';

export interface GraphStore {
  /**
   * 初始化图数据库连接
   */
  initialize(): Promise<void>;
  
  /**
   * 创建节点
   */
  createNode(node: GraphNode): Promise<string>;
  
  /**
   * 批量创建节点
   */
  createNodes(nodes: GraphNode[]): Promise<string[]>;
  
  /**
   * 创建关系
   */
  createRelationship(relationship: GraphRelationship): Promise<string>;
  
  /**
   * 批量创建关系
   */
  createRelationships(relationships: GraphRelationship[]): Promise<string[]>;
  
  /**
   * 查询节点
   */
  findNodes(type: string, properties?: Record<string, any>): Promise<GraphNode[]>;
  
  /**
   * 查询关系
   */
  findRelationships(type: string, properties?: Record<string, any>): Promise<GraphRelationship[]>;
  
  /**
   * 执行Cypher查询
   */
  query(cypher: string, parameters?: Record<string, any>): Promise<GraphResult>;
  
  /**
   * 查找节点的邻居
   */
  findNeighbors(nodeId: string, relationshipType?: string, direction?: 'in' | 'out' | 'both'): Promise<GraphNode[]>;
  
  /**
   * 查找两个节点之间的路径
   */
  findPath(startNodeId: string, endNodeId: string, maxDepth?: number): Promise<GraphPath[]>;
  
  /**
   * 删除节点
   */
  deleteNode(nodeId: string): Promise<void>;
  
  /**
   * 删除关系
   */
  deleteRelationship(relationshipId: string): Promise<void>;
  
  /**
   * 更新节点属性
   */
  updateNode(nodeId: string, properties: Record<string, any>): Promise<void>;
  
  /**
   * 更新关系属性
   */
  updateRelationship(relationshipId: string, properties: Record<string, any>): Promise<void>;
  
  /**
   * 获取图统计信息
   */
  getGraphStats(): Promise<GraphStats>;
  
  /**
   * 创建索引
   */
  createIndex(label: string, property: string): Promise<void>;
  
  /**
   * 删除索引
   */
  dropIndex(label: string, property: string): Promise<void>;
  
  /**
   * 清空数据库
   */
  clear(): Promise<void>;
  
  /**
   * 关闭连接
   */
  close(): Promise<void>;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
}

export interface GraphStats {
  nodeCount: number;
  relationshipCount: number;
  labelCounts: Record<string, number>;
  relationshipTypeCounts: Record<string, number>;
  indexCount: number;
}

export interface KnowledgeGraphBuilder {
  /**
   * 从组件清单构建知识图谱
   */
  buildFromManifest(manifest: any): Promise<void>;
  
  /**
   * 添加组件节点和关系
   */
  addComponent(component: any): Promise<string>;
  
  /**
   * 添加属性节点和关系
   */
  addProperty(property: any, componentId: string): Promise<string>;
  
  /**
   * 添加事件节点和关系
   */
  addEvent(event: any, componentId: string): Promise<string>;
  
  /**
   * 添加使用模式关系
   */
  addUsagePattern(pattern: any): Promise<string>;
  
  /**
   * 添加反模式关系
   */
  addAntiPattern(antiPattern: any): Promise<string>;
  
  /**
   * 推断组件之间的关系
   */
  inferRelationships(): Promise<void>;
  
  /**
   * 验证图谱完整性
   */
  validateGraph(): Promise<GraphValidationResult>;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  orphanedNodes: string[];
  missingRelationships: string[];
}