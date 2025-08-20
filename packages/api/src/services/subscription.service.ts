import { Service } from 'typedi';
import { PubSub } from 'graphql-subscriptions';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'redis';
import { createLogger } from '@kpc/shared';
import {
  ComponentUpdateNotification,
  ManifestUpdateNotification,
  SystemStatusNotification,
  ComponentSubscriptionFilter,
  SystemSubscriptionFilter,
} from '../schema/types';

const logger = createLogger('SubscriptionService');

// 订阅主题常量
export const SUBSCRIPTION_TOPICS = {
  COMPONENT_UPDATED: 'COMPONENT_UPDATED',
  COMPONENT_CREATED: 'COMPONENT_CREATED',
  COMPONENT_DELETED: 'COMPONENT_DELETED',
  COMPONENT_DEPRECATED: 'COMPONENT_DEPRECATED',
  MANIFEST_UPDATED: 'MANIFEST_UPDATED',
  MANIFEST_REBUILT: 'MANIFEST_REBUILT',
  SYSTEM_STATUS: 'SYSTEM_STATUS',
  CACHE_INVALIDATED: 'CACHE_INVALIDATED',
} as const;

export type SubscriptionTopic = typeof SUBSCRIPTION_TOPICS[keyof typeof SUBSCRIPTION_TOPICS];

@Service()
export class SubscriptionService {
  private pubSub: PubSub;
  private subscribers = new Map<string, Set<string>>();

  constructor() {
    this.initializePubSub();
  }

  private initializePubSub(): void {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      // 使用Redis作为PubSub后端以支持多实例
      const publisher = Redis.createClient({ url: redisUrl });
      const subscriber = Redis.createClient({ url: redisUrl });

      this.pubSub = new RedisPubSub({
        publisher,
        subscriber,
        messageEventName: 'message',
        pmessageEventName: 'pmessage',
      });

      logger.info('Redis PubSub initialized');
    } catch (error) {
      logger.warn('Failed to initialize Redis PubSub, falling back to in-memory:', error);
      this.pubSub = new PubSub();
    }
  }

  // 组件更新通知
  async publishComponentUpdate(notification: ComponentUpdateNotification): Promise<void> {
    try {
      const topic = this.getComponentUpdateTopic(notification.updateType);
      await this.pubSub.publish(topic, notification);
      
      logger.debug(`Published component update: ${notification.componentName} (${notification.updateType})`);
    } catch (error) {
      logger.error('Failed to publish component update:', error);
    }
  }

  // 清单更新通知
  async publishManifestUpdate(notification: ManifestUpdateNotification): Promise<void> {
    try {
      const topic = this.getManifestUpdateTopic(notification.updateType);
      await this.pubSub.publish(topic, notification);
      
      logger.debug(`Published manifest update: ${notification.library} v${notification.version}`);
    } catch (error) {
      logger.error('Failed to publish manifest update:', error);
    }
  }

  // 系统状态通知
  async publishSystemStatus(notification: SystemStatusNotification): Promise<void> {
    try {
      await this.pubSub.publish(SUBSCRIPTION_TOPICS.SYSTEM_STATUS, notification);
      
      logger.debug(`Published system status: ${notification.service} - ${notification.status}`);
    } catch (error) {
      logger.error('Failed to publish system status:', error);
    }
  }

  // 组件订阅
  componentUpdates(filter?: ComponentSubscriptionFilter) {
    return this.pubSub.asyncIterator([
      SUBSCRIPTION_TOPICS.COMPONENT_UPDATED,
      SUBSCRIPTION_TOPICS.COMPONENT_CREATED,
      SUBSCRIPTION_TOPICS.COMPONENT_DELETED,
      SUBSCRIPTION_TOPICS.COMPONENT_DEPRECATED,
    ]);
  }

  // 清单订阅
  manifestUpdates() {
    return this.pubSub.asyncIterator([
      SUBSCRIPTION_TOPICS.MANIFEST_UPDATED,
      SUBSCRIPTION_TOPICS.MANIFEST_REBUILT,
    ]);
  }

  // 系统状态订阅
  systemStatus(filter?: SystemSubscriptionFilter) {
    return this.pubSub.asyncIterator([SUBSCRIPTION_TOPICS.SYSTEM_STATUS]);
  }

  // 过滤器匹配逻辑
  matchesComponentFilter(
    notification: ComponentUpdateNotification,
    filter?: ComponentSubscriptionFilter
  ): boolean {
    if (!filter) return true;

    // 检查组件名称
    if (filter.componentNames && filter.componentNames.length > 0) {
      if (!filter.componentNames.includes(notification.componentName)) {
        return false;
      }
    }

    // 检查更新类型
    if (filter.updateTypes && filter.updateTypes.length > 0) {
      if (!filter.updateTypes.includes(notification.updateType)) {
        return false;
      }
    }

    // 检查框架
    if (filter.frameworks && filter.frameworks.length > 0 && notification.component) {
      const componentFrameworks = notification.component.frameworks.map(f => f.framework);
      const hasMatchingFramework = filter.frameworks.some(f => 
        componentFrameworks.includes(f)
      );
      if (!hasMatchingFramework) {
        return false;
      }
    }

    // 检查分类
    if (filter.categories && filter.categories.length > 0 && notification.component) {
      if (!filter.categories.includes(notification.component.category)) {
        return false;
      }
    }

    return true;
  }

  matchesSystemFilter(
    notification: SystemStatusNotification,
    filter?: SystemSubscriptionFilter
  ): boolean {
    if (!filter) return true;

    // 检查服务
    if (filter.services && filter.services.length > 0) {
      if (!filter.services.includes(notification.service)) {
        return false;
      }
    }

    // 检查状态
    if (filter.statuses && filter.statuses.length > 0) {
      if (!filter.statuses.includes(notification.status)) {
        return false;
      }
    }

    return true;
  }

  // 辅助方法
  private getComponentUpdateTopic(updateType: string): SubscriptionTopic {
    switch (updateType) {
      case 'created':
        return SUBSCRIPTION_TOPICS.COMPONENT_CREATED;
      case 'updated':
        return SUBSCRIPTION_TOPICS.COMPONENT_UPDATED;
      case 'deleted':
        return SUBSCRIPTION_TOPICS.COMPONENT_DELETED;
      case 'deprecated':
        return SUBSCRIPTION_TOPICS.COMPONENT_DEPRECATED;
      default:
        return SUBSCRIPTION_TOPICS.COMPONENT_UPDATED;
    }
  }

  private getManifestUpdateTopic(updateType: string): SubscriptionTopic {
    switch (updateType) {
      case 'updated':
        return SUBSCRIPTION_TOPICS.MANIFEST_UPDATED;
      case 'rebuilt':
        return SUBSCRIPTION_TOPICS.MANIFEST_REBUILT;
      default:
        return SUBSCRIPTION_TOPICS.MANIFEST_UPDATED;
    }
  }

  // 订阅者管理
  addSubscriber(topic: string, subscriberId: string): void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(subscriberId);
    
    logger.debug(`Added subscriber ${subscriberId} to topic ${topic}`);
  }

  removeSubscriber(topic: string, subscriberId: string): void {
    const topicSubscribers = this.subscribers.get(topic);
    if (topicSubscribers) {
      topicSubscribers.delete(subscriberId);
      if (topicSubscribers.size === 0) {
        this.subscribers.delete(topic);
      }
    }
    
    logger.debug(`Removed subscriber ${subscriberId} from topic ${topic}`);
  }

  getSubscriberCount(topic: string): number {
    return this.subscribers.get(topic)?.size || 0;
  }

  getAllSubscribers(): Map<string, Set<string>> {
    return new Map(this.subscribers);
  }

  // 批量通知
  async publishBatchComponentUpdates(notifications: ComponentUpdateNotification[]): Promise<void> {
    const promises = notifications.map(notification => 
      this.publishComponentUpdate(notification)
    );
    
    try {
      await Promise.all(promises);
      logger.info(`Published ${notifications.length} component update notifications`);
    } catch (error) {
      logger.error('Failed to publish batch component updates:', error);
    }
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      // 发送测试消息
      const testNotification: SystemStatusNotification = {
        service: 'subscription',
        status: 'healthy',
        message: 'Health check',
        timestamp: new Date(),
      };

      await this.pubSub.publish('HEALTH_CHECK', testNotification);
      return true;
    } catch (error) {
      logger.error('Subscription service health check failed:', error);
      return false;
    }
  }

  // 清理资源
  async cleanup(): Promise<void> {
    try {
      this.subscribers.clear();
      logger.info('Subscription service cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup subscription service:', error);
    }
  }
}