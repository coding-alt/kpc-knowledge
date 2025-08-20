# KPC Knowledge System

一个基于知识图谱和向量数据库的智能代码生成与组件管理系统，支持多框架组件解析、AI 驱动的代码生成和实时监控。

## 🚀 核心特性

- **🧠 AI 驱动的代码生成**：自然语言到 UAST 到多框架代码
- **🔍 智能组件发现**：自动化源码分析，支持跨框架对齐
- **📊 知识图谱**：Neo4j 驱动的组件关系和依赖追踪
- **🚀 向量搜索**：基于 Milvus 的语义搜索，500ms 响应时间
- **✅ 多层验证**：静态分析、运行时测试和自愈纠正
- **📈 实时分析**：性能监控和使用洞察
- **🔧 多 AI 服务支持**：OpenAI、Azure OpenAI、本地部署等

## 🏗️ 系统架构

```mermaid
graph TB
    subgraph "Frontend Layer"
        Web[Web Interface]
        VSCode[VS Code Extension]
        CLI[CLI Tool]
    end
    
    subgraph "API Layer"
        GraphQL[GraphQL API]
        REST[REST API]
        WS[WebSocket/Subscriptions]
    end
    
    subgraph "Core Services"
        CodeGen[Code Generator]
        Validator[Validator]
        Parser[Component Parser]
        Crawler[Source Crawler]
    end
    
    subgraph "Knowledge Layer"
        Neo4j[(Neo4j Graph DB)]
        Milvus[(Milvus Vector DB)]
        Redis[(Redis Cache)]
    end
    
    subgraph "AI/ML Layer"
        OpenAI[OpenAI API]
        Embeddings[Embedding Service]
        NLP[NLP Processing]
    end
    
    Web --> GraphQL
    VSCode --> GraphQL
    CLI --> GraphQL
    
    GraphQL --> CodeGen
    GraphQL --> Validator
    GraphQL --> Parser
    
    CodeGen --> OpenAI
    Parser --> Crawler
    Validator --> Neo4j
    
    Neo4j --> Milvus
    Milvus --> Embeddings
    Redis --> GraphQL
```

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- Docker & Docker Compose
- AI 服务 API 密钥 (OpenAI 或其他兼容服务)

### 安装配置

```bash
# 1. 克隆并设置
git clone <repository-url>
cd kpc-knowledge-system
yarn install

# 2. 环境配置
cp .env.example .env
# 配置 AI 服务 API 密钥 (支持 OpenAI 和其他兼容服务)

# 3. 使用 Docker Compose 启动 (推荐)
./scripts/deploy.sh

# 4. 或手动启动
yarn build
docker-compose up -d  # 启动数据库
yarn start:dev        # 启动服务
```

## 🔧 环境配置

### 基础配置

复制 `.env.example` 文件并配置必要的环境变量：

```bash
cp .env.example .env
```

### AI 服务配置

#### OpenAI 配置

```bash
# OpenAI API 密钥 (必需)
OPENAI_API_KEY=your_openai_api_key_here

# OpenAI API 基础 URL (可选，默认为官方 API)
# 支持自定义 OpenAI 兼容的 API 端点
OPENAI_BASE_URL=https://api.openai.com/v1

# OpenAI 默认模型 (可选，默认为 gpt-4)
OPENAI_MODEL=gpt-4
```

#### 支持自定义 OpenAI 兼容 API

通过配置 `OPENAI_BASE_URL`，您可以支持任何符合 OpenAI API 格式的服务：

**Azure OpenAI**
```bash
OPENAI_API_KEY=your_azure_openai_api_key
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment
OPENAI_MODEL=gpt-4
```

**本地部署 (如 vLLM)**
```bash
OPENAI_API_KEY=your_local_api_key
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_MODEL=your-local-model
```

**其他兼容服务**
```bash
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.your-service.com/v1
OPENAI_MODEL=your-model-name
```

#### 其他 AI 服务

```bash
# HuggingFace API 密钥 (用于文本嵌入)
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Anthropic API 密钥 (可选，作为 OpenAI 的替代)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 数据库配置

```bash
# PostgreSQL 数据库连接
DATABASE_URL=postgresql://kpc:kpc_password@localhost:5432/kpc_db

# Neo4j 图数据库配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=neo4j_password

# Milvus 向量数据库配置
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_USERNAME=
MILVUS_PASSWORD=
MILVUS_SSL=false

# Redis 缓存配置
REDIS_URL=redis://localhost:6379
```

### 应用配置

```bash
# 应用环境
NODE_ENV=development

# API 服务端口
PORT=3000

# Web 服务端口
WEB_PORT=3001

# JWT 密钥 (用于身份验证)
JWT_SECRET=your-jwt-secret-key

# NextAuth 密钥 (用于 Web 应用认证)
NEXTAUTH_SECRET=your-nextauth-secret

# GitHub Token (用于代码爬取和分析)
GITHUB_TOKEN=your_github_token_here

# API 端点配置
NEXT_PUBLIC_API_URL=http://localhost:3000/graphql
NEXT_PUBLIC_WS_URL=ws://localhost:3000/graphql
```

## 💻 使用示例

### 使用 AI Provider 工厂

```typescript
import { AIProviderFactory } from '@kpc/codegen';

// 使用环境变量自动创建 Provider
const aiProvider = AIProviderFactory.createDefaultProvider();

// 或者手动指定配置
const customProvider = AIProviderFactory.createProvider({
  provider: 'openai',
  apiKey: 'your-api-key',
  baseUrl: 'https://your-custom-endpoint.com/v1',
  model: 'gpt-4'
});

// 创建 OpenAI 兼容的 Provider
const compatibleProvider = AIProviderFactory.createOpenAICompatibleProvider(
  'your-api-key',
  'https://your-endpoint.com/v1',
  'your-model'
);
```

### 在 Requirement Parser 中使用

```typescript
import { AIRequirementParser } from '@kpc/codegen';
import { AIProviderFactory } from '@kpc/codegen';

// 创建 AI Provider
const aiProvider = AIProviderFactory.createDefaultProvider();

// 创建 Requirement Parser
const parser = new AIRequirementParser(aiProvider);

// 解析需求
const result = await parser.parseRequirement(
  "创建一个带有提交按钮的表单"
);
```

### 配置验证

```typescript
import { AIProviderFactory } from '@kpc/codegen';

// 获取当前环境的最佳配置
const config = AIProviderFactory.getOptimalConfig();
console.log('Current AI configuration:', config);

// 验证配置
const isValid = AIProviderFactory.validateConfig(config);
console.log('Configuration is valid:', isValid);
```

## 🎯 核心工作流

### 工作流 1: 组件发现与验证

```bash
# 1. 爬取现有组件
yarn kpc crawl --source ./src/components --framework react

# 2. 生成组件清单
yarn kpc manifest generate --output ./component-manifest.json

# 3. 验证现有组件
yarn kpc validate --directory ./src/components --fix
```

### 工作流 2: 设计系统合规

```bash
# 1. 设置设计系统规则
yarn kpc init --design-system material-ui

# 2. 生成合规组件
yarn kpc generate "Create a card component" --design-system material-ui

# 3. 验证设计系统合规性
yarn kpc validate --design-system-check
```

### 工作流 3: 跨框架迁移

```bash
# 1. 解析 React 组件
yarn kpc parse --source ./react-components --framework react

# 2. 生成 Vue 等价组件
yarn kpc translate --from react --to vue --input ./react-components

# 3. 验证翻译结果
yarn kpc test-suite --compilation --framework vue
```

## 🚀 部署

### Docker Compose (推荐)

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f api
```

### Kubernetes

```bash
# 部署到 Kubernetes
kubectl apply -f k8s/

# 检查部署状态
kubectl get pods -n kpc-system

# 查看服务
kubectl get svc -n kpc-system
```

### 环境变量配置

在 `docker-compose.yml` 中，环境变量会自动传递：

```yaml
services:
  api:
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://api.openai.com/v1}
      - OPENAI_MODEL=${OPENAI_MODEL:-gpt-4}
```

## 🔧 故障排除

### 常见问题

1. **API 密钥错误**
   ```
   Error: OpenAI API key is required
   ```
   解决方案：检查 `OPENAI_API_KEY` 环境变量是否正确设置

2. **Base URL 连接失败**
   ```
   Error: OpenAI API error: 404 Not Found
   ```
   解决方案：检查 `OPENAI_BASE_URL` 是否正确，确保端点支持 OpenAI API 格式

3. **模型不存在**
   ```
   Error: The model does not exist
   ```
   解决方案：检查 `OPENAI_MODEL` 是否在您的服务中可用

### 调试模式

启用调试日志以获取更多信息：

```bash
LOG_LEVEL=debug
```

### 健康检查

使用 CLI 工具检查 AI 服务状态：

```bash
yarn kpc health --check-ai
```

## 📊 监控与分析

### 实时监控

- **性能指标**：响应时间、吞吐量、错误率
- **资源使用**：CPU、内存、磁盘 I/O
- **AI 服务**：API 调用次数、成本、延迟
- **用户行为**：组件使用频率、生成成功率

### 日志分析

```bash
# 查看应用日志
docker-compose logs -f api

# 查看数据库日志
docker-compose logs -f postgres neo4j

# 查看向量数据库日志
docker-compose logs -f milvus-standalone
```

## 🔒 安全最佳实践

1. **API 密钥管理**
   - 永远不要在代码中硬编码 API 密钥
   - 使用环境变量或密钥管理服务
   - 定期轮换 API 密钥

2. **环境分离**
   - 为开发、测试、生产环境使用不同的配置
   - 使用 `.env.local` 进行本地开发
   - 在 CI/CD 中使用安全的密钥注入

3. **网络安全**
   - 使用 HTTPS 进行 API 通信
   - 配置适当的防火墙规则
   - 定期更新依赖包

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

- 📧 邮箱：support@kpc-knowledge.com
- 💬 讨论：[GitHub Discussions](https://github.com/kpc/knowledge-system/discussions)
- 🐛 问题报告：[GitHub Issues](https://github.com/kpc/knowledge-system/issues)

---

**KPC Knowledge System** - 让代码生成更智能，让组件管理更高效 🚀