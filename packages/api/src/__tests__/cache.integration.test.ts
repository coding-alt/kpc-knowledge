import { Container } from 'typedi';
import { CacheService } from '../services/cache.service';

describe('CacheService Integration Tests', () => {
  let cacheService: CacheService;

  beforeAll(async () => {
    // 设置测试环境变量
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    
    cacheService = Container.get(CacheService);
    
    // 等待Redis连接
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // 清理测试数据
    await cacheService.flush();
    await cacheService.disconnect();
  });

  beforeEach(async () => {
    // 每个测试前清空缓存
    await cacheService.flush();
  });

  describe('基本缓存操作', () => {
    it('应该能够设置和获取缓存值', async () => {
      const key = 'test:key';
      const value = { message: 'Hello, World!' };

      // 设置缓存
      const setResult = await cacheService.set(key, value);
      expect(setResult).toBe(true);

      // 获取缓存
      const cachedValue = await cacheService.get(key);
      expect(cachedValue).toEqual(value);
    });

    it('应该能够设置带TTL的缓存', async () => {
      const key = 'test:ttl';
      const value = 'expires soon';

      // 设置1秒TTL
      await cacheService.set(key, value, { ttl: 1 });

      // 立即获取应该成功
      const immediate = await cacheService.get(key);
      expect(immediate).toBe(value);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 过期后应该返回null
      const expired = await cacheService.get(key);
      expect(expired).toBeNull();
    });

    it('应该能够删除缓存', async () => {
      const key = 'test:delete';
      const value = 'to be deleted';

      await cacheService.set(key, value);
      
      // 确认存在
      const exists = await cacheService.exists(key);
      expect(exists).toBe(true);

      // 删除
      const deleted = await cacheService.del(key);
      expect(deleted).toBe(true);

      // 确认不存在
      const notExists = await cacheService.exists(key);
      expect(notExists).toBe(false);
    });
  });

  describe('批量操作', () => {
    it('应该能够批量设置和获取', async () => {
      const keyValuePairs = [
        { key: 'batch:1', value: 'value1' },
        { key: 'batch:2', value: 'value2' },
        { key: 'batch:3', value: 'value3' },
      ];

      // 批量设置
      const msetResult = await cacheService.mset(keyValuePairs);
      expect(msetResult).toBe(true);

      // 批量获取
      const keys = keyValuePairs.map(pair => pair.key);
      const values = await cacheService.mget(keys);

      expect(values).toEqual(['value1', 'value2', 'value3']);
    });
  });

  describe('模式匹配删除', () => {
    it('应该能够按模式删除缓存', async () => {
      // 设置多个相关缓存
      await cacheService.set('component:1:props', 'props1');
      await cacheService.set('component:1:events', 'events1');
      await cacheService.set('component:2:props', 'props2');
      await cacheService.set('other:key', 'other');

      // 按模式删除
      const deletedCount = await cacheService.invalidatePattern('component:1:*');
      expect(deletedCount).toBe(2);

      // 验证删除结果
      const props1 = await cacheService.get('component:1:props');
      const events1 = await cacheService.get('component:1:events');
      const props2 = await cacheService.get('component:2:props');
      const other = await cacheService.get('other:key');

      expect(props1).toBeNull();
      expect(events1).toBeNull();
      expect(props2).toBe('props2');
      expect(other).toBe('other');
    });
  });

  describe('缓存装饰器', () => {
    it('应该能够使用cached方法', async () => {
      const key = 'test:cached';
      let callCount = 0;

      const fetcher = async () => {
        callCount++;
        return `result-${callCount}`;
      };

      // 第一次调用应该执行fetcher
      const result1 = await cacheService.cached(key, fetcher, { ttl: 60 });
      expect(result1).toBe('result-1');
      expect(callCount).toBe(1);

      // 第二次调用应该从缓存获取
      const result2 = await cacheService.cached(key, fetcher, { ttl: 60 });
      expect(result2).toBe('result-1');
      expect(callCount).toBe(1); // 没有增加
    });
  });

  describe('统计信息', () => {
    it('应该能够获取缓存统计', async () => {
      // 执行一些缓存操作
      await cacheService.set('stats:test1', 'value1');
      await cacheService.set('stats:test2', 'value2');
      await cacheService.get('stats:test1'); // hit
      await cacheService.get('stats:nonexistent'); // miss

      const stats = await cacheService.getStats();

      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.totalMisses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.totalKeys).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('组件缓存失效', () => {
    it('应该能够失效组件相关缓存', async () => {
      const componentId = 'test-component';

      // 设置组件相关缓存
      await cacheService.set(`component:${componentId}:data`, 'component data');
      await cacheService.set(`components:list`, 'components list');
      await cacheService.set(`search:component-query`, 'search results');
      await cacheService.set(`related:${componentId}:similar`, 'related components');

      // 失效组件缓存
      await cacheService.invalidateComponent(componentId);

      // 验证相关缓存已失效
      const componentData = await cacheService.get(`component:${componentId}:data`);
      const componentsList = await cacheService.get('components:list');
      const searchResults = await cacheService.get('search:component-query');
      const relatedComponents = await cacheService.get(`related:${componentId}:similar`);

      expect(componentData).toBeNull();
      expect(componentsList).toBeNull();
      expect(searchResults).toBeNull();
      expect(relatedComponents).toBeNull();
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理Redis连接错误', async () => {
      // 模拟Redis连接断开
      await cacheService.disconnect();

      // 操作应该返回默认值而不是抛出错误
      const getResult = await cacheService.get('test:key');
      expect(getResult).toBeNull();

      const setResult = await cacheService.set('test:key', 'value');
      expect(setResult).toBe(false);

      const delResult = await cacheService.del('test:key');
      expect(delResult).toBe(false);
    });
  });
});