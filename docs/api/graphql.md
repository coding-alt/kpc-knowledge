# GraphQL API Reference

The KPC Knowledge System provides a comprehensive GraphQL API for all system interactions. This document covers the complete schema, queries, mutations, and subscriptions available.

## 🚀 Getting Started

### API Endpoint

```
POST https://api.kpc.example.com/graphql
```

### Authentication

Include your API key in the request headers:

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### GraphQL Playground

Interactive API explorer available at:
```
https://api.kpc.example.com/graphql
```

## 📋 Schema Overview

### Core Types

```graphql
# Component representation
type Component {
  id: ID!
  name: String!
  framework: Framework!
  description: String
  version: String
  category: String
  tags: [String!]!
  props: [PropDefinition!]!
  events: [EventDefinition!]!
  slots: [SlotDefinition!]!
  examples: [ComponentExample!]!
  documentation: String
  sourceCode: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Property definition
type PropDefinition {
  name: String!
  type: String!
  required: Boolean!
  defaultValue: String
  description: String
  validation: ValidationRule
}

# Event definition
type EventDefinition {
  name: String!
  type: String!
  payload: String
  description: String
}

# Framework enumeration
enum Framework {
  REACT
  VUE
  INTACT
}

# Code generation result
type CodeGenerationResult {
  success: Boolean!
  code: String
  files: [GeneratedFile!]!
  errors: [ValidationError!]!
  warnings: [ValidationWarning!]!
  metadata: GenerationMetadata
}

# Validation result
type ValidationResult {
  valid: Boolean!
  errors: [ValidationError!]!
  warnings: [ValidationWarning!]!
  suggestions: [ValidationSuggestion!]!
}
```

## 🔍 Queries

### Component Queries

#### Get All Components

```graphql
query GetComponents(
  $limit: Int = 20
  $offset: Int = 0
  $framework: Framework
  $category: String
  $tags: [String!]
) {
  components(
    limit: $limit
    offset: $offset
    framework: $framework
    category: $category
    tags: $tags
  ) {
    id
    name
    framework
    description
    category
    tags
    props {
      name
      type
      required
      defaultValue
      description
    }
    events {
      name
      type
      description
    }
    createdAt
    updatedAt
  }
}
```

**Example Usage:**
```javascript
const query = `
  query GetComponents($framework: Framework) {
    components(framework: $framework, limit: 10) {
      id
      name
      description
      props {
        name
        type
        required
      }
    }
  }
`;

const variables = { framework: 'REACT' };
```

#### Get Component by ID

```graphql
query GetComponent($id: ID!) {
  component(id: $id) {
    id
    name
    framework
    description
    version
    category
    tags
    props {
      name
      type
      required
      defaultValue
      description
      validation {
        type
        rule
        message
      }
    }
    events {
      name
      type
      payload
      description
    }
    slots {
      name
      description
      props
    }
    examples {
      name
      code
      description
    }
    documentation
    sourceCode
    dependencies {
      id
      name
      type
    }
    usedBy {
      id
      name
      count
    }
    createdAt
    updatedAt
  }
}
```

#### Search Components

```graphql
query SearchComponents(
  $query: String!
  $limit: Int = 20
  $framework: Framework
  $includeDescription: Boolean = true
  $includeCode: Boolean = false
) {
  searchComponents(
    query: $query
    limit: $limit
    framework: $framework
    includeDescription: $includeDescription
    includeCode: $includeCode
  ) {
    id
    name
    framework
    description
    category
    tags
    relevanceScore
    props {
      name
      type
      required
    }
    matchedFields
  }
}
```

### Framework Queries

#### Get Supported Frameworks

```graphql
query GetFrameworks {
  frameworks {
    name
    version
    componentCount
    features
    documentation
  }
}
```

#### Get Framework Statistics

```graphql
query GetFrameworkStats($framework: Framework!) {
  frameworkStats(framework: $framework) {
    totalComponents
    categoriesCount
    averagePropsPerComponent
    mostUsedComponents {
      id
      name
      usageCount
    }
    recentComponents {
      id
      name
      createdAt
    }
  }
}
```

### Analytics Queries

#### Get Usage Analytics

```graphql
query GetUsageAnalytics(
  $startDate: DateTime!
  $endDate: DateTime!
  $granularity: String = "day"
) {
  analytics(
    startDate: $startDate
    endDate: $endDate
    granularity: $granularity
  ) {
    usage {
      totalRequests
      uniqueUsers
      codeGenerations
      validations
      searches
      errors
      averageResponseTime
      peakConcurrentUsers
    }
    trends {
      timestamp
      requests
      users
      generations
      validations
      searches
      errors
      responseTime
    }
    components {
      mostUsed {
        name
        framework
        usageCount
        trend
      }
      mostGenerated {
        name
        framework
        generationCount
        successRate
      }
    }
  }
}
```

## 🔄 Mutations

### Code Generation

#### Generate Code from Requirement

```graphql
mutation GenerateCode(
  $requirement: String!
  $framework: Framework!
  $options: GenerationOptions
) {
  generateCode(
    requirement: $requirement
    framework: $framework
    options: $options
  ) {
    success
    code
    files {
      name
      content
      type
    }
    errors {
      message
      line
      column
      severity
    }
    warnings {
      message
      suggestion
    }
    metadata {
      generationTime
      tokensUsed
      model
      confidence
    }
  }
}
```

**Generation Options:**
```graphql
input GenerationOptions {
  includeTests: Boolean = false
  includeStories: Boolean = false
  includeTypes: Boolean = true
  styleFormat: StyleFormat = CSS_MODULES
  designSystem: String
  customTemplate: String
  accessibility: AccessibilityLevel = AA
}

enum StyleFormat {
  CSS_MODULES
  STYLED_COMPONENTS
  EMOTION
  TAILWIND
  SASS
  LESS
}

enum AccessibilityLevel {
  A
  AA
  AAA
}
```

**Example Usage:**
```javascript
const mutation = `
  mutation GenerateCode(
    $requirement: String!
    $framework: Framework!
    $options: GenerationOptions
  ) {
    generateCode(
      requirement: $requirement
      framework: $framework
      options: $options
    ) {
      success
      code
      files {
        name
        content
        type
      }
      errors {
        message
        line
        column
      }
      metadata {
        generationTime
        confidence
      }
    }
  }
`;

const variables = {
  requirement: "Create a responsive button component with primary and secondary variants",
  framework: "REACT",
  options: {
    includeTests: true,
    includeStories: true,
    styleFormat: "CSS_MODULES",
    accessibility: "AA"
  }
};
```

#### Generate Component from Template

```graphql
mutation GenerateFromTemplate(
  $templateId: ID!
  $variables: JSON!
  $framework: Framework!
) {
  generateFromTemplate(
    templateId: $templateId
    variables: $variables
    framework: $framework
  ) {
    success
    code
    files {
      name
      content
      type
    }
    errors {
      message
      field
    }
  }
}
```

### Component Management

#### Create Component

```graphql
mutation CreateComponent($input: ComponentInput!) {
  createComponent(input: $input) {
    id
    name
    framework
    description
    props {
      name
      type
      required
    }
    createdAt
  }
}

input ComponentInput {
  name: String!
  framework: Framework!
  description: String
  category: String
  tags: [String!]
  props: [PropDefinitionInput!]
  events: [EventDefinitionInput!]
  sourceCode: String
  documentation: String
}
```

#### Update Component

```graphql
mutation UpdateComponent($id: ID!, $input: ComponentUpdateInput!) {
  updateComponent(id: $id, input: $input) {
    id
    name
    framework
    description
    updatedAt
  }
}
```

#### Delete Component

```graphql
mutation DeleteComponent($id: ID!) {
  deleteComponent(id: $id) {
    success
    message
  }
}
```

### Validation

#### Validate Code

```graphql
mutation ValidateCode(
  $code: String!
  $framework: Framework!
  $options: ValidationOptions
) {
  validateCode(
    code: $code
    framework: $framework
    options: $options
  ) {
    valid
    errors {
      message
      line
      column
      severity
      rule
    }
    warnings {
      message
      line
      column
      suggestion
    }
    suggestions {
      type
      description
      autoFixAvailable
    }
    metrics {
      complexity
      maintainability
      testCoverage
    }
  }
}

input ValidationOptions {
  typescript: Boolean = true
  eslint: Boolean = true
  accessibility: Boolean = true
  performance: Boolean = true
  designSystem: String
  customRules: [String!]
}
```

#### Validate Component

```graphql
mutation ValidateComponent($id: ID!, $options: ValidationOptions) {
  validateComponent(id: $id, options: $options) {
    valid
    errors {
      message
      severity
      rule
      suggestion
    }
    warnings {
      message
      suggestion
    }
    score
    recommendations
  }
}
```

### Batch Operations

#### Batch Generate Components

```graphql
mutation BatchGenerateComponents($requests: [GenerationRequest!]!) {
  batchGenerateComponents(requests: $requests) {
    results {
      id
      success
      code
      errors {
        message
      }
    }
    summary {
      total
      successful
      failed
      totalTime
    }
  }
}

input GenerationRequest {
  id: String!
  requirement: String!
  framework: Framework!
  options: GenerationOptions
}
```

## 📡 Subscriptions

### Real-time Updates

#### Component Updates

```graphql
subscription ComponentUpdated($componentId: ID) {
  componentUpdated(componentId: $componentId) {
    id
    name
    framework
    updateType
    updatedAt
    updatedBy
  }
}
```

#### Generation Progress

```graphql
subscription GenerationProgress($sessionId: ID!) {
  generationProgress(sessionId: $sessionId) {
    sessionId
    status
    progress
    currentStep
    estimatedTimeRemaining
    result {
      success
      code
      errors {
        message
      }
    }
  }
}
```

#### System Metrics

```graphql
subscription SystemMetricsUpdated {
  systemMetricsUpdated {
    timestamp
    services {
      name
      status
      responseTime
      errorRate
    }
    performance {
      apiLatency
      searchLatency
      generationTime
      cacheHitRate
    }
    resources {
      cpuUsage
      memoryUsage
      diskUsage
    }
  }
}
```

#### Alerts

```graphql
subscription AlertTriggered {
  alertTriggered {
    id
    type
    severity
    title
    message
    service
    timestamp
    metadata
  }
}
```

## 🔧 Advanced Features

### Pagination

Use cursor-based pagination for large result sets:

```graphql
query GetComponentsPaginated(
  $first: Int!
  $after: String
  $framework: Framework
) {
  componentsPaginated(
    first: $first
    after: $after
    framework: $framework
  ) {
    edges {
      node {
        id
        name
        framework
        description
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

### Filtering and Sorting

```graphql
query GetComponentsFiltered(
  $filter: ComponentFilter
  $sort: ComponentSort
  $limit: Int = 20
) {
  components(filter: $filter, sort: $sort, limit: $limit) {
    id
    name
    framework
    description
    createdAt
  }
}

input ComponentFilter {
  framework: Framework
  category: String
  tags: [String!]
  hasProps: Boolean
  hasEvents: Boolean
  createdAfter: DateTime
  updatedAfter: DateTime
  search: String
}

input ComponentSort {
  field: ComponentSortField!
  direction: SortDirection!
}

enum ComponentSortField {
  NAME
  CREATED_AT
  UPDATED_AT
  USAGE_COUNT
  RELEVANCE
}

enum SortDirection {
  ASC
  DESC
}
```

### Aggregations

```graphql
query GetComponentAggregations($filter: ComponentFilter) {
  componentAggregations(filter: $filter) {
    byFramework {
      framework
      count
    }
    byCategory {
      category
      count
    }
    byTags {
      tag
      count
    }
    createdByMonth {
      month
      count
    }
  }
}
```

## 🚨 Error Handling

### Error Types

```graphql
type ValidationError {
  message: String!
  line: Int
  column: Int
  severity: ErrorSeverity!
  rule: String
  suggestion: String
}

type GenerationError {
  message: String!
  code: String
  details: String
  recoverable: Boolean!
}

enum ErrorSeverity {
  ERROR
  WARNING
  INFO
}
```

### Error Response Format

```json
{
  "errors": [
    {
      "message": "Component not found",
      "locations": [{"line": 2, "column": 3}],
      "path": ["component"],
      "extensions": {
        "code": "COMPONENT_NOT_FOUND",
        "componentId": "invalid-id"
      }
    }
  ],
  "data": null
}
```

## 📊 Rate Limiting

API requests are rate-limited based on your subscription plan:

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour
- **Enterprise**: Custom limits

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## 🔐 Security

### API Key Management

```graphql
mutation CreateApiKey($input: ApiKeyInput!) {
  createApiKey(input: $input) {
    id
    name
    key
    permissions
    expiresAt
    createdAt
  }
}

mutation RevokeApiKey($id: ID!) {
  revokeApiKey(id: $id) {
    success
    message
  }
}
```

### Permissions

API keys can have different permission levels:

- `READ`: Query access only
- `WRITE`: Query and mutation access
- `ADMIN`: Full access including user management

## 📝 Examples

### Complete Component Generation Workflow

```javascript
// 1. Generate component
const generateMutation = `
  mutation GenerateComponent($requirement: String!, $framework: Framework!) {
    generateCode(requirement: $requirement, framework: $framework) {
      success
      code
      files {
        name
        content
      }
      errors {
        message
      }
    }
  }
`;

const generateResult = await client.request(generateMutation, {
  requirement: "Create a responsive card component with image, title, and actions",
  framework: "REACT"
});

// 2. Validate generated code
const validateMutation = `
  mutation ValidateCode($code: String!, $framework: Framework!) {
    validateCode(code: $code, framework: $framework) {
      valid
      errors {
        message
        line
        column
      }
      suggestions {
        description
        autoFixAvailable
      }
    }
  }
`;

const validateResult = await client.request(validateMutation, {
  code: generateResult.generateCode.code,
  framework: "REACT"
});

// 3. Save component if valid
if (validateResult.validateCode.valid) {
  const createMutation = `
    mutation CreateComponent($input: ComponentInput!) {
      createComponent(input: $input) {
        id
        name
        createdAt
      }
    }
  `;

  const createResult = await client.request(createMutation, {
    input: {
      name: "ResponsiveCard",
      framework: "REACT",
      description: "A responsive card component with image, title, and actions",
      sourceCode: generateResult.generateCode.code
    }
  });
}
```

### Real-time Component Monitoring

```javascript
// Subscribe to component updates
const subscription = `
  subscription ComponentUpdates {
    componentUpdated {
      id
      name
      updateType
      updatedAt
    }
  }
`;

const client = new SubscriptionClient('ws://localhost:3000/graphql', {
  reconnect: true,
  connectionParams: {
    authorization: `Bearer ${apiKey}`
  }
});

client.request({ query: subscription }).subscribe({
  next: (data) => {
    console.log('Component updated:', data.componentUpdated);
  },
  error: (err) => {
    console.error('Subscription error:', err);
  }
});
```

## 🔗 Related Resources

- [REST API Reference](./rest.md)
- [CLI Reference](./cli.md)
- [VS Code Extension Guide](./vscode.md)
- [Authentication Guide](../getting-started/authentication.md)
- [Rate Limiting Guide](../reference/rate-limiting.md)

---

This GraphQL API provides comprehensive access to all KPC Knowledge System functionality. For additional examples and use cases, visit our [API Examples Repository](https://github.com/kpc/api-examples).