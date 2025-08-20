import { Service } from 'typedi';
import { createLogger } from '@kpc/shared';
import {
  SearchResult,
  SearchFilter,
  PaginatedSearchResults,
  PaginationInput,
} from '../schema/types';
import { CacheService } from './cache.service';
import { SubscriptionService } from './subscription.service';

const logger = createLogger('SearchService');

@Service()
export class SearchService {
  constructor(
    private cacheService: CacheService,
    private subscriptionService: SubscriptionService
  ) {}

  async search(
    query: string,
    filter?: SearchFilter,
    limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching for: ${query}`);

    const cacheKey = `search:${Buffer.from(query).toString('base64')}:${JSON.stringify(filter)}:${limit}`;
    
    // 尝试从缓存获取
    const cached = await this.cacheService.get<SearchResult[]>(cacheKey, { ttl: 180 });
    if (cached) {
      return cached;
    }

    // 执行搜索逻辑
    const results = await this.performSearch(query, filter, limit);
    
    // 缓存结果
    await this.cacheService.set(cacheKey, results, { ttl: 180 });

    return results;
  }

  async paginatedSearch(
    query: string,
    filter?: SearchFilter,
    pagination?: PaginationInput
  ): Promise<PaginatedSearchResults> {
    logger.debug(`Paginated search for: ${query}`);

    const cacheKey = `search:paginated:${Buffer.from(query).toString('base64')}:${JSON.stringify({ filter, pagination })}`;
    
    const cached = await this.cacheService.get<PaginatedSearchResults>(cacheKey, { ttl: 180 });
    if (cached) {
      return cached;
    }

    const results = await this.performPaginatedSearch(query, filter, pagination);
    
    await this.cacheService.set(cacheKey, results, { ttl: 180 });

    return results;
  }

  async semanticSearch(
    query: string,
    threshold: number,
    limit: number,
    filter?: SearchFilter
  ): Promise<SearchResult[]> {
    logger.debug(`Semantic search for: ${query}`);

    const cacheKey = `search:semantic:${Buffer.from(query).toString('base64')}:${threshold}:${limit}:${JSON.stringify(filter)}`;
    
    const cached = await this.cacheService.get<SearchResult[]>(cacheKey, { ttl: 300 });
    if (cached) {
      return cached;
    }

    const results = await this.performSemanticSearch(query, threshold, limit, filter);
    
    await this.cacheService.set(cacheKey, results, { ttl: 300 });

    return results;
  }

  async searchByProps(
    propName: string,
    propType?: string,
    framework?: string,
    limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching by prop: ${propName}`);

    const cacheKey = `search:props:${propName}:${propType}:${framework}:${limit}`;
    
    const cached = await this.cacheService.get<SearchResult[]>(cacheKey, { ttl: 300 });
    if (cached) {
      return cached;
    }

    const results = await this.performPropSearch(propName, propType, framework, limit);
    
    await this.cacheService.set(cacheKey, results, { ttl: 300 });

    return results;
  }

  async searchByEvents(
    eventName: string,
    framework?: string,
    limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching by event: ${eventName}`);

    const cacheKey = `search:events:${eventName}:${framework}:${limit}`;
    
    const cached = await this.cacheService.get<SearchResult[]>(cacheKey, { ttl: 300 });
    if (cached) {
      return cached;
    }

    const results = await this.performEventSearch(eventName, framework, limit);
    
    await this.cacheService.set(cacheKey, results, { ttl: 300 });

    return results;
  }

  async searchExamples(
    query: string,
    framework?: string,
    category?: string,
    limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching examples for: ${query}`);

    const cacheKey = `search:examples:${Buffer.from(query).toString('base64')}:${framework}:${category}:${limit}`;
    
    const cached = await this.cacheService.get<SearchResult[]>(cacheKey, { ttl: 240 });
    if (cached) {
      return cached;
    }

    const results = await this.performExampleSearch(query, framework, category, limit);
    
    await this.cacheService.set(cacheKey, results, { ttl: 240 });

    return results;
  }

  async getSuggestions(query: string, limit?: number): Promise<string[]> {
    logger.debug(`Getting suggestions for: ${query}`);

    const cacheKey = `search:suggestions:${Buffer.from(query).toString('base64')}:${limit}`;
    
    const cached = await this.cacheService.get<string[]>(cacheKey, { ttl: 600 });
    if (cached) {
      return cached;
    }

    const suggestions = await this.generateSuggestions(query, limit);
    
    await this.cacheService.set(cacheKey, suggestions, { ttl: 600 });

    return suggestions;
  }

  async getPopularTerms(limit?: number): Promise<string[]> {
    logger.debug('Getting popular search terms');

    const cacheKey = `search:popular:${limit}`;
    
    const cached = await this.cacheService.get<string[]>(cacheKey, { ttl: 3600 });
    if (cached) {
      return cached;
    }

    const terms = await this.getPopularSearchTerms(limit);
    
    await this.cacheService.set(cacheKey, terms, { ttl: 3600 });

    return terms;
  }

  async advancedSearch(criteria: any, limit?: number): Promise<SearchResult[]> {
    logger.debug('Performing advanced search');

    const cacheKey = `search:advanced:${JSON.stringify(criteria)}:${limit}`;
    
    const cached = await this.cacheService.get<SearchResult[]>(cacheKey, { ttl: 180 });
    if (cached) {
      return cached;
    }

    const results = await this.performAdvancedSearch(criteria, limit);
    
    await this.cacheService.set(cacheKey, results, { ttl: 180 });

    return results;
  }

  async getSearchCount(query: string, filter?: SearchFilter): Promise<number> {
    logger.debug(`Getting search count for: ${query}`);

    const cacheKey = `search:count:${Buffer.from(query).toString('base64')}:${JSON.stringify(filter)}`;
    
    const cached = await this.cacheService.get<number>(cacheKey, { ttl: 300 });
    if (cached !== null) {
      return cached;
    }

    const count = await this.performSearchCount(query, filter);
    
    await this.cacheService.set(cacheKey, count, { ttl: 300 });

    return count;
  }

  // 私有方法 - 实际搜索实现
  private async performSearch(
    query: string,
    filter?: SearchFilter,
    limit?: number
  ): Promise<SearchResult[]> {
    // 模拟搜索实现
    // 在实际实现中，这里会调用Milvus向量搜索
    const mockResults: SearchResult[] = [
      {
        content: `Mock search result for "${query}"`,
        score: 0.95,
        metadata: {
          componentName: 'Button',
          framework: 'react' as any,
          sourceRef: {
            filePath: '/components/Button.tsx',
            startLine: 1,
            endLine: 50,
            url: 'https://github.com/example/repo/blob/main/components/Button.tsx',
          },
          type: 'component',
        },
      },
    ];

    return mockResults.slice(0, limit || 20);
  }

  private async performPaginatedSearch(
    query: string,
    filter?: SearchFilter,
    pagination?: PaginationInput
  ): Promise<PaginatedSearchResults> {
    const allResults = await this.performSearch(query, filter, 1000);
    const { offset = 0, limit = 20 } = pagination || {};
    
    const items = allResults.slice(offset, offset + limit);
    const total = allResults.length;
    const hasMore = offset + limit < total;

    return {
      items,
      total,
      offset,
      limit,
      hasMore,
    };
  }

  private async performSemanticSearch(
    query: string,
    threshold: number,
    limit: number,
    filter?: SearchFilter
  ): Promise<SearchResult[]> {
    // 模拟语义搜索
    const results = await this.performSearch(query, filter, limit);
    return results.filter(r => r.score >= threshold);
  }

  private async performPropSearch(
    propName: string,
    propType?: string,
    framework?: string,
    limit?: number
  ): Promise<SearchResult[]> {
    // 模拟属性搜索
    return [];
  }

  private async performEventSearch(
    eventName: string,
    framework?: string,
    limit?: number
  ): Promise<SearchResult[]> {
    // 模拟事件搜索
    return [];
  }

  private async performExampleSearch(
    query: string,
    framework?: string,
    category?: string,
    limit?: number
  ): Promise<SearchResult[]> {
    // 模拟示例搜索
    return [];
  }

  private async generateSuggestions(query: string, limit?: number): Promise<string[]> {
    // 模拟搜索建议
    const suggestions = [
      `${query} component`,
      `${query} props`,
      `${query} events`,
      `${query} examples`,
    ];

    return suggestions.slice(0, limit || 5);
  }

  private async getPopularSearchTerms(limit?: number): Promise<string[]> {
    // 模拟热门搜索词
    const terms = [
      'Button',
      'Input',
      'Modal',
      'Table',
      'Form',
      'Card',
      'Menu',
      'Dropdown',
    ];

    return terms.slice(0, limit || 10);
  }

  private async performAdvancedSearch(criteria: any, limit?: number): Promise<SearchResult[]> {
    // 模拟高级搜索
    return [];
  }

  private async performSearchCount(query: string, filter?: SearchFilter): Promise<number> {
    const results = await this.performSearch(query, filter, 10000);
    return results.length;
  }

  // 缓存失效
  async invalidateSearchCache(): Promise<void> {
    await this.cacheService.invalidatePattern('search:*');
    logger.info('Search cache invalidated');
  }
}