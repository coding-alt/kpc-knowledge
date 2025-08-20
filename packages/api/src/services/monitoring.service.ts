import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { Neo4jService } from './neo4j.service';
import { MilvusService } from './milvus.service';

export interface SystemMetrics {
  timestamp: Date;
  services: ServiceMetrics[];
  database: DatabaseMetrics;
  performance: PerformanceMetrics;
  resources: ResourceMetrics;
}

export interface ServiceMetrics {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  responseTime: number;
  errorRate: number;
  requestCount: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface DatabaseMetrics {
  neo4j: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    nodeCount: number;
    relationshipCount: number;
    queryTime: number;
    memoryUsage: number;
  };
  milvus: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    collectionCount: number;
    vectorCount: number;
    searchLatency: number;
    indexSize: number;
  };
  redis: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    keyCount: number;
    memoryUsage: number;
    hitRate: number;
    evictedKeys: number;
  };
}

export interface PerformanceMetrics {
  apiLatency: number;
  searchLatency: number;
  generationTime: number;
  validationTime: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: {
    inbound: number;
    outbound: number;
  };
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  service: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly metricsHistory: SystemMetrics[] = [];
  private readonly alerts: Map<string, Alert> = new Map();
  private readonly alertRules: AlertRule[] = [];

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly neo4jService: Neo4jService,
    private readonly milvusService: MilvusService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeAlertRules();
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics();
      this.metricsHistory.push(metrics);
      
      // Keep only last 24 hours of metrics
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filteredHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);
      this.metricsHistory.length = 0;
      this.metricsHistory.push(...filteredHistory);

      // Store in Redis for real-time access
      await this.redis.setex(
        'system:metrics:latest',
        300, // 5 minutes TTL
        JSON.stringify(metrics)
      );

      // Evaluate alert rules
      await this.evaluateAlerts(metrics);

      // Emit metrics update event
      this.eventEmitter.emit('metrics.updated', metrics);

      this.logger.debug('System metrics collected successfully');
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
    }
  }

  async getLatestMetrics(): Promise<SystemMetrics | null> {
    try {
      const cached = await this.redis.get('system:metrics:latest');
      if (cached) {
        return JSON.parse(cached);
      }

      if (this.metricsHistory.length > 0) {
        return this.metricsHistory[this.metricsHistory.length - 1];
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get latest metrics', error);
      return null;
    }
  }

  async getMetricsHistory(hours: number = 24): Promise<SystemMetrics[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  async getAllAlerts(limit: number = 100): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.eventEmitter.emit('alert.resolved', alert);
      return true;
    }
    return false;
  }

  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    const [services, database, performance, resources] = await Promise.all([
      this.collectServiceMetrics(),
      this.collectDatabaseMetrics(),
      this.collectPerformanceMetrics(),
      this.collectResourceMetrics(),
    ]);

    return {
      timestamp: new Date(),
      services,
      database,
      performance,
      resources,
    };
  }

  private async collectServiceMetrics(): Promise<ServiceMetrics[]> {
    const services: ServiceMetrics[] = [];

    // API Service
    const apiMetrics = await this.getServiceHealth('api');
    services.push({
      name: 'API Gateway',
      status: apiMetrics.status,
      uptime: apiMetrics.uptime,
      responseTime: apiMetrics.responseTime,
      errorRate: apiMetrics.errorRate,
      requestCount: apiMetrics.requestCount,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: await this.getCpuUsage(),
    });

    // Code Generation Service
    const codegenMetrics = await this.getServiceHealth('codegen');
    services.push({
      name: 'Code Generation',
      status: codegenMetrics.status,
      uptime: codegenMetrics.uptime,
      responseTime: codegenMetrics.responseTime,
      errorRate: codegenMetrics.errorRate,
      requestCount: codegenMetrics.requestCount,
      memoryUsage: codegenMetrics.memoryUsage,
      cpuUsage: codegenMetrics.cpuUsage,
    });

    // Validation Service
    const validationMetrics = await this.getServiceHealth('validation');
    services.push({
      name: 'Validation',
      status: validationMetrics.status,
      uptime: validationMetrics.uptime,
      responseTime: validationMetrics.responseTime,
      errorRate: validationMetrics.errorRate,
      requestCount: validationMetrics.requestCount,
      memoryUsage: validationMetrics.memoryUsage,
      cpuUsage: validationMetrics.cpuUsage,
    });

    return services;
  }

  private async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    const [neo4jMetrics, milvusMetrics, redisMetrics] = await Promise.all([
      this.getNeo4jMetrics(),
      this.getMilvusMetrics(),
      this.getRedisMetrics(),
    ]);

    return {
      neo4j: neo4jMetrics,
      milvus: milvusMetrics,
      redis: redisMetrics,
    };
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Get performance metrics from Redis cache
    const perfData = await this.redis.hmget(
      'performance:metrics',
      'apiLatency',
      'searchLatency',
      'generationTime',
      'validationTime',
      'cacheHitRate',
      'errorRate'
    );

    return {
      apiLatency: parseFloat(perfData[0] || '0'),
      searchLatency: parseFloat(perfData[1] || '0'),
      generationTime: parseFloat(perfData[2] || '0'),
      validationTime: parseFloat(perfData[3] || '0'),
      cacheHitRate: parseFloat(perfData[4] || '0'),
      errorRate: parseFloat(perfData[5] || '0'),
    };
  }

  private async collectResourceMetrics(): Promise<ResourceMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = await this.getCpuUsage();

    return {
      cpuUsage,
      memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
      diskUsage: await this.getDiskUsage(),
      networkIO: await this.getNetworkIO(),
    };
  }

  private async getServiceHealth(serviceName: string): Promise<any> {
    // Mock implementation - in real scenario, this would check actual service health
    const baseMetrics = {
      status: 'healthy' as const,
      uptime: Math.random() * 1000000,
      responseTime: Math.random() * 200 + 50,
      errorRate: Math.random() * 0.05,
      requestCount: Math.floor(Math.random() * 10000),
      memoryUsage: Math.random() * 1024 * 1024 * 1024,
      cpuUsage: Math.random() * 0.8,
    };

    // Simulate occasional issues
    if (Math.random() < 0.1) {
      baseMetrics.status = 'degraded';
      baseMetrics.responseTime *= 2;
      baseMetrics.errorRate *= 3;
    }

    return baseMetrics;
  }

  private async getNeo4jMetrics(): Promise<DatabaseMetrics['neo4j']> {
    try {
      const session = this.neo4jService.getSession();
      const result = await session.run(`
        CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Store file sizes")
        YIELD attributes
        RETURN attributes.TotalStoreSize as storeSize
      `);

      const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as count');
      const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as count');

      await session.close();

      return {
        status: 'healthy',
        nodeCount: nodeCountResult.records[0]?.get('count').toNumber() || 0,
        relationshipCount: relCountResult.records[0]?.get('count').toNumber() || 0,
        queryTime: Math.random() * 100 + 10,
        memoryUsage: Math.random() * 1024 * 1024 * 1024,
      };
    } catch (error) {
      this.logger.error('Failed to get Neo4j metrics', error);
      return {
        status: 'unhealthy',
        nodeCount: 0,
        relationshipCount: 0,
        queryTime: 0,
        memoryUsage: 0,
      };
    }
  }

  private async getMilvusMetrics(): Promise<DatabaseMetrics['milvus']> {
    try {
      // Mock implementation - replace with actual Milvus metrics
      return {
        status: 'healthy',
        collectionCount: Math.floor(Math.random() * 10) + 1,
        vectorCount: Math.floor(Math.random() * 1000000) + 10000,
        searchLatency: Math.random() * 50 + 10,
        indexSize: Math.random() * 1024 * 1024 * 1024,
      };
    } catch (error) {
      this.logger.error('Failed to get Milvus metrics', error);
      return {
        status: 'unhealthy',
        collectionCount: 0,
        vectorCount: 0,
        searchLatency: 0,
        indexSize: 0,
      };
    }
  }

  private async getRedisMetrics(): Promise<DatabaseMetrics['redis']> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const stats = await this.redis.info('stats');

      const memoryMatch = info.match(/used_memory:(\d+)/);
      const keyCountMatch = keyspace.match(/keys=(\d+)/);
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      const evictedMatch = stats.match(/evicted_keys:(\d+)/);

      const hits = parseInt(hitsMatch?.[1] || '0');
      const misses = parseInt(missesMatch?.[1] || '0');
      const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;

      return {
        status: 'healthy',
        keyCount: parseInt(keyCountMatch?.[1] || '0'),
        memoryUsage: parseInt(memoryMatch?.[1] || '0'),
        hitRate,
        evictedKeys: parseInt(evictedMatch?.[1] || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to get Redis metrics', error);
      return {
        status: 'unhealthy',
        keyCount: 0,
        memoryUsage: 0,
        hitRate: 0,
        evictedKeys: 0,
      };
    }
  }

  private async getCpuUsage(): Promise<number> {
    // Mock implementation - in production, use actual CPU monitoring
    return Math.random() * 0.8;
  }

  private async getDiskUsage(): Promise<number> {
    // Mock implementation - in production, use actual disk monitoring
    return Math.random() * 0.7;
  }

  private async getNetworkIO(): Promise<{ inbound: number; outbound: number }> {
    // Mock implementation - in production, use actual network monitoring
    return {
      inbound: Math.random() * 100,
      outbound: Math.random() * 80,
    };
  }

  private initializeAlertRules(): void {
    this.alertRules.push(
      {
        id: 'high-error-rate',
        condition: (metrics) => metrics.performance.errorRate > 0.05,
        severity: 'high',
        title: 'High Error Rate',
        message: 'System error rate is above 5%',
      },
      {
        id: 'high-response-time',
        condition: (metrics) => metrics.performance.apiLatency > 1000,
        severity: 'medium',
        title: 'High Response Time',
        message: 'API response time is above 1 second',
      },
      {
        id: 'low-cache-hit-rate',
        condition: (metrics) => metrics.performance.cacheHitRate < 0.8,
        severity: 'medium',
        title: 'Low Cache Hit Rate',
        message: 'Cache hit rate is below 80%',
      },
      {
        id: 'high-cpu-usage',
        condition: (metrics) => metrics.resources.cpuUsage > 0.9,
        severity: 'high',
        title: 'High CPU Usage',
        message: 'CPU usage is above 90%',
      },
      {
        id: 'high-memory-usage',
        condition: (metrics) => metrics.resources.memoryUsage > 0.9,
        severity: 'high',
        title: 'High Memory Usage',
        message: 'Memory usage is above 90%',
      },
      {
        id: 'service-unhealthy',
        condition: (metrics) => metrics.services.some(s => s.status === 'unhealthy'),
        severity: 'critical',
        title: 'Service Unhealthy',
        message: 'One or more services are unhealthy',
      },
      {
        id: 'database-unhealthy',
        condition: (metrics) => 
          metrics.database.neo4j.status === 'unhealthy' ||
          metrics.database.milvus.status === 'unhealthy' ||
          metrics.database.redis.status === 'unhealthy',
        severity: 'critical',
        title: 'Database Unhealthy',
        message: 'One or more databases are unhealthy',
      },
    );
  }

  private async evaluateAlerts(metrics: SystemMetrics): Promise<void> {
    for (const rule of this.alertRules) {
      try {
        const shouldAlert = rule.condition(metrics);
        const existingAlert = this.alerts.get(rule.id);

        if (shouldAlert && (!existingAlert || existingAlert.resolved)) {
          // Create new alert
          const alert: Alert = {
            id: rule.id,
            type: rule.severity === 'critical' ? 'error' : rule.severity === 'high' ? 'error' : 'warning',
            severity: rule.severity,
            title: rule.title,
            message: rule.message,
            service: 'system',
            timestamp: new Date(),
            resolved: false,
            metadata: { metrics },
          };

          this.alerts.set(rule.id, alert);
          this.eventEmitter.emit('alert.triggered', alert);
          this.logger.warn(`Alert triggered: ${alert.title}`);
        } else if (!shouldAlert && existingAlert && !existingAlert.resolved) {
          // Auto-resolve alert
          existingAlert.resolved = true;
          existingAlert.resolvedAt = new Date();
          this.eventEmitter.emit('alert.resolved', existingAlert);
          this.logger.info(`Alert auto-resolved: ${existingAlert.title}`);
        }
      } catch (error) {
        this.logger.error(`Failed to evaluate alert rule ${rule.id}`, error);
      }
    }
  }
}

interface AlertRule {
  id: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
}