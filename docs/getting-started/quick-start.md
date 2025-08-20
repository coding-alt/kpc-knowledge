# Quick Start Guide

Get up and running with KPC Knowledge System in just 5 minutes! This guide will walk you through the essential steps to start generating components and validating code.

## 🚀 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ installed
- **Docker** and **Docker Compose** (for local development)
- **Git** for cloning the repository
- An **OpenAI API key** (for AI-powered features)

## 📦 Installation

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/kpc/knowledge-system.git
   cd knowledge-system
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Start the system**
   ```bash
   ./scripts/deploy.sh
   ```

4. **Verify installation**
   ```bash
   curl http://localhost/api/health
   ```

### Option 2: Local Development

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **Start databases**
   ```bash
   docker-compose -f docker-compose.test.yml up -d
   ```

3. **Build and start services**
   ```bash
   yarn build
   yarn start:dev
   ```

## 🎯 First Steps

### 1. Access the Web Interface

Open your browser and navigate to:
- **Web UI**: http://localhost (or http://localhost:3001 for local dev)
- **API Playground**: http://localhost/api/graphql

### 2. Initialize Component Knowledge Base

```bash
# Using CLI
yarn kpc dataset init --samples

# Or via API
curl -X POST http://localhost/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { initializeDataset { success message } }"}'
```

### 3. Generate Your First Component

#### Via Web Interface
1. Navigate to the **Code Generator** tab
2. Enter a requirement: "Create a button with primary and secondary variants"
3. Select your framework (React/Vue/Intact)
4. Click **Generate Code**

#### Via CLI
```bash
yarn kpc generate "Create a button with primary and secondary variants" --framework react
```

#### Via API
```bash
curl -X POST http://localhost/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation GenerateCode($requirement: String!, $framework: String!) { generateCode(requirement: $requirement, framework: $framework) { success code errors } }",
    "variables": {
      "requirement": "Create a button with primary and secondary variants",
      "framework": "react"
    }
  }'
```

### 4. Validate Generated Code

```bash
# Validate the generated code
yarn kpc validate --file ./generated-button.tsx --framework react

# Or run comprehensive validation
yarn kpc test-suite --accuracy --compilation
```

### 5. Search Components

```bash
# Search for existing components
yarn kpc search "button"

# Or via API
curl -X POST http://localhost/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query SearchComponents($query: String!) { searchComponents(query: $query) { id name framework description } }",
    "variables": { "query": "button" }
  }'
```

## 🛠 VS Code Integration

1. **Install the extension**
   ```bash
   code --install-extension kpc-knowledge-system.vsix
   ```

2. **Configure the extension**
   - Open VS Code settings
   - Search for "KPC"
   - Set API URL: `http://localhost/api`

3. **Use intelligent code completion**
   - Type `kpc:` in any TypeScript/JavaScript file
   - Select from available component snippets
   - Use Ctrl+Space for component suggestions

## 📊 Monitor Your System

Access the monitoring dashboard at:
- **Grafana**: http://localhost:3002 (admin/admin)
- **Prometheus**: http://localhost:9090

Key metrics to watch:
- **Response Time**: Should be < 100ms for queries
- **Success Rate**: Should be > 95% for code generation
- **System Health**: All services should show as "healthy"

## 🎨 Example Workflows

### Workflow 1: Component Library Migration

```bash
# 1. Crawl existing components
yarn kpc crawl --source ./src/components --framework react

# 2. Generate component manifest
yarn kpc manifest generate --output ./component-manifest.json

# 3. Validate existing components
yarn kpc validate --directory ./src/components --fix
```

### Workflow 2: Design System Compliance

```bash
# 1. Set up design system rules
yarn kpc init --design-system material-ui

# 2. Generate compliant components
yarn kpc generate "Create a card component" --design-system material-ui

# 3. Validate against design system
yarn kpc validate --design-system-check
```

### Workflow 3: Cross-Framework Migration

```bash
# 1. Parse React components
yarn kpc parse --source ./react-components --framework react

# 2. Generate Vue equivalents
yarn kpc translate --from react --to vue --input ./react-components

# 3. Validate translations
yarn kpc test-suite --compilation --framework vue
```

## 🔧 Configuration

### Basic Configuration

Create a `kpc.config.js` file in your project root:

```javascript
module.exports = {
  // API Configuration
  apiUrl: 'http://localhost:3000',
  
  // Framework Settings
  defaultFramework: 'react',
  supportedFrameworks: ['react', 'vue', 'intact'],
  
  // Code Generation
  codeGeneration: {
    includeTests: true,
    includeStories: true,
    includeTypes: true,
    styleFormat: 'css-modules'
  },
  
  // Validation Rules
  validation: {
    typescript: true,
    eslint: true,
    prettier: true,
    accessibility: 'AA'
  },
  
  // Component Discovery
  componentPaths: [
    './src/components/**/*.{tsx,vue,js}',
    './packages/*/src/**/*.{tsx,vue,js}'
  ]
};
```

### Environment Variables

```bash
# API Configuration
KPC_API_URL=http://localhost:3000
KPC_API_KEY=your-api-key

# AI Configuration
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/kpc
NEO4J_URI=bolt://localhost:7687
REDIS_URL=redis://localhost:6379

# Feature Flags
ENABLE_AI_GENERATION=true
ENABLE_VISUAL_TESTING=true
ENABLE_ANALYTICS=true
```

## 🚨 Troubleshooting

### Common Issues

**Issue**: Services not starting
```bash
# Check Docker containers
docker-compose ps

# View logs
docker-compose logs api
docker-compose logs web
```

**Issue**: API connection errors
```bash
# Test API connectivity
curl http://localhost:3000/health

# Check network configuration
docker network ls
```

**Issue**: Code generation failures
```bash
# Verify OpenAI API key
echo $OPENAI_API_KEY

# Check API quota and usage
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/usage
```

### Performance Issues

**Slow response times**:
1. Check system resources: `docker stats`
2. Monitor database performance
3. Review cache hit rates in Redis
4. Scale services if needed

**High error rates**:
1. Check service logs for errors
2. Verify database connections
3. Monitor API rate limits
4. Review validation rules

## 📚 Next Steps

Now that you have KPC Knowledge System running:

1. **Explore the Web Interface** - Browse components, generate code, and view analytics
2. **Set Up Your IDE** - Install the VS Code extension for seamless integration
3. **Configure Your Project** - Customize settings for your specific needs
4. **Read the User Guides** - Dive deeper into specific workflows
5. **Join the Community** - Connect with other users and contributors

## 🆘 Getting Help

If you encounter any issues:

- **Documentation**: Check our [comprehensive docs](../README.md)
- **GitHub Issues**: [Report bugs or request features](https://github.com/kpc/knowledge-system/issues)
- **Community Forum**: [Ask questions and share experiences](https://community.kpc.example.com)
- **Discord**: [Real-time chat with the community](https://discord.gg/kpc)

---

**Congratulations!** 🎉 You now have KPC Knowledge System up and running. Ready to revolutionize your component development workflow!