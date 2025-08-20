import { Container } from 'typedi';
import { SubscriptionService } from '../services/subscription.service';
import {
  ComponentUpdateNotification,
  ManifestUpdateNotification,
  SystemStatusNotification,
} from '../schema/types';

describe('SubscriptionService Integration Tests', () => {
  let subscriptionService: SubscriptionService;

  beforeAll(async () => {
    // 设置测试环境变量
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    
    subscriptionService = Container.get(SubscriptionService);
    
    // 等待Redis连接
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await subscriptionService.cleanup();
  });

  describe('组件更新通知', () => {
    it('应该能够发布组件更新通知', async () => {
      const notification: ComponentUpdateNotification = {
        componentId: 'test-component-1',
        componentName: 'TestButton',
        updateType: 'updated',
        timestamp: new Date(),
        reason: 'Props updated',
        changedFields: ['props', 'events'],
      };

      // 发布通知应该成功
      await expect(
        subscriptionService.publishComponentUpdate(notification)
      ).resolves.not.toThrow();
    });

    it('应该能够发布批量组件更新', async () => {
      const notifications: ComponentUpdateNotification[] = [
        {
          componentId: 'comp-1',
          componentName: 'Button',
          updateType: 'created',
          timestamp: new Date(),
        },
        {
          componentId: 'comp-2',
          componentName: 'Input',
          updateType: 'updated',
          timestamp: new Date(),
        },
      ];

      await expect(
        subscriptionService.publishBatchComponentUpdates(notifications)
      ).resolves.not.toThrow();
    });
  });

  describe('清单更新通知', () => {
    it('应该能够发布清单更新通知', async () => {
      const notification: ManifestUpdateNotification = {
        manifestId: 'manifest-1',
        library: 'kpc',
        version: '2.0.0',
        updateType: 'updated',
        timestamp: new Date(),
        componentsAffected: 5,
        changedComponents: ['Button', 'Input', 'Modal'],
      };

      await expect(
        subscriptionService.publishManifestUpdate(notification)
      ).resolves.not.toThrow();
    });
  });

  describe('系统状态通知', () => {
    it('应该能够发布系统状态通知', async () => {
      const notification: SystemStatusNotification = {
        service: 'crawler',
        status: 'healthy',
        message: 'Crawling completed successfully',
        timestamp: new Date(),
        details: JSON.stringify({ componentsProcessed: 100 }),
      };

      await expect(
        subscriptionService.publishSystemStatus(notification)
      ).resolves.not.toThrow();
    });
  });

  describe('过滤器匹配', () => {
    it('应该正确匹配组件过滤器', () => {
      const notification: ComponentUpdateNotification = {
        componentId: 'button-1',
        componentName: 'Button',
        updateType: 'updated',
        timestamp: new Date(),
        component: {
          id: 'button-1',
          name: 'Button',
          category: 'form',
          frameworks: [
            { framework: 'react' as any, import: { module: '', named: '', default: false }, props: [], events: [], slots: [], examples: [] }
          ],
        } as any,
      };

      // 测试组件名称过滤
      const nameFilter = { componentNames: ['Button', 'Input'] };
      expect(subscriptionService.matchesComponentFilter(notification, nameFilter)).toBe(true);

      const wrongNameFilter = { componentNames: ['Modal', 'Table'] };
      expect(subscriptionService.matchesComponentFilter(notification, wrongNameFilter)).toBe(false);

      // 测试更新类型过滤
      const typeFilter = { updateTypes: ['updated', 'created'] };
      expect(subscriptionService.matchesComponentFilter(notification, typeFilter)).toBe(true);

      const wrongTypeFilter = { updateTypes: ['deleted'] };
      expect(subscriptionService.matchesComponentFilter(notification, wrongTypeFilter)).toBe(false);

      // 测试框架过滤
      const frameworkFilter = { frameworks: ['react' as any] };
      expect(subscriptionService.matchesComponentFilter(notification, frameworkFilter)).toBe(true);

      const wrongFrameworkFilter = { frameworks: ['vue' as any] };
      expect(subscriptionService.matchesComponentFilter(notification, wrongFrameworkFilter)).toBe(false);

      // 测试分类过滤
      const categoryFilter = { categories: ['form', 'layout'] };
      expect(subscriptionService.matchesComponentFilter(notification, categoryFilter)).toBe(true);

      const wrongCategoryFilter = { categories: ['navigation'] };
      expect(subscriptionService.matchesComponentFilter(notification, wrongCategoryFilter)).toBe(false);
    });

    it('应该正确匹配系统过滤器', () => {
      const notification: SystemStatusNotification = {
        service: 'crawler',
        status: 'healthy',
        message: 'Service is running',
        timestamp: new Date(),
      };

      // 测试服务过滤
      const serviceFilter = { services: ['crawler', 'parser'] };
      expect(subscriptionService.matchesSystemFilter(notification, serviceFilter)).toBe(true);

      const wrongServiceFilter = { services: ['api', 'validator'] };
      expect(subscriptionService.matchesSystemFilter(notification, wrongServiceFilter)).toBe(false);

      // 测试状态过滤
      const statusFilter = { statuses: ['healthy', 'warning'] };
      expect(subscriptionService.matchesSystemFilter(notification, statusFilter)).toBe(true);

      const wrongStatusFilter = { statuses: ['error'] };
      expect(subscriptionService.matchesSystemFilter(notification, wrongStatusFilter)).toBe(false);
    });
  });

  describe('订阅者管理', () => {
    it('应该能够管理订阅者', () => {
      const topic = 'TEST_TOPIC';
      const subscriberId1 = 'subscriber-1';
      const subscriberId2 = 'subscriber-2';

      // 添加订阅者
      subscriptionService.addSubscriber(topic, subscriberId1);
      subscriptionService.addSubscriber(topic, subscriberId2);

      expect(subscriptionService.getSubscriberCount(topic)).toBe(2);

      // 移除订阅者
      subscriptionService.removeSubscriber(topic, subscriberId1);
      expect(subscriptionService.getSubscriberCount(topic)).toBe(1);

      // 移除最后一个订阅者
      subscriptionService.removeSubscriber(topic, subscriberId2);
      expect(subscriptionService.getSubscriberCount(topic)).toBe(0);
    });

    it('应该能够获取所有订阅者', () => {
      const topic1 = 'TOPIC_1';
      const topic2 = 'TOPIC_2';

      subscriptionService.addSubscriber(topic1, 'sub-1');
      subscriptionService.addSubscriber(topic1, 'sub-2');
      subscriptionService.addSubscriber(topic2, 'sub-3');

      const allSubscribers = subscriptionService.getAllSubscribers();

      expect(allSubscribers.has(topic1)).toBe(true);
      expect(allSubscribers.has(topic2)).toBe(true);
      expect(allSubscribers.get(topic1)?.size).toBe(2);
      expect(allSubscribers.get(topic2)?.size).toBe(1);
    });
  });

  describe('健康检查', () => {
    it('应该能够执行健康检查', async () => {
      const isHealthy = await subscriptionService.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('异步迭代器', () => {
    it('应该能够创建组件更新迭代器', () => {
      const iterator = subscriptionService.componentUpdates();
      expect(iterator).toBeDefined();
      expect(typeof iterator[Symbol.asyncIterator]).toBe('function');
    });

    it('应该能够创建清单更新迭代器', () => {
      const iterator = subscriptionService.manifestUpdates();
      expect(iterator).toBeDefined();
      expect(typeof iterator[Symbol.asyncIterator]).toBe('function');
    });

    it('应该能够创建系统状态迭代器', () => {
      const iterator = subscriptionService.systemStatus();
      expect(iterator).toBeDefined();
      expect(typeof iterator[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理发布错误', async () => {
      // 创建一个无效的通知
      const invalidNotification = null as any;

      // 应该不抛出错误
      await expect(
        subscriptionService.publishComponentUpdate(invalidNotification)
      ).resolves.not.toThrow();
    });
  });
});