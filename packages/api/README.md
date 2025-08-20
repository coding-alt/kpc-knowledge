# KPC Knowledge System - GraphQL API

This package implements the GraphQL API layer for the KPC Knowledge System, providing real-time subscriptions and Redis-based caching functionality.

## Features

### 🚀 Real-time Subscriptions
- **Component Updates**: Subscribe to component creation, updates, deletion, and deprecation
- **Manifest Updates**: Get notified when component manifests are updated or rebuilt
- **System Status**: Monitor system health and service status changes
- **Cache Statistics**: Real-time cache performance metrics
- **Search Results**: Live updates for search queries
- **Knowledge Graph**: Graph structure change notifications

### 💾 Redis Caching
- **Multi-level Caching**: Memory + Redis with configurable TTL
- **Pattern-based Invalidation**: Smart cache invalidation by patterns
- **Batch Operations**: Efficient bulk get/set operations
- **Statistics Tracking**: Hit rates, memory usage, and performance metrics
- **Component-aware**: Automatic invalidation for component-related data

### 🔍 GraphQL API
- **Type-safe Schema**: Generated TypeScript types with type-graphql
- **Comprehensive Queries**: Components, search, and knowledge graph queries
- **WebSocket Support**: Real-time subscriptions over WebSocket
- **Filtering**: Advanced filtering for subscriptions and queries

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GraphQL       │    │   Subscription  │    │   Cache         │
│   Resolvers     │◄──►│   Service       │◄──►│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Component     │    │   Redis PubSub  │    │   Redis Cache   │
│   Services      │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Installation

```bash
npm install
```

## Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
CACHE_PREFIX=kpc

# Server Configuration
PORT=4000
NODE_ENV=development
```

## Usage

### Starting the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### GraphQL Playground

Visit `http://localhost:4000/graphql` in development mode to access the GraphQL Playground.

### Health Check

```bash
curl http://localhost:4000/health
```

### Cache Statistics

```bash
curl http://localhost:4000/cache/stats
```

## GraphQL Subscriptions

### Component Updates

```graphql
subscription ComponentUpdates($filter: ComponentSubscriptionFilter) {
  componentUpdates(filter: $filter) {
    componentId
    componentName
    updateType
    timestamp
    reason
    changedFields
    component {
      id
      name
      category
    }
  }
}
```

### Manifest Updates

```graphql
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
```

### System Status

```graphql
subscription SystemStatus($filter: SystemSubscriptionFilter) {
  systemStatus(filter: $filter) {
    service
    status
    message
    timestamp
    details
  }
}
```

### Cache Statistics

```graphql
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
```

## Caching Strategy

### Cache Keys

- `component:{id}` - Individual component data
- `components:*` - Component lists and searches
- `search:{query}` - Search results
- `graph:*` - Knowledge graph queries
- `manifest:*` - Component manifests

### TTL Configuration

- Component data: 10 minutes (600s)
- Search results: 3 minutes (180s)
- Graph queries: 5 minutes (300s)
- Statistics: 30 minutes (1800s)

### Invalidation Patterns

When a component is updated, the following cache patterns are invalidated:
- `component:{id}:*`
- `components:*`
- `search:*`
- `graph:*:{id}:*`
- `related:{id}:*`

## Services

### CacheService

```typescript
// Basic operations
await cacheService.set('key', value, { ttl: 300 });
const value = await cacheService.get('key');
await cacheService.del('key');

// Batch operations
await cacheService.mset([
  { key: 'key1', value: 'value1' },
  { key: 'key2', value: 'value2' }
]);
const values = await cacheService.mget(['key1', 'key2']);

// Pattern invalidation
await cacheService.invalidatePattern('component:*');

// Component-specific invalidation
await cacheService.invalidateComponent('component-id');

// Statistics
const stats = await cacheService.getStats();
```

### SubscriptionService

```typescript
// Publish notifications
await subscriptionService.publishComponentUpdate({
  componentId: 'button-1',
  componentName: 'Button',
  updateType: 'updated',
  timestamp: new Date(),
});

await subscriptionService.publishSystemStatus({
  service: 'crawler',
  status: 'healthy',
  message: 'Crawling completed',
  timestamp: new Date(),
});

// Manage subscribers
subscriptionService.addSubscriber('COMPONENT_UPDATED', 'client-1');
subscriptionService.removeSubscriber('COMPONENT_UPDATED', 'client-1');
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

The package includes comprehensive integration tests for:
- Cache operations and Redis connectivity
- Subscription publishing and filtering
- GraphQL schema validation
- WebSocket subscription functionality

### Test Coverage

- Cache Service: 9 test cases
- Subscription Service: 13 test cases  
- GraphQL Subscriptions: 10 test cases

## Monitoring

### Health Endpoints

- `GET /health` - Overall system health
- `GET /cache/stats` - Cache performance metrics

### Metrics

The system tracks:
- Cache hit/miss rates
- Memory usage
- Subscription counts
- Query performance
- Error rates

## Error Handling

### Graceful Degradation

- Redis connection failures fall back to in-memory operations
- Subscription failures are logged but don't crash the server
- Cache misses trigger data fetching from primary sources

### Retry Logic

- Automatic reconnection for Redis
- Exponential backoff for failed operations
- Circuit breaker pattern for external services

## Performance Optimization

### Caching Strategy

- Multi-level caching (memory + Redis)
- Intelligent cache warming
- Batch operations for efficiency
- Pattern-based invalidation

### Subscription Optimization

- Connection pooling for Redis PubSub
- Message filtering at the service level
- Efficient WebSocket management

## Security

### Input Validation

- GraphQL schema validation
- Query complexity limits
- Rate limiting (configurable)

### Authentication

- JWT token support (configurable)
- Role-based access control
- Subscription authentication

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 4000
CMD ["npm", "start"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kpc-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kpc-api
  template:
    metadata:
      labels:
        app: kpc-api
    spec:
      containers:
      - name: kpc-api
        image: kpc-api:latest
        ports:
        - containerPort: 4000
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
```

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Use conventional commits

## License

MIT License - see LICENSE file for details.