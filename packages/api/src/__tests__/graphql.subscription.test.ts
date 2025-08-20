import { buildSchema } from 'type-graphql';
import { Container } from 'typedi';
import { ApolloServer } from 'apollo-server-express';
import { createTestClient } from 'apollo-server-testing';
import { gql } from 'apollo-server-express';

// Resolvers
import { ComponentResolver } from '../resolvers/component.resolver';
import { SearchResolver } from '../resolvers/search.resolver';
import { GraphResolver } from '../resolvers/graph.resolver';
import { SubscriptionResolver } from '../resolvers/subscription.resolver';

// Services
import { SubscriptionService } from '../services/subscription.service';
import { CacheService } from '../services/cache.service';

describe('GraphQL Subscription Integration Tests', () => {
  let server: ApolloServer;
  let subscriptionService: SubscriptionService;
  let cacheService: CacheService;

  beforeAll(async () => {
    // 构建测试schema
    const schema = await buildSchema({
      resolvers: [
        ComponentResolver,
        SearchResolver,
        GraphResolver,
        SubscriptionResolver,
      ],
      container: Container,
      emitSchemaFile: false,
    });

    // 创建测试服务器
    server = new ApolloServer({
      schema,
      context: () => ({}),
    });

    subscriptionService = Container.get(SubscriptionService);
    cacheService = Container.get(CacheService);

    // 等待服务初始化
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await server.stop();
    await subscriptionService.cleanup();
    await cacheService.disconnect();
  });

  describe('组件更新订阅', () => {
    const COMPONENT_UPDATES_SUBSCRIPTION = gql`
      subscription ComponentUpdates($filter: ComponentSubscriptionFilter) {
        componentUpdates(filter: $filter) {
          componentId
          componentName
          updateType
          timestamp
          reason
          changedFields
        }
      }
    `;

    it('应该能够订阅组件更新', async () => {
      const { query } = createTestClient(server);

      // 测试订阅查询的schema验证
      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                  type {
                    name
                  }
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.__schema?.subscriptionType?.fields).toContainEqual(
        expect.objectContaining({
          name: 'componentUpdates',
        })
      );
    });
  });

  describe('清单更新订阅', () => {
    const MANIFEST_UPDATES_SUBSCRIPTION = gql`
      subscription ManifestUpdates {
        manifestUpdates {
          manifestId
          library
          version
          updateType
          timestamp
          componentsAffected
          changedComponents
        }
      }
    `;

    it('应该能够订阅清单更新', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const fields = result.data?.__schema?.subscriptionType?.fields || [];
      const fieldNames = fields.map((field: any) => field.name);
      expect(fieldNames).toContain('manifestUpdates');
    });
  });

  describe('系统状态订阅', () => {
    const SYSTEM_STATUS_SUBSCRIPTION = gql`
      subscription SystemStatus($filter: SystemSubscriptionFilter) {
        systemStatus(filter: $filter) {
          service
          status
          message
          timestamp
          details
        }
      }
    `;

    it('应该能够订阅系统状态', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const fields = result.data?.__schema?.subscriptionType?.fields || [];
      const fieldNames = fields.map((field: any) => field.name);
      expect(fieldNames).toContain('systemStatus');
    });
  });

  describe('缓存统计订阅', () => {
    const CACHE_STATS_SUBSCRIPTION = gql`
      subscription CacheStats {
        cacheStats {
          hitRate
          totalHits
          totalMisses
          totalKeys
          memoryUsage
          lastUpdated
        }
      }
    `;

    it('应该能够订阅缓存统计', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const fields = result.data?.__schema?.subscriptionType?.fields || [];
      const fieldNames = fields.map((field: any) => field.name);
      expect(fieldNames).toContain('cacheStats');
    });
  });

  describe('实时查询订阅', () => {
    const REAL_TIME_QUERY_SUBSCRIPTION = gql`
      subscription RealTimeQuery($queryId: String!) {
        realTimeQuery(queryId: $queryId)
      }
    `;

    it('应该能够订阅实时查询结果', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                  args {
                    name
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const fields = result.data?.__schema?.subscriptionType?.fields || [];
      const realTimeQueryField = fields.find((field: any) => field.name === 'realTimeQuery');
      
      expect(realTimeQueryField).toBeDefined();
      expect(realTimeQueryField.args).toContainEqual(
        expect.objectContaining({
          name: 'queryId',
        })
      );
    });
  });

  describe('组件变更流订阅', () => {
    const COMPONENT_CHANGE_STREAM_SUBSCRIPTION = gql`
      subscription ComponentChangeStream($componentId: String) {
        componentChangeStream(componentId: $componentId)
      }
    `;

    it('应该能够订阅组件变更流', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const fields = result.data?.__schema?.subscriptionType?.fields || [];
      const fieldNames = fields.map((field: any) => field.name);
      expect(fieldNames).toContain('componentChangeStream');
    });
  });

  describe('搜索结果更新订阅', () => {
    const SEARCH_RESULTS_SUBSCRIPTION = gql`
      subscription SearchResultsUpdated($searchQuery: String!, $searchId: String) {
        searchResultsUpdated(searchQuery: $searchQuery, searchId: $searchId)
      }
    `;

    it('应该能够订阅搜索结果更新', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                  args {
                    name
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const fields = result.data?.__schema?.subscriptionType?.fields || [];
      const searchResultsField = fields.find((field: any) => field.name === 'searchResultsUpdated');
      
      expect(searchResultsField).toBeDefined();
      expect(searchResultsField.args).toContainEqual(
        expect.objectContaining({
          name: 'searchQuery',
        })
      );
    });
  });

  describe('知识图谱更新订阅', () => {
    const GRAPH_UPDATED_SUBSCRIPTION = gql`
      subscription GraphUpdated($nodeType: String) {
        graphUpdated(nodeType: $nodeType)
      }
    `;

    it('应该能够订阅知识图谱更新', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              subscriptionType {
                fields {
                  name
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const fields = result.data?.__schema?.subscriptionType?.fields || [];
      const fieldNames = fields.map((field: any) => field.name);
      expect(fieldNames).toContain('graphUpdated');
    });
  });

  describe('订阅过滤器', () => {
    it('应该支持组件订阅过滤器', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              types {
                name
                fields {
                  name
                  type {
                    name
                  }
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const types = result.data?.__schema?.types || [];
      const filterType = types.find((type: any) => type.name === 'ComponentSubscriptionFilter');
      
      expect(filterType).toBeDefined();
      expect(filterType.fields).toContainEqual(
        expect.objectContaining({
          name: 'componentNames',
        })
      );
      expect(filterType.fields).toContainEqual(
        expect.objectContaining({
          name: 'frameworks',
        })
      );
      expect(filterType.fields).toContainEqual(
        expect.objectContaining({
          name: 'categories',
        })
      );
      expect(filterType.fields).toContainEqual(
        expect.objectContaining({
          name: 'updateTypes',
        })
      );
    });

    it('应该支持系统订阅过滤器', async () => {
      const { query } = createTestClient(server);

      const result = await query({
        query: gql`
          query {
            __schema {
              types {
                name
                fields {
                  name
                  type {
                    name
                  }
                }
              }
            }
          }
        `,
      });

      expect(result.errors).toBeUndefined();
      const types = result.data?.__schema?.types || [];
      const filterType = types.find((type: any) => type.name === 'SystemSubscriptionFilter');
      
      expect(filterType).toBeDefined();
      expect(filterType.fields).toContainEqual(
        expect.objectContaining({
          name: 'services',
        })
      );
      expect(filterType.fields).toContainEqual(
        expect.objectContaining({
          name: 'statuses',
        })
      );
    });
  });
});