import { Resolver, Query, Mutation, Arg, ID, Int } from 'type-graphql';
import { Service } from 'typedi';
import { 
  ComponentSpec, 
  ComponentFilter, 
  PaginatedComponents, 
  PaginationInput, 
  SortInput,
  PropDefinition,
  EventDefinition,
  SlotDefinition 
} from '../schema/types';
import { ComponentService } from '../services/component.service';
import { createLogger } from '@kpc/shared';

const logger = createLogger('ComponentResolver');

@Service()
@Resolver(() => ComponentSpec)
export class ComponentResolver {
  constructor(private componentService: ComponentService) {}

  @Query(() => [ComponentSpec], { description: 'Get all components' })
  async components(
    @Arg('filter', () => ComponentFilter, { nullable: true }) filter?: ComponentFilter,
    @Arg('pagination', () => PaginationInput, { nullable: true }) pagination?: PaginationInput,
    @Arg('sort', () => SortInput, { nullable: true }) sort?: SortInput
  ): Promise<ComponentSpec[]> {
    logger.debug('Fetching components with filter:', filter);
    
    try {
      return await this.componentService.findComponents(filter, pagination, sort);
    } catch (error) {
      logger.error('Failed to fetch components:', error);
      throw error;
    }
  }

  @Query(() => PaginatedComponents, { description: 'Get paginated components' })
  async paginatedComponents(
    @Arg('filter', () => ComponentFilter, { nullable: true }) filter?: ComponentFilter,
    @Arg('pagination', () => PaginationInput, { nullable: true }) pagination?: PaginationInput,
    @Arg('sort', () => SortInput, { nullable: true }) sort?: SortInput
  ): Promise<PaginatedComponents> {
    logger.debug('Fetching paginated components');
    
    try {
      return await this.componentService.findPaginatedComponents(filter, pagination, sort);
    } catch (error) {
      logger.error('Failed to fetch paginated components:', error);
      throw error;
    }
  }

  @Query(() => ComponentSpec, { nullable: true, description: 'Get component by ID' })
  async component(
    @Arg('id', () => ID) id: string
  ): Promise<ComponentSpec | null> {
    logger.debug(`Fetching component by ID: ${id}`);
    
    try {
      return await this.componentService.findById(id);
    } catch (error) {
      logger.error(`Failed to fetch component ${id}:`, error);
      throw error;
    }
  }

  @Query(() => ComponentSpec, { nullable: true, description: 'Get component by name' })
  async componentByName(
    @Arg('name') name: string,
    @Arg('framework', { nullable: true }) framework?: string
  ): Promise<ComponentSpec | null> {
    logger.debug(`Fetching component by name: ${name}, framework: ${framework}`);
    
    try {
      return await this.componentService.findByName(name, framework);
    } catch (error) {
      logger.error(`Failed to fetch component ${name}:`, error);
      throw error;
    }
  }

  @Query(() => [ComponentSpec], { description: 'Get components by category' })
  async componentsByCategory(
    @Arg('category') category: string,
    @Arg('framework', { nullable: true }) framework?: string
  ): Promise<ComponentSpec[]> {
    logger.debug(`Fetching components by category: ${category}, framework: ${framework}`);
    
    try {
      return await this.componentService.findByCategory(category, framework);
    } catch (error) {
      logger.error(`Failed to fetch components by category ${category}:`, error);
      throw error;
    }
  }

  @Query(() => [String], { description: 'Get all component categories' })
  async componentCategories(): Promise<string[]> {
    logger.debug('Fetching component categories');
    
    try {
      return await this.componentService.getCategories();
    } catch (error) {
      logger.error('Failed to fetch component categories:', error);
      throw error;
    }
  }

  @Query(() => [ComponentSpec], { description: 'Get related components' })
  async relatedComponents(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('limit', () => Int, { defaultValue: 5 }) limit: number
  ): Promise<ComponentSpec[]> {
    logger.debug(`Fetching related components for: ${componentId}`);
    
    try {
      return await this.componentService.findRelatedComponents(componentId, limit);
    } catch (error) {
      logger.error(`Failed to fetch related components for ${componentId}:`, error);
      throw error;
    }
  }

  @Query(() => [ComponentSpec], { description: 'Get similar components' })
  async similarComponents(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('threshold', { defaultValue: 0.7 }) threshold: number,
    @Arg('limit', () => Int, { defaultValue: 5 }) limit: number
  ): Promise<ComponentSpec[]> {
    logger.debug(`Fetching similar components for: ${componentId}`);
    
    try {
      return await this.componentService.findSimilarComponents(componentId, threshold, limit);
    } catch (error) {
      logger.error(`Failed to fetch similar components for ${componentId}:`, error);
      throw error;
    }
  }

  @Query(() => [ComponentSpec], { description: 'Get deprecated components' })
  async deprecatedComponents(
    @Arg('framework', { nullable: true }) framework?: string
  ): Promise<ComponentSpec[]> {
    logger.debug('Fetching deprecated components');
    
    try {
      return await this.componentService.findDeprecatedComponents(framework);
    } catch (error) {
      logger.error('Failed to fetch deprecated components:', error);
      throw error;
    }
  }

  // 字段解析器
  @Query(() => [PropDefinition], { description: 'Get component properties' })
  async componentProps(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('includeDeprecated', { defaultValue: false }) includeDeprecated: boolean
  ): Promise<PropDefinition[]> {
    logger.debug(`Fetching props for component: ${componentId}`);
    
    try {
      return await this.componentService.getComponentProps(componentId, includeDeprecated);
    } catch (error) {
      logger.error(`Failed to fetch props for component ${componentId}:`, error);
      throw error;
    }
  }

  @Query(() => [EventDefinition], { description: 'Get component events' })
  async componentEvents(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('includeDeprecated', { defaultValue: false }) includeDeprecated: boolean
  ): Promise<EventDefinition[]> {
    logger.debug(`Fetching events for component: ${componentId}`);
    
    try {
      return await this.componentService.getComponentEvents(componentId, includeDeprecated);
    } catch (error) {
      logger.error(`Failed to fetch events for component ${componentId}:`, error);
      throw error;
    }
  }

  @Query(() => [SlotDefinition], { description: 'Get component slots' })
  async componentSlots(
    @Arg('componentId', () => ID) componentId: string,
    @Arg('includeDeprecated', { defaultValue: false }) includeDeprecated: boolean
  ): Promise<SlotDefinition[]> {
    logger.debug(`Fetching slots for component: ${componentId}`);
    
    try {
      return await this.componentService.getComponentSlots(componentId, includeDeprecated);
    } catch (error) {
      logger.error(`Failed to fetch slots for component ${componentId}:`, error);
      throw error;
    }
  }

  // 统计查询
  @Query(() => Int, { description: 'Get total component count' })
  async componentCount(
    @Arg('filter', () => ComponentFilter, { nullable: true }) filter?: ComponentFilter
  ): Promise<number> {
    logger.debug('Fetching component count');
    
    try {
      return await this.componentService.getComponentCount(filter);
    } catch (error) {
      logger.error('Failed to fetch component count:', error);
      throw error;
    }
  }

  // 变更操作（如果需要）
  @Mutation(() => Boolean, { description: 'Refresh component cache' })
  async refreshComponentCache(): Promise<boolean> {
    logger.info('Refreshing component cache');
    
    try {
      await this.componentService.refreshCache();
      return true;
    } catch (error) {
      logger.error('Failed to refresh component cache:', error);
      return false;
    }
  }

  @Mutation(() => Boolean, { description: 'Rebuild component index' })
  async rebuildComponentIndex(): Promise<boolean> {
    logger.info('Rebuilding component index');
    
    try {
      await this.componentService.rebuildIndex();
      return true;
    } catch (error) {
      logger.error('Failed to rebuild component index:', error);
      return false;
    }
  }
}