import 'reflect-metadata';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { Container } from 'typedi';
import { createServer } from 'http';
import { createLogger } from '@kpc/shared';

// Resolvers
import { ComponentResolver } from './resolvers/component.resolver';
import { SearchResolver } from './resolvers/search.resolver';
import { GraphResolver } from './resolvers/graph.resolver';
import { SubscriptionResolver } from './resolvers/subscription.resolver';

// Services
import { ComponentService } from './services/component.service';
import { SearchService } from './services/search.service';
import { GraphService } from './services/graph.service';
import { CacheService } from './services/cache.service';
import { SubscriptionService } from './services/subscription.service';

const logger = createLogger('APIServer');

async function startServer() {
  try {
    logger.info('Starting KPC Knowledge System API Server');

    // 构建GraphQL Schema
    const schema = await buildSchema({
      resolvers: [
        ComponentResolver,
        SearchResolver,
        GraphResolver,
        SubscriptionResolver,
      ],
      container: Container,
      emitSchemaFile: true,
    });

    // 创建HTTP服务器以支持订阅
    const app = express();
    const httpServer = createServer(app);

    // 创建Apollo Server
    const server = new ApolloServer({
      schema,
      context: ({ req, connection }) => {
        if (connection) {
          // WebSocket连接上下文
          return connection.context;
        }
        // HTTP请求上下文
        return {
          user: req.user, // 如果有认证
        };
      },
      subscriptions: {
        path: '/graphql',
        onConnect: (connectionParams, webSocket, context) => {
          logger.info('WebSocket client connected');
          return {
            // 可以在这里添加认证逻辑
            user: connectionParams?.user,
          };
        },
        onDisconnect: (webSocket, context) => {
          logger.info('WebSocket client disconnected');
        },
      },
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
    });

    // 健康检查端点
    app.get('/health', async (req, res) => {
      try {
        // 检查各个服务的健康状态
        const cacheService = Container.get(CacheService);
        const subscriptionService = Container.get(SubscriptionService);
        
        const cacheStats = await cacheService.getStats();
        const subscriptionHealth = await subscriptionService.healthCheck();
        
        res.json({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          services: {
            cache: {
              connected: cacheStats.totalKeys >= 0,
              hitRate: cacheStats.hitRate,
              memoryUsage: cacheStats.memoryUsage,
            },
            subscriptions: {
              healthy: subscriptionHealth,
            },
          },
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    });

    // 缓存统计端点
    app.get('/cache/stats', async (req, res) => {
      try {
        const cacheService = Container.get(CacheService);
        const stats = await cacheService.getStats();
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get cache stats:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 应用Apollo GraphQL中间件
    server.applyMiddleware({ app, path: '/graphql' });

    const port = process.env.PORT || 4000;
    
    // 安装订阅处理器并启动服务器
    server.installSubscriptionHandlers(httpServer);
    
    httpServer.listen(port, () => {
      logger.info(`🚀 Server ready at http://localhost:${port}${server.graphqlPath}`);
      logger.info(`🔗 Subscriptions ready at ws://localhost:${port}${server.subscriptionsPath}`);
      logger.info(`📊 GraphQL Playground available in development mode`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// 启动服务器
startServer().catch(error => {
  logger.error('Unhandled error during startup:', error);
  process.exit(1);
});

export default startServer;