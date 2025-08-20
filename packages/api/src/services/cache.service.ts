import { Service } from 'typedi';
import Redis from 'redis';
import { createLogger } from '@kpc/shared';
import { CacheStats } from '../schema/types';

const logger = createLogger('CacheService');

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  serialize?: boolean;
}

@Service()
export class CacheService {
  private client: Redis.RedisClientType;
  private connected = false;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  constructor() {
    this.client = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_delay_on_failover: 100,
      retry_delay_on_cluster_down: 300,
      max_attempts: 3,
    });

    this.setupEventHandlers();
    this.connect();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.connected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.connected = false;
    });

    this.client.on('end', () => {
      logger.warn('Redis client connection ended');
      this.connected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
    }
  }

  private buildKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || process.env.CACHE_PREFIX || 'kpc';
    return `${keyPrefix}:${key}`;
  }

  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.connected) {
      logger.warn('Redis not connected, cache miss');
      this.stats.misses++;
      return null;
    }

    try {
      const cacheKey = this.buildKey(key, options.prefix);
      const value = await this.client.get(cacheKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      if (options.serialize !== false) {
        return JSON.parse(value) as T;
      }
      
      return value as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  async set<T = any>(
    key: string, 
    value: T, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.connected) {
      logger.warn('Redis not connected, cache set failed');
      return false;
    }

    try {
      const cacheKey = this.buildKey(key, options.prefix);
      const serializedValue = options.serialize !== false 
        ? JSON.stringify(value) 
        : String(value);

      if (options.ttl) {
        await this.client.setEx(cacheKey, options.ttl, serializedValue);
      } else {
        await this.client.set(cacheKey, serializedValue);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.connected) {
      logger.warn('Redis not connected, cache delete failed');
      return false;
    }

    try {
      const cacheKey = this.buildKey(key, options.prefix);
      const result = await this.client.del(cacheKey);
      
      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const cacheKey = this.buildKey(key, options.prefix);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const cacheKey = this.buildKey(key, options.prefix);
      const result = await this.client.expire(cacheKey, ttl);
      return result;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    if (!this.connected) {
      return keys.map(() => null);
    }

    try {
      const cacheKeys = keys.map(key => this.buildKey(key, options.prefix));
      const values = await this.client.mGet(cacheKeys);

      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        
        if (options.serialize !== false) {
          return JSON.parse(value) as T;
        }
        
        return value as T;
      });
    } catch (error) {
      logger.error('Cache mget error:', error);
      this.stats.misses += keys.length;
      return keys.map(() => null);
    }
  }

  async mset<T = any>(
    keyValuePairs: Array<{ key: string; value: T }>, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const pipeline = this.client.multi();

      for (const { key, value } of keyValuePairs) {
        const cacheKey = this.buildKey(key, options.prefix);
        const serializedValue = options.serialize !== false 
          ? JSON.stringify(value) 
          : String(value);

        if (options.ttl) {
          pipeline.setEx(cacheKey, options.ttl, serializedValue);
        } else {
          pipeline.set(cacheKey, serializedValue);
        }
      }

      await pipeline.exec();
      this.stats.sets += keyValuePairs.length;
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    if (!this.connected) {
      return 0;
    }

    try {
      const searchPattern = this.buildKey(pattern, options.prefix);
      const keys = await this.client.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);
      this.stats.deletes += result;
      
      logger.info(`Invalidated ${result} cache keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      logger.error(`Cache pattern invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    let memoryUsage = 0;
    let totalKeys = 0;

    if (this.connected) {
      try {
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        if (memoryMatch) {
          memoryUsage = parseInt(memoryMatch[1]) / (1024 * 1024); // Convert to MB
        }

        const dbSize = await this.client.dbSize();
        totalKeys = dbSize;
      } catch (error) {
        logger.error('Failed to get Redis stats:', error);
      }
    }

    return {
      hitRate,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalKeys,
      memoryUsage,
      lastUpdated: new Date(),
    };
  }

  async flush(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      await this.client.flushDb();
      logger.info('Cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      try {
        await this.client.disconnect();
        logger.info('Redis client disconnected');
      } catch (error) {
        logger.error('Error disconnecting Redis client:', error);
      }
    }
  }

  // 缓存装饰器辅助方法
  async cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，执行获取逻辑
    const result = await fetcher();
    
    // 存储到缓存
    await this.set(key, result, options);
    
    return result;
  }

  // 缓存失效策略
  async invalidateComponent(componentId: string): Promise<void> {
    const patterns = [
      `component:${componentId}:*`,
      `components:*`,
      `search:*`,
      `graph:*:${componentId}:*`,
      `related:${componentId}:*`,
      `similar:${componentId}:*`,
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }

    logger.info(`Invalidated cache for component: ${componentId}`);
  }

  async invalidateManifest(): Promise<void> {
    const patterns = [
      'manifest:*',
      'components:*',
      'categories:*',
      'search:*',
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }

    logger.info('Invalidated manifest-related cache');
  }

  async invalidateSearch(): Promise<void> {
    await this.invalidatePattern('search:*');
    logger.info('Invalidated search cache');
  }
}