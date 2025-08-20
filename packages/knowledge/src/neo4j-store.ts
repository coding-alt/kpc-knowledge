import neo4j, { Driver, Session, Result, Record } from 'neo4j-driver';
import { 
  GraphStore, 
  GraphPath, 
  GraphStats,
  GraphNode, 
  GraphRelationship, 
  GraphResult,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('Neo4jStore');

export class Neo4jGraphStore implements GraphStore {
  private driver: Driver | null = null;
  private connected: boolean = false;

  constructor(
    private config: Neo4jConfig = {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password123',
    }
  ) {}

  async initialize(): Promise<void> {
    logger.info('Initializing Neo4j connection');
    
    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        }
      );

      // 验证连接
      await this.driver.verifyConnectivity();
      this.connected = true;
      
      logger.info('Neo4j connection established successfully');
      
      // 创建基础约束和索引
      await this.createBaseConstraints();
      
    } catch (error) {
      logger.error(`Failed to initialize Neo4j connection: ${error}`);
      throw error;
    }
  }

  async createNode(node: GraphNode): Promise<string> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const labels = node.labels?.join(':') || node.type;
      const cypher = `
        CREATE (n:${labels} $properties)
        RETURN elementId(n) as id
      `;
      
      const result = await session.run(cypher, { properties: node.properties });
      const record = result.records[0];
      
      if (!record) {
        throw new Error('Failed to create node');
      }
      
      const nodeId = record.get('id');
      logger.debug(`Created node with ID: ${nodeId}`);
      
      return nodeId;
      
    } catch (error) {
      logger.error(`Failed to create node: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createNodes(nodes: GraphNode[]): Promise<string[]> {
    if (nodes.length === 0) return [];
    
    this.ensureConnected();
    const session = this.driver!.session();
    
    try {
      const tx = session.beginTransaction();
      const nodeIds: string[] = [];
      
      for (const node of nodes) {
        const labels = node.labels?.join(':') || node.type;
        const cypher = `
          CREATE (n:${labels} $properties)
          RETURN elementId(n) as id
        `;
        
        const result = await tx.run(cypher, { properties: node.properties });
        const record = result.records[0];
        
        if (record) {
          nodeIds.push(record.get('id'));
        }
      }
      
      await tx.commit();
      logger.info(`Created ${nodeIds.length} nodes`);
      
      return nodeIds;
      
    } catch (error) {
      logger.error(`Failed to create nodes: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createRelationship(relationship: GraphRelationship): Promise<string> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `
        MATCH (start), (end)
        WHERE elementId(start) = $startNodeId AND elementId(end) = $endNodeId
        CREATE (start)-[r:${relationship.type} $properties]->(end)
        RETURN elementId(r) as id
      `;
      
      const result = await session.run(cypher, {
        startNodeId: relationship.startNode,
        endNodeId: relationship.endNode,
        properties: relationship.properties || {},
      });
      
      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to create relationship');
      }
      
      const relationshipId = record.get('id');
      logger.debug(`Created relationship with ID: ${relationshipId}`);
      
      return relationshipId;
      
    } catch (error) {
      logger.error(`Failed to create relationship: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createRelationships(relationships: GraphRelationship[]): Promise<string[]> {
    if (relationships.length === 0) return [];
    
    this.ensureConnected();
    const session = this.driver!.session();
    
    try {
      const tx = session.beginTransaction();
      const relationshipIds: string[] = [];
      
      for (const relationship of relationships) {
        const cypher = `
          MATCH (start), (end)
          WHERE elementId(start) = $startNodeId AND elementId(end) = $endNodeId
          CREATE (start)-[r:${relationship.type} $properties]->(end)
          RETURN elementId(r) as id
        `;
        
        const result = await tx.run(cypher, {
          startNodeId: relationship.startNode,
          endNodeId: relationship.endNode,
          properties: relationship.properties || {},
        });
        
        const record = result.records[0];
        if (record) {
          relationshipIds.push(record.get('id'));
        }
      }
      
      await tx.commit();
      logger.info(`Created ${relationshipIds.length} relationships`);
      
      return relationshipIds;
      
    } catch (error) {
      logger.error(`Failed to create relationships: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async findNodes(type: string, properties?: Record<string, any>): Promise<GraphNode[]> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      let cypher = `MATCH (n:${type})`;
      const parameters: Record<string, any> = {};
      
      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.keys(properties).map((key, index) => {
          const paramName = `prop${index}`;
          parameters[paramName] = properties[key];
          return `n.${key} = $${paramName}`;
        });
        
        cypher += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      cypher += ` RETURN elementId(n) as id, labels(n) as labels, properties(n) as properties`;
      
      const result = await session.run(cypher, parameters);
      
      const nodes: GraphNode[] = result.records.map(record => ({
        id: record.get('id'),
        type,
        properties: record.get('properties'),
        labels: record.get('labels'),
      }));
      
      logger.debug(`Found ${nodes.length} nodes of type ${type}`);
      return nodes;
      
    } catch (error) {
      logger.error(`Failed to find nodes: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async findRelationships(type: string, properties?: Record<string, any>): Promise<GraphRelationship[]> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      let cypher = `MATCH ()-[r:${type}]-()`;
      const parameters: Record<string, any> = {};
      
      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.keys(properties).map((key, index) => {
          const paramName = `prop${index}`;
          parameters[paramName] = properties[key];
          return `r.${key} = $${paramName}`;
        });
        
        cypher += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      cypher += ` RETURN elementId(r) as id, elementId(startNode(r)) as startNode, elementId(endNode(r)) as endNode, properties(r) as properties`;
      
      const result = await session.run(cypher, parameters);
      
      const relationships: GraphRelationship[] = result.records.map(record => ({
        id: record.get('id'),
        type,
        startNode: record.get('startNode'),
        endNode: record.get('endNode'),
        properties: record.get('properties'),
      }));
      
      logger.debug(`Found ${relationships.length} relationships of type ${type}`);
      return relationships;
      
    } catch (error) {
      logger.error(`Failed to find relationships: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async query(cypher: string, parameters?: Record<string, any>): Promise<GraphResult> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    const startTime = Date.now();
    
    try {
      logger.debug(`Executing Cypher query: ${cypher}`);
      
      const result = await session.run(cypher, parameters || {});
      const executionTime = Date.now() - startTime;
      
      const nodes: GraphNode[] = [];
      const relationships: GraphRelationship[] = [];
      
      // 提取节点和关系
      for (const record of result.records) {
        for (const key of record.keys) {
          const value = record.get(key);
          
          if (value && typeof value === 'object') {
            if (value.labels) {
              // 这是一个节点
              nodes.push({
                id: value.elementId || value.identity?.toString(),
                type: value.labels[0] || 'Unknown',
                properties: value.properties,
                labels: value.labels,
              });
            } else if (value.type) {
              // 这是一个关系
              relationships.push({
                id: value.elementId || value.identity?.toString(),
                type: value.type,
                startNode: value.startNodeElementId || value.start?.toString(),
                endNode: value.endNodeElementId || value.end?.toString(),
                properties: value.properties,
              });
            }
          }
        }
      }
      
      const graphResult: GraphResult = {
        nodes,
        relationships,
        metadata: {
          executionTime,
          resultCount: result.records.length,
        },
      };
      
      logger.debug(`Query executed in ${executionTime}ms, returned ${result.records.length} records`);
      return graphResult;
      
    } catch (error) {
      logger.error(`Failed to execute query: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async findNeighbors(
    nodeId: string, 
    relationshipType?: string, 
    direction: 'in' | 'out' | 'both' = 'both'
  ): Promise<GraphNode[]> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      let relationshipPattern = '';
      
      switch (direction) {
        case 'in':
          relationshipPattern = relationshipType ? `<-[:${relationshipType}]-` : '<--';
          break;
        case 'out':
          relationshipPattern = relationshipType ? `-[:${relationshipType}]->` : '-->';
          break;
        case 'both':
          relationshipPattern = relationshipType ? `-[:${relationshipType}]-` : '--';
          break;
      }
      
      const cypher = `
        MATCH (n)${relationshipPattern}(neighbor)
        WHERE elementId(n) = $nodeId
        RETURN DISTINCT elementId(neighbor) as id, labels(neighbor) as labels, properties(neighbor) as properties
      `;
      
      const result = await session.run(cypher, { nodeId });
      
      const neighbors: GraphNode[] = result.records.map(record => ({
        id: record.get('id'),
        type: record.get('labels')[0] || 'Unknown',
        properties: record.get('properties'),
        labels: record.get('labels'),
      }));
      
      logger.debug(`Found ${neighbors.length} neighbors for node ${nodeId}`);
      return neighbors;
      
    } catch (error) {
      logger.error(`Failed to find neighbors: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async findPath(startNodeId: string, endNodeId: string, maxDepth: number = 5): Promise<GraphPath[]> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `
        MATCH path = shortestPath((start)-[*1..${maxDepth}]-(end))
        WHERE elementId(start) = $startNodeId AND elementId(end) = $endNodeId
        RETURN path
      `;
      
      const result = await session.run(cypher, { startNodeId, endNodeId });
      
      const paths: GraphPath[] = result.records.map(record => {
        const path = record.get('path');
        
        const nodes: GraphNode[] = path.segments.map((segment: any) => ({
          id: segment.start.elementId,
          type: segment.start.labels[0] || 'Unknown',
          properties: segment.start.properties,
          labels: segment.start.labels,
        }));
        
        // 添加最后一个节点
        if (path.segments.length > 0) {
          const lastSegment = path.segments[path.segments.length - 1];
          nodes.push({
            id: lastSegment.end.elementId,
            type: lastSegment.end.labels[0] || 'Unknown',
            properties: lastSegment.end.properties,
            labels: lastSegment.end.labels,
          });
        }
        
        const relationships: GraphRelationship[] = path.segments.map((segment: any) => ({
          id: segment.relationship.elementId,
          type: segment.relationship.type,
          startNode: segment.start.elementId,
          endNode: segment.end.elementId,
          properties: segment.relationship.properties,
        }));
        
        return {
          nodes,
          relationships,
          length: path.length,
        };
      });
      
      logger.debug(`Found ${paths.length} paths between nodes`);
      return paths;
      
    } catch (error) {
      logger.error(`Failed to find path: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async deleteNode(nodeId: string): Promise<void> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `
        MATCH (n)
        WHERE elementId(n) = $nodeId
        DETACH DELETE n
      `;
      
      await session.run(cypher, { nodeId });
      logger.debug(`Deleted node with ID: ${nodeId}`);
      
    } catch (error) {
      logger.error(`Failed to delete node: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `
        MATCH ()-[r]-()
        WHERE elementId(r) = $relationshipId
        DELETE r
      `;
      
      await session.run(cypher, { relationshipId });
      logger.debug(`Deleted relationship with ID: ${relationshipId}`);
      
    } catch (error) {
      logger.error(`Failed to delete relationship: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async updateNode(nodeId: string, properties: Record<string, any>): Promise<void> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `
        MATCH (n)
        WHERE elementId(n) = $nodeId
        SET n += $properties
      `;
      
      await session.run(cypher, { nodeId, properties });
      logger.debug(`Updated node with ID: ${nodeId}`);
      
    } catch (error) {
      logger.error(`Failed to update node: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async updateRelationship(relationshipId: string, properties: Record<string, any>): Promise<void> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `
        MATCH ()-[r]-()
        WHERE elementId(r) = $relationshipId
        SET r += $properties
      `;
      
      await session.run(cypher, { relationshipId, properties });
      logger.debug(`Updated relationship with ID: ${relationshipId}`);
      
    } catch (error) {
      logger.error(`Failed to update relationship: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getGraphStats(): Promise<GraphStats> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      // 获取节点统计
      const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as count');
      const nodeCount = nodeCountResult.records[0]?.get('count').toNumber() || 0;
      
      // 获取关系统计
      const relCountResult = await session.run('MATCH ()-[r]-() RETURN count(r) as count');
      const relationshipCount = relCountResult.records[0]?.get('count').toNumber() || 0;
      
      // 获取标签统计
      const labelResult = await session.run('CALL db.labels()');
      const labels = labelResult.records.map(record => record.get('label'));
      
      const labelCounts: Record<string, number> = {};
      for (const label of labels) {
        const result = await session.run(`MATCH (n:${label}) RETURN count(n) as count`);
        labelCounts[label] = result.records[0]?.get('count').toNumber() || 0;
      }
      
      // 获取关系类型统计
      const relTypeResult = await session.run('CALL db.relationshipTypes()');
      const relationshipTypes = relTypeResult.records.map(record => record.get('relationshipType'));
      
      const relationshipTypeCounts: Record<string, number> = {};
      for (const type of relationshipTypes) {
        const result = await session.run(`MATCH ()-[r:${type}]-() RETURN count(r) as count`);
        relationshipTypeCounts[type] = result.records[0]?.get('count').toNumber() || 0;
      }
      
      // 获取索引统计
      const indexResult = await session.run('CALL db.indexes()');
      const indexCount = indexResult.records.length;
      
      return {
        nodeCount,
        relationshipCount,
        labelCounts,
        relationshipTypeCounts,
        indexCount,
      };
      
    } catch (error) {
      logger.error(`Failed to get graph stats: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createIndex(label: string, property: string): Promise<void> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `CREATE INDEX ${label}_${property}_index IF NOT EXISTS FOR (n:${label}) ON (n.${property})`;
      await session.run(cypher);
      
      logger.info(`Created index for ${label}.${property}`);
      
    } catch (error) {
      logger.error(`Failed to create index: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async dropIndex(label: string, property: string): Promise<void> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      const cypher = `DROP INDEX ${label}_${property}_index IF EXISTS`;
      await session.run(cypher);
      
      logger.info(`Dropped index for ${label}.${property}`);
      
    } catch (error) {
      logger.error(`Failed to drop index: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async clear(): Promise<void> {
    this.ensureConnected();
    
    const session = this.driver!.session();
    
    try {
      logger.warn('Clearing all data from Neo4j database');
      await session.run('MATCH (n) DETACH DELETE n');
      logger.info('Database cleared successfully');
      
    } catch (error) {
      logger.error(`Failed to clear database: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.driver && this.connected) {
      logger.info('Closing Neo4j connection');
      await this.driver.close();
      this.connected = false;
    }
  }

  private async createBaseConstraints(): Promise<void> {
    const session = this.driver!.session();
    
    try {
      // 创建基础约束
      const constraints = [
        'CREATE CONSTRAINT component_name_unique IF NOT EXISTS FOR (c:Component) REQUIRE c.name IS UNIQUE',
        'CREATE CONSTRAINT prop_id_unique IF NOT EXISTS FOR (p:Property) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE',
        'CREATE CONSTRAINT pattern_id_unique IF NOT EXISTS FOR (p:Pattern) REQUIRE p.id IS UNIQUE',
      ];
      
      for (const constraint of constraints) {
        try {
          await session.run(constraint);
        } catch (error) {
          // 约束可能已存在，忽略错误
          logger.debug(`Constraint creation skipped: ${error}`);
        }
      }
      
      // 创建基础索引
      const indexes = [
        { label: 'Component', property: 'framework' },
        { label: 'Component', property: 'category' },
        { label: 'Property', property: 'type' },
        { label: 'Event', property: 'type' },
      ];
      
      for (const index of indexes) {
        try {
          await this.createIndex(index.label, index.property);
        } catch (error) {
          // 索引可能已存在，忽略错误
          logger.debug(`Index creation skipped: ${error}`);
        }
      }
      
    } catch (error) {
      logger.error(`Failed to create base constraints: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  private ensureConnected(): void {
    if (!this.connected || !this.driver) {
      throw new Error('Neo4j driver is not connected. Call initialize() first.');
    }
  }
}

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}