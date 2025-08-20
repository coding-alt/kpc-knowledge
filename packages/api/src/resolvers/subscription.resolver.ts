import { Resolver, Subscription, Arg, Root } from 'type-graphql';
import { Service } from 'typedi';
import {
  ComponentUpdateNotification,
  ManifestUpdateNotification,
  SystemStatusNotification,
  ComponentSubscriptionFilter,
  SystemSubscriptionFilter,
  CacheStats,
} from '../schema/types';
import { SubscriptionService } from '../services/subscription.service';
import { CacheService } from '../services/cache.service';
import { createLogger } from '@kpc/shared';

const logger = createLogger('SubscriptionResolver');

@Service()
@Resolver()
export class SubscriptionResolver {
  constructor(
    private subscriptionService: SubscriptionService,
    private cacheService: CacheService
  ) {}

  @Subscription(() => ComponentUpdateNotification, {
    description: 'Subscribe to component updates',
    topics: ['COMPONENT_UPDATED', 'COMPONENT_CREATED', 'COMPONENT_DELETED', 'COMPONENT_DEPRECATED'],
    filter: ({ payload, args }) => {
      const notification = payload as ComponentUpdateNotification;
      const filter = args.filter as ComponentSubscriptionFilter | undefined;
      
      return this.subscriptionService.matchesComponentFilter(notification, filter);
    },
  })
  componentUpdates(
    @Arg('filter', () => ComponentSubscriptionFilter, { nullable: true }) 
    filter?: ComponentSubscriptionFilter,
    @Root() notification?: ComponentUpdateNotification
  ) {
    logger.debug('Component updates subscription activated');
    return this.subscriptionService.componentUpdates(filter);
  }

  @Subscription(() => ManifestUpdateNotification, {
    description: 'Subscribe to manifest updates',
    topics: ['MANIFEST_UPDATED', 'MANIFEST_REBUILT'],
  })
  manifestUpdates(@Root() notification?: ManifestUpdateNotification) {
    logger.debug('Manifest updates subscription activated');
    return this.subscriptionService.manifestUpdates();
  }

  @Subscription(() => SystemStatusNotification, {
    description: 'Subscribe to system status changes',
    topics: ['SYSTEM_STATUS'],
    filter: ({ payload, args }) => {
      const notification = payload as SystemStatusNotification;
      const filter = args.filter as SystemSubscriptionFilter | undefined;
      
      return this.subscriptionService.matchesSystemFilter(notification, filter);
    },
  })
  systemStatus(
    @Arg('filter', () => SystemSubscriptionFilter, { nullable: true }) 
    filter?: SystemSubscriptionFilter,
    @Root() notification?: SystemStatusNotification
  ) {
    logger.debug('System status subscription activated');
    return this.subscriptionService.systemStatus(filter);
  }

  @Subscription(() => CacheStats, {
    description: 'Subscribe to cache statistics updates',
    topics: ['CACHE_STATS_UPDATED'],
  })
  async cacheStats(@Root() stats?: CacheStats) {
    logger.debug('Cache stats subscription activated');
    
    // 创建定期更新缓存统计的异步迭代器
    return this.createCacheStatsIterator();
  }

  private async *createCacheStatsIterator() {
    while (true) {
      try {
        const stats = await this.cacheService.getStats();
        yield stats;
        
        // 每30秒更新一次统计信息
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        logger.error('Error in cache stats iterator:', error);
        break;
      }
    }
  }

  // 实时查询订阅（用于实时搜索等场景）
  @Subscription(() => String, {
    description: 'Subscribe to real-time query results',
    topics: ['QUERY_RESULT_UPDATED'],
  })
  realTimeQuery(
    @Arg('queryId') queryId: string,
    @Root() result?: string
  ) {
    logger.debug(`Real-time query subscription activated for: ${queryId}`);
    
    // 这里可以实现实时查询结果的推送
    return this.createRealTimeQueryIterator(queryId);
  }

  private async *createRealTimeQueryIterator(queryId: string) {
    // 实现实时查询逻辑
    // 这里可以监听数据变化并推送更新的查询结果
    while (true) {
      try {
        // 检查查询结果是否有更新
        const cachedResult = await this.cacheService.get(`query:${queryId}`);
        if (cachedResult) {
          yield JSON.stringify(cachedResult);
        }
        
        // 每5秒检查一次
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.error(`Error in real-time query iterator for ${queryId}:`, error);
        break;
      }
    }
  }

  // 组件变更流订阅
  @Subscription(() => String, {
    description: 'Subscribe to component change stream',
    topics: ['COMPONENT_CHANGE_STREAM'],
  })
  componentChangeStream(
    @Arg('componentId', { nullable: true }) componentId?: string,
    @Root() change?: string
  ) {
    logger.debug('Component change stream subscription activated');
    
    return this.createComponentChangeStreamIterator(componentId);
  }

  private async *createComponentChangeStreamIterator(componentId?: string) {
    // 实现组件变更流逻辑
    while (true) {
      try {
        // 这里可以监听组件的实时变更
        const changeKey = componentId 
          ? `changes:component:${componentId}` 
          : 'changes:components:*';
          
        const changes = await this.cacheService.get(changeKey);
        if (changes) {
          yield JSON.stringify(changes);
        }
        
        // 每2秒检查一次变更
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error('Error in component change stream iterator:', error);
        break;
      }
    }
  }

  // 搜索结果实时更新订阅
  @Subscription(() => String, {
    description: 'Subscribe to search result updates',
    topics: ['SEARCH_RESULTS_UPDATED'],
  })
  searchResultsUpdated(
    @Arg('searchQuery') searchQuery: string,
    @Arg('searchId', { nullable: true }) searchId?: string,
    @Root() results?: string
  ) {
    logger.debug(`Search results subscription activated for: ${searchQuery}`);
    
    return this.createSearchResultsIterator(searchQuery, searchId);
  }

  private async *createSearchResultsIterator(searchQuery: string, searchId?: string) {
    const cacheKey = searchId || `search:${Buffer.from(searchQuery).toString('base64')}`;
    
    while (true) {
      try {
        // 检查搜索结果是否有更新
        const results = await this.cacheService.get(`${cacheKey}:results`);
        const lastUpdate = await this.cacheService.get(`${cacheKey}:timestamp`);
        
        if (results && lastUpdate) {
          yield JSON.stringify({
            query: searchQuery,
            results,
            timestamp: lastUpdate,
            searchId: searchId,
          });
        }
        
        // 每10秒检查一次搜索结果更新
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        logger.error(`Error in search results iterator for "${searchQuery}":`, error);
        break;
      }
    }
  }

  // 知识图谱更新订阅
  @Subscription(() => String, {
    description: 'Subscribe to knowledge graph updates',
    topics: ['GRAPH_UPDATED'],
  })
  graphUpdated(
    @Arg('nodeType', { nullable: true }) nodeType?: string,
    @Root() update?: string
  ) {
    logger.debug('Knowledge graph updates subscription activated');
    
    return this.createGraphUpdateIterator(nodeType);
  }

  private async *createGraphUpdateIterator(nodeType?: string) {
    while (true) {
      try {
        const updateKey = nodeType 
          ? `graph:updates:${nodeType}` 
          : 'graph:updates:all';
          
        const updates = await this.cacheService.get(updateKey);
        if (updates) {
          yield JSON.stringify(updates);
          
          // 清除已处理的更新
          await this.cacheService.del(updateKey);
        }
        
        // 每15秒检查一次图谱更新
        await new Promise(resolve => setTimeout(resolve, 15000));
      } catch (error) {
        logger.error('Error in graph update iterator:', error);
        break;
      }
    }
  }
}