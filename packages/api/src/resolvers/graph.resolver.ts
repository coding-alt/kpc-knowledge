import { Resolver, Query, Arg, ID, Int } from 'type-graphql';
import { Service } from 'typedi';
import { 
  GraphResult, 
  GraphNode, 
  GraphRelationship 
} from '../schema/types';
import { GraphService } from '../services/graph.service';
import { createLogger } from '@kpc/shared';

const logger = createLogger('GraphResolver');

@Service()
@Resolver(() => GraphResult)
export class GraphResolver {
  constructor(private graphService: GraphService) {}

  @Query(() => GraphResult, { description: 'Execute Cypher query' })
  async executeQuery(
    @Arg('cypher') cypher: string,
    @Arg('parameters', { nullable: true }) parameters?: string
  ): Promise<GraphResult> {
    logger.debug(`Executing Cypher query: ${cypher}`);
    
    try {
      const params = parameters ? JSON.parse(parameters) : {};
      return await this.graphService.executeQuery(cypher, params);
    } catch (error) {
      logger.error(`Failed to execute query: ${error}`);
      throw error;
    }
  }

  @Query(() => [GraphNode], { description: 'Find nodes by type and properties' })
  async findNodes(
    @Arg('type') type: string,
    @Arg('properties', { nullable: true }) properties?: string,
    @Arg('limit', () => Int, { defaultValue: 100 }) limit?: number
  ): Promise<GraphNode[]> {
    logger.debug(`Finding nodes of type: ${type}`);
    
    try {
      const props = properties ? JSON.parse(properties) : {};
      return await this.graphService.findNodes(type, props, limit);
    } catch (error) {
      logger.error(`Failed to find nodes: ${error}`);
      throw error;
    }
  }

  @Query(() => [GraphRelationship], { description: 'Find relationships by type' })
  async findRelationships(
    @Arg('type') type: string,
    @Arg('properties', { nullable: true }) properties?: string,
    @Arg('limit', () => Int, { defaultValue: 100 }) limit?: number
  ): Promise<GraphRelationship[]> {
    logger.debug(`Finding relationships of type: ${type}`);
    
    try {
      const props = properties ? JSON.parse(properties) : {};
      return await this.graphService.findRelationships(type, props, limit);
    } catch (error) {
      logger.error(`Failed to find relationships: ${error}`);
      throw error;
    }
  }

  @Query(() => [GraphNode], { description: 'Find neighbors of a node' })
  async findNeighbors(
    @Arg('nodeId', () => ID) nodeId: string,
    @Arg('relationshipType', { nullable: true }) relationshipType?: string,
    @Arg('direction', { defaultValue: 'both' }) direction?: 'in' | 'out' | 'both',
    @Arg('limit', () => Int, { defaultValue: 50 }) limit?: number
  ): Promise<GraphNode[]> {
    logger.debug(`Finding neighbors for node: ${nodeId}`);
    
    try {
      return await this.graphService.findNeighbors(nodeId, relationshipType, direction, limit);
    } catch (error) {
      logger.error(`Failed to find neighbors: ${error}`);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Find shortest path between two nodes' })
  async findPath(
    @Arg('startNodeId', () => ID) startNodeId: string,
    @Arg('endNodeId', () => ID) endNodeId: string,
    @Arg('maxDepth', () => Int, { defaultValue: 5 }) maxDepth?: number,
    @Arg('relationshipType', { nullable: true }) relationshipType?: string
  ): Promise<GraphResult> {
    logger.debug(`Finding path from ${startNodeId} to ${endNodeId}`);
    
    try {
      return await this.graphService.findPath(startNodeId, endNodeId, maxDepth, relationshipType);
    } catch (error) {
      logger.error(`Failed to find path: ${error}`);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Get component dependency graph' })
  async componentDependencies(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('depth', () => Int, { defaultValue: 2 }) depth?: number,
    @Arg('includeTransitive', { defaultValue: true }) includeTransitive?: boolean
  ): Promise<GraphResult> {
    logger.debug(`Getting dependencies for component: ${componentId}`);
    
    try {
      return await this.graphService.getComponentDependencies(componentId, depth, includeTransitive);
    } catch (error) {
      logger.error(`Failed to get component dependencies: ${error}`);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Get component usage graph' })
  async componentUsage(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('depth', () => Int, { defaultValue: 2 }) depth?: number
  ): Promise<GraphResult> {
    logger.debug(`Getting usage for component: ${componentId}`);
    
    try {
      return await this.graphService.getComponentUsage(componentId, depth);
    } catch (error) {
      logger.error(`Failed to get component usage: ${error}`);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Get component similarity graph' })
  async componentSimilarity(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('threshold', { defaultValue: 0.7 }) threshold?: number,
    @Arg('limit', () => Int, { defaultValue: 10 }) limit?: number
  ): Promise<GraphResult> {
    logger.debug(`Getting similarity for component: ${componentId}`);
    
    try {
      return await this.graphService.getComponentSimilarity(componentId, threshold, limit);
    } catch (error) {
      logger.error(`Failed to get component similarity: ${error}`);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Get pattern usage graph' })
  async patternUsage(
    @Arg('patternId', () => ID) patternId: string,
    @Arg('includeExamples', { defaultValue: true }) includeExamples?: boolean
  ): Promise<GraphResult> {
    logger.debug(`Getting pattern usage: ${patternId}`);
    
    try {
      return await this.graphService.getPatternUsage(patternId, includeExamples);
    } catch (error) {
      logger.error(`Failed to get pattern usage: ${error}`);
      throw error;
    }
  }

  @Query(() => [String], { description: 'Get all node types' })
  async nodeTypes(): Promise<string[]> {
    logger.debug('Getting all node types');
    
    try {
      return await this.graphService.getNodeTypes();
    } catch (error) {
      logger.error('Failed to get node types:', error);
      throw error;
    }
  }

  @Query(() => [String], { description: 'Get all relationship types' })
  async relationshipTypes(): Promise<string[]> {
    logger.debug('Getting all relationship types');
    
    try {
      return await this.graphService.getRelationshipTypes();
    } catch (error) {
      logger.error('Failed to get relationship types:', error);
      throw error;
    }
  }

  @Query(() => String, { description: 'Get graph statistics' })
  async graphStats(): Promise<string> {
    logger.debug('Getting graph statistics');
    
    try {
      const stats = await this.graphService.getGraphStats();
      return JSON.stringify(stats);
    } catch (error) {
      logger.error('Failed to get graph statistics:', error);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Explore graph from a starting node' })
  async exploreGraph(
    @Arg('startNodeId', () => ID) startNodeId: string,
    @Arg('maxDepth', () => Int, { defaultValue: 3 }) maxDepth?: number,
    @Arg('nodeTypes', () => [String], { nullable: true }) nodeTypes?: string[],
    @Arg('relationshipTypes', () => [String], { nullable: true }) relationshipTypes?: string[],
    @Arg('limit', () => Int, { defaultValue: 100 }) limit?: number
  ): Promise<GraphResult> {
    logger.debug(`Exploring graph from node: ${startNodeId}`);
    
    try {
      return await this.graphService.exploreGraph(
        startNodeId, 
        maxDepth, 
        nodeTypes, 
        relationshipTypes, 
        limit
      );
    } catch (error) {
      logger.error(`Failed to explore graph: ${error}`);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Get component evolution history' })
  async componentEvolution(
    @Arg('componentName') componentName: string,
    @Arg('includeBreakingChanges', { defaultValue: true }) includeBreakingChanges?: boolean
  ): Promise<GraphResult> {
    logger.debug(`Getting evolution for component: ${componentName}`);
    
    try {
      return await this.graphService.getComponentEvolution(componentName, includeBreakingChanges);
    } catch (error) {
      logger.error(`Failed to get component evolution: ${error}`);
      throw error;
    }
  }

  @Query(() => GraphResult, { description: 'Find anti-pattern violations' })
  async findAntiPatterns(
    @Arg('componentId', () => ID, { nullable: true }) componentId?: string,
    @Arg('severity', { nullable: true }) severity?: string,
    @Arg('limit', () => Int, { defaultValue: 50 }) limit?: number
  ): Promise<GraphResult> {
    logger.debug('Finding anti-pattern violations');
    
    try {
      return await this.graphService.findAntiPatterns(componentId, severity, limit);
    } catch (error) {
      logger.error('Failed to find anti-patterns:', error);
      throw error;
    }
  }
}