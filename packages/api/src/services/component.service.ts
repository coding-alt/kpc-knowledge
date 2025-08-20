import { Service } from 'typedi';
import { createLogger } from '@kpc/shared';
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
import { CacheService } from './cache.service';
import { SubscriptionService } from './subscription.service';

const logger = createLogger('ComponentService');

@Service()
export class ComponentService {
  private components: Map<string, ComponentSpec> = new Map();
  private componentsByName: Map<string, ComponentSpec[]> = new Map();
  private componentsByCategory: Map<string, ComponentSpec[]> = new Map();
  private lastCacheUpdate: Date = new Date();

  constructor(
    private cacheService: CacheService,
    private subscriptionService: SubscriptionService
  ) {
    // 初始化时加载组件数据
    this.loadComponents();
  }

  async findComponents(
    filter?: ComponentFilter,
    pagination?: PaginationInput,
    sort?: SortInput
  ): Promise<ComponentSpec[]> {
    logger.debug('Finding components with filter:', filter);

    // 生成缓存键
    const cacheKey = `components:${JSON.stringify({ filter, pagination, sort })}`;
    
    // 尝试从缓存获取
    const cached = await this.cacheService.get<ComponentSpec[]>(cacheKey, { ttl: 300 });
    if (cached) {
      return cached;
    }

    let components = Array.from(this.components.values());

    // 应用过滤器
    if (filter) {
      components = this.applyFilter(components, filter);
    }

    // 应用排序
    if (sort) {
      components = this.applySort(components, sort);
    }

    // 应用分页
    if (pagination) {
      const { offset = 0, limit = 20 } = pagination;
      components = components.slice(offset, offset + limit);
    }

    // 缓存结果
    await this.cacheService.set(cacheKey, components, { ttl: 300 });

    return components;
  }

  async findPaginatedComponents(
    filter?: ComponentFilter,
    pagination?: PaginationInput,
    sort?: SortInput
  ): Promise<PaginatedComponents> {
    logger.debug('Finding paginated components');

    let allComponents = Array.from(this.components.values());

    // 应用过滤器
    if (filter) {
      allComponents = this.applyFilter(allComponents, filter);
    }

    const total = allComponents.length;

    // 应用排序
    if (sort) {
      allComponents = this.applySort(allComponents, sort);
    }

    // 应用分页
    const { offset = 0, limit = 20 } = pagination || {};
    const items = allComponents.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      items,
      total,
      offset,
      limit,
      hasMore,
    };
  }

  async findById(id: string): Promise<ComponentSpec | null> {
    logger.debug(`Finding component by ID: ${id}`);
    
    // 尝试从缓存获取
    const cacheKey = `component:${id}`;
    const cached = await this.cacheService.get<ComponentSpec>(cacheKey, { ttl: 600 });
    if (cached) {
      return cached;
    }

    const component = this.components.get(id) || null;
    
    // 缓存结果
    if (component) {
      await this.cacheService.set(cacheKey, component, { ttl: 600 });
    }

    return component;
  }

  async findByName(name: string, framework?: string): Promise<ComponentSpec | null> {
    logger.debug(`Finding component by name: ${name}, framework: ${framework}`);

    const components = this.componentsByName.get(name.toLowerCase()) || [];
    
    if (framework) {
      return components.find(c => 
        c.frameworks.some(f => f.framework === framework)
      ) || null;
    }

    return components[0] || null;
  }

  async findByCategory(category: string, framework?: string): Promise<ComponentSpec[]> {
    logger.debug(`Finding components by category: ${category}, framework: ${framework}`);

    let components = this.componentsByCategory.get(category.toLowerCase()) || [];

    if (framework) {
      components = components.filter(c => 
        c.frameworks.some(f => f.framework === framework)
      );
    }

    return components;
  }

  async getCategories(): Promise<string[]> {
    logger.debug('Getting component categories');
    return Array.from(this.componentsByCategory.keys());
  }

  async findRelatedComponents(componentId: string, limit: number): Promise<ComponentSpec[]> {
    logger.debug(`Finding related components for: ${componentId}`);

    const component = this.components.get(componentId);
    if (!component) {
      return [];
    }

    // 查找相同类别的组件
    const sameCategory = this.componentsByCategory.get(component.category.toLowerCase()) || [];
    
    // 排除自己，按相似度排序
    const related = sameCategory
      .filter(c => c.id !== componentId)
      .slice(0, limit);

    return related;
  }

  async findSimilarComponents(
    componentId: string, 
    threshold: number, 
    limit: number
  ): Promise<ComponentSpec[]> {
    logger.debug(`Finding similar components for: ${componentId}`);

    const component = this.components.get(componentId);
    if (!component) {
      return [];
    }

    const allComponents = Array.from(this.components.values());
    const similar: Array<{ component: ComponentSpec; similarity: number }> = [];

    for (const other of allComponents) {
      if (other.id === componentId) continue;

      const similarity = this.calculateSimilarity(component, other);
      if (similarity >= threshold) {
        similar.push({ component: other, similarity });
      }
    }

    // 按相似度排序并限制数量
    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.component);
  }

  async findDeprecatedComponents(framework?: string): Promise<ComponentSpec[]> {
    logger.debug('Finding deprecated components');

    let components = Array.from(this.components.values());

    // 过滤废弃的组件
    components = components.filter(c => 
      c.version.deprecated !== undefined
    );

    // 按框架过滤
    if (framework) {
      components = components.filter(c => 
        c.frameworks.some(f => f.framework === framework)
      );
    }

    return components;
  }

  async getComponentProps(componentId: string, includeDeprecated: boolean): Promise<PropDefinition[]> {
    logger.debug(`Getting props for component: ${componentId}`);

    const component = this.components.get(componentId);
    if (!component) {
      return [];
    }

    let props = component.props;

    if (!includeDeprecated) {
      props = props.filter(p => !p.deprecated);
    }

    return props;
  }

  async getComponentEvents(componentId: string, includeDeprecated: boolean): Promise<EventDefinition[]> {
    logger.debug(`Getting events for component: ${componentId}`);

    const component = this.components.get(componentId);
    if (!component) {
      return [];
    }

    let events = component.events;

    if (!includeDeprecated) {
      events = events.filter(e => !e.deprecated);
    }

    return events;
  }

  async getComponentSlots(componentId: string, includeDeprecated: boolean): Promise<SlotDefinition[]> {
    logger.debug(`Getting slots for component: ${componentId}`);

    const component = this.components.get(componentId);
    if (!component) {
      return [];
    }

    let slots = component.slots;

    if (!includeDeprecated) {
      slots = slots.filter(s => !s.deprecated);
    }

    return slots;
  }

  async getComponentCount(filter?: ComponentFilter): Promise<number> {
    logger.debug('Getting component count');

    let components = Array.from(this.components.values());

    if (filter) {
      components = this.applyFilter(components, filter);
    }

    return components.length;
  }

  async refreshCache(): Promise<void> {
    logger.info('Refreshing component cache');
    
    // 清空内存缓存
    this.components.clear();
    this.componentsByName.clear();
    this.componentsByCategory.clear();
    
    // 清空Redis缓存
    await this.cacheService.invalidatePattern('components:*');
    await this.cacheService.invalidatePattern('component:*');
    
    // 重新加载
    await this.loadComponents();
    this.lastCacheUpdate = new Date();

    // 发布缓存刷新通知
    await this.subscriptionService.publishSystemStatus({
      service: 'component',
      status: 'healthy',
      message: 'Component cache refreshed',
      timestamp: new Date(),
    });
  }

  async rebuildIndex(): Promise<void> {
    logger.info('Rebuilding component index');
    
    // 重建索引
    this.buildIndexes();
  }

  private async loadComponents(): Promise<void> {
    logger.info('Loading components from data source');

    try {
      // 这里应该从实际的数据源加载组件
      // 例如从数据库、文件系统或API
      const mockComponents = this.generateMockComponents();
      
      for (const component of mockComponents) {
        this.components.set(component.id, component);
      }

      this.buildIndexes();
      
      logger.info(`Loaded ${this.components.size} components`);

    } catch (error) {
      logger.error('Failed to load components:', error);
      throw error;
    }
  }

  private buildIndexes(): void {
    logger.debug('Building component indexes');

    // 清空现有索引
    this.componentsByName.clear();
    this.componentsByCategory.clear();

    // 重建索引
    for (const component of this.components.values()) {
      // 按名称索引
      const nameKey = component.name.toLowerCase();
      if (!this.componentsByName.has(nameKey)) {
        this.componentsByName.set(nameKey, []);
      }
      this.componentsByName.get(nameKey)!.push(component);

      // 按类别索引
      const categoryKey = component.category.toLowerCase();
      if (!this.componentsByCategory.has(categoryKey)) {
        this.componentsByCategory.set(categoryKey, []);
      }
      this.componentsByCategory.get(categoryKey)!.push(component);
    }

    logger.debug('Component indexes built successfully');
  }

  private applyFilter(components: ComponentSpec[], filter: ComponentFilter): ComponentSpec[] {
    return components.filter(component => {
      if (filter.name && !component.name.toLowerCase().includes(filter.name.toLowerCase())) {
        return false;
      }

      if (filter.framework && !component.frameworks.some(f => f.framework === filter.framework)) {
        return false;
      }

      if (filter.category && component.category.toLowerCase() !== filter.category.toLowerCase()) {
        return false;
      }

      if (filter.deprecated !== undefined) {
        const isDeprecated = component.version.deprecated !== undefined;
        if (filter.deprecated !== isDeprecated) {
          return false;
        }
      }

      return true;
    });
  }

  private applySort(components: ComponentSpec[], sort: SortInput): ComponentSpec[] {
    return components.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sort.field) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'createdAt':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case 'updatedAt':
          aValue = a.updatedAt;
          bValue = b.updatedAt;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sort.direction === 'ASC' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sort.direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  private calculateSimilarity(comp1: ComponentSpec, comp2: ComponentSpec): number {
    let similarity = 0;
    let factors = 0;

    // 类别相似度
    if (comp1.category === comp2.category) {
      similarity += 0.3;
    }
    factors++;

    // 框架相似度
    const frameworks1 = new Set(comp1.frameworks.map(f => f.framework));
    const frameworks2 = new Set(comp2.frameworks.map(f => f.framework));
    const frameworkIntersection = new Set([...frameworks1].filter(f => frameworks2.has(f)));
    const frameworkUnion = new Set([...frameworks1, ...frameworks2]);
    
    if (frameworkUnion.size > 0) {
      similarity += (frameworkIntersection.size / frameworkUnion.size) * 0.2;
    }
    factors++;

    // 属性相似度
    const props1 = new Set(comp1.props.map(p => p.name));
    const props2 = new Set(comp2.props.map(p => p.name));
    const propIntersection = new Set([...props1].filter(p => props2.has(p)));
    const propUnion = new Set([...props1, ...props2]);
    
    if (propUnion.size > 0) {
      similarity += (propIntersection.size / propUnion.size) * 0.3;
    }
    factors++;

    // 事件相似度
    const events1 = new Set(comp1.events.map(e => e.name));
    const events2 = new Set(comp2.events.map(e => e.name));
    const eventIntersection = new Set([...events1].filter(e => events2.has(e)));
    const eventUnion = new Set([...events1, ...events2]);
    
    if (eventUnion.size > 0) {
      similarity += (eventIntersection.size / eventUnion.size) * 0.2;
    }
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  private generateMockComponents(): ComponentSpec[] {
    // 生成模拟组件数据用于测试
    const now = new Date();
    
    return [
      {
        id: '1',
        name: 'Button',
        alias: ['Btn'],
        import: { module: '@kpc/react', named: 'Button', default: false },
        category: 'form',
        description: 'A versatile button component',
        frameworks: [],
        props: [],
        events: [],
        slots: [],
        styleTokens: [],
        composability: [],
        antiPatterns: [],
        version: { since: '1.0.0' },
        sourceRefs: [],
        createdAt: now,
        updatedAt: now,
      },
      // 添加更多模拟组件...
    ];
  }
}