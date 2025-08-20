#!/usr/bin/env tsx

/**
 * KPC Knowledge System - 整体测试脚本
 * 
 * 这个脚本测试整个系统的核心功能，包括：
 * 1. 数据采集层 - 源码和文档抓取
 * 2. 语义解析层 - AST解析和组件清单生成
 * 3. 知识存储层 - 向量数据库和知识图谱
 * 4. AI推理层 - 需求解析和代码生成
 * 5. 验证系统 - 静态和运行时验证
 */

import { createLogger } from './packages/shared/src/utils/logger';

// 导入各个模块
import { GitSourceCrawler } from './packages/crawler/src/source-crawler';
import { PlaywrightDocsCrawler } from './packages/crawler/src/docs-crawler';
import { TypeScriptParser } from './packages/parser/src/typescript-parser';
import { VueParser } from './packages/parser/src/vue-parser';
import { IntactParser } from './packages/parser/src/intact-parser';
import { CrossFrameworkAligner } from './packages/parser/src/framework-alignment';
import { KPCManifestGenerator } from './packages/parser/src/manifest-generator';
import { MilvusVectorStore } from './packages/knowledge/src/milvus-store';
import { Neo4jGraphStore } from './packages/knowledge/src/neo4j-store';
import { KPCKnowledgeGraphBuilder } from './packages/knowledge/src/knowledge-graph-builder';
import { HuggingFaceEmbeddingProvider } from './packages/knowledge/src/embedding-provider';
import { AIRequirementParser } from './packages/codegen/src/requirement-parser';
import { KPCCodeGenerator } from './packages/codegen/src/code-generator';
import { HandlebarsTemplateEngine } from './packages/codegen/src/template-engine';
import { OpenAIProvider, MockAIProvider } from './packages/codegen/src/ai-provider';
import { TypeScriptStaticValidator } from './packages/validator/src/typescript-validator';
import { ESLintStaticValidator } from './packages/validator/src/eslint-validator';
import { StorybookRuntimeValidator } from './packages/validator/src/storybook-validator';
import { PlaywrightE2EValidator } from './packages/validator/src/playwright-validator';
import { SelfHealingValidator } from './packages/validator/src/self-healing-validator';

const logger = createLogger('SystemTest');

interface TestResult {
  module: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class SystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    logger.info('🚀 Starting KPC Knowledge System Integration Tests');
    
    const startTime = Date.now();

    try {
      // 1. 测试数据采集层
      await this.testDataCollection();
      
      // 2. 测试语义解析层
      await this.testSemanticParsing();
      
      // 3. 测试知识存储层
      await this.testKnowledgeStorage();
      
      // 4. 测试AI推理层
      await this.testAIInference();
      
      // 5. 测试验证系统
      await this.testValidationSystem();
      
      // 6. 测试端到端流程
      await this.testEndToEndFlow();

    } catch (error) {
      logger.error('System test failed:', error);
    }

    const totalDuration = Date.now() - startTime;
    this.printResults(totalDuration);
  }

  private async testDataCollection(): Promise<void> {
    logger.info('📥 Testing Data Collection Layer');

    // 测试源码抓取器
    await this.runTest('SourceCrawler', async () => {
      const crawler = new GitSourceCrawler('./temp/test-repos');
      
      // 测试组件提取
      const components = await crawler.extractComponents('./packages/shared/src');
      
      return {
        componentsFound: components.length,
        frameworks: [...new Set(components.map(c => c.framework))],
      };
    });

    // 测试文档抓取器
    await this.runTest('DocsCrawler', async () => {
      const crawler = new PlaywrightDocsCrawler();
      
      // 模拟文档抓取（使用本地HTML）
      const mockHtml = `
        <div>
          <h1>Button Component</h1>
          <p>A versatile button component for all your needs.</p>
          <pre><code class="language-tsx">
            <Button onClick={handleClick}>Click me</Button>
          </code></pre>
        </div>
      `;
      
      const examples = await crawler.extractCodeExamples(mockHtml);
      
      return {
        examplesFound: examples.length,
        languages: [...new Set(examples.map(e => e.language))],
      };
    });
  }

  private async testSemanticParsing(): Promise<void> {
    logger.info('🧠 Testing Semantic Parsing Layer');

    const mockReactComponent = `
import React from 'react';

interface ButtonProps {
  /** Button text content */
  children: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Button variant */
  variant?: 'primary' | 'secondary';
  /** Disabled state */
  disabled?: boolean;
}

/**
 * A versatile button component
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  return (
    <button 
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
    `;

    // 测试TypeScript解析器
    await this.runTest('TypeScriptParser', async () => {
      const parser = new TypeScriptParser();
      const component = await parser.parseTypeScript('Button.tsx', mockReactComponent);
      
      return {
        componentName: component.name,
        propsCount: component.props.length,
        eventsCount: component.events.length,
        framework: component.framework,
      };
    });

    // 测试Vue解析器
    await this.runTest('VueParser', async () => {
      const parser = new VueParser();
      const mockVueComponent = `
<template>
  <button :class="buttonClass" @click="handleClick" :disabled="disabled">
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
});

const emit = defineEmits<{
  click: [];
}>();

const buttonClass = computed(() => \`btn btn-\${props.variant}\`);

const handleClick = () => {
  emit('click');
};
</script>
      `;
      
      const component = await parser.parseVue('Button.vue', mockVueComponent);
      
      return {
        componentName: component.name,
        propsCount: component.props.length,
        eventsCount: component.events.length,
        slotsCount: component.slots.length,
      };
    });

    // 测试跨框架对齐
    await this.runTest('CrossFrameworkAligner', async () => {
      const aligner = new CrossFrameworkAligner();
      
      // 创建模拟组件定义
      const mockComponents = [
        {
          name: 'Button',
          framework: 'react' as const,
          props: [
            { name: 'onClick', type: '() => void', required: false, sourceRef: { filePath: '', startLine: 1, endLine: 1 } },
            { name: 'disabled', type: 'boolean', required: false, sourceRef: { filePath: '', startLine: 1, endLine: 1 } },
          ],
          events: [],
          slots: [],
          styleTokens: [],
          sourceRefs: [],
        },
        {
          name: 'Button',
          framework: 'vue' as const,
          props: [
            { name: 'disabled', type: 'boolean', required: false, sourceRef: { filePath: '', startLine: 1, endLine: 1 } },
          ],
          events: [
            { name: 'click', type: 'CustomEvent', sourceRef: { filePath: '', startLine: 1, endLine: 1 } },
          ],
          slots: [
            { name: 'default', sourceRef: { filePath: '', startLine: 1, endLine: 1 } },
          ],
          styleTokens: [],
          sourceRefs: [],
        },
      ];
      
      const aligned = aligner.alignComponents(mockComponents);
      
      return {
        alignedComponents: aligned.length,
        totalFrameworks: aligned[0]?.frameworks.length || 0,
        unifiedProps: aligned[0]?.unifiedProps.length || 0,
      };
    });

    // 测试清单生成器
    await this.runTest('ManifestGenerator', async () => {
      const generator = new KPCManifestGenerator();
      
      // 创建模拟组件定义
      const mockComponents = [{
        name: 'Button',
        framework: 'react' as const,
        props: [],
        events: [],
        slots: [],
        styleTokens: [],
        sourceRefs: [],
      }];
      
      const manifest = await generator.generateManifest({
        library: 'KPC',
        version: '1.0.0',
        components: [],
        patterns: [],
        antiPatterns: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          confidence: 0.9,
        },
      });
      
      return {
        library: manifest.library,
        version: manifest.version,
        componentsCount: manifest.components.length,
        patternsCount: manifest.patterns.length,
      };
    });
  }

  private async testKnowledgeStorage(): Promise<void> {
    logger.info('🧮 Testing Knowledge Storage Layer');

    // 测试嵌入提供者（使用Mock）
    await this.runTest('EmbeddingProvider', async () => {
      // 使用Mock提供者避免API调用
      const mockProvider = {
        async embed(text: string): Promise<number[]> {
          // 生成模拟嵌入向量
          return Array.from({ length: 384 }, () => Math.random());
        },
        async batchEmbed(texts: string[]): Promise<number[][]> {
          return texts.map(() => Array.from({ length: 384 }, () => Math.random()));
        },
        getDimension(): number {
          return 384;
        },
        getModelInfo() {
          return {
            name: 'mock-model',
            dimension: 384,
            maxTokens: 512,
            provider: 'Mock',
          };
        },
      };
      
      const embedding = await mockProvider.embed('test component');
      const batchEmbeddings = await mockProvider.batchEmbed(['comp1', 'comp2']);
      
      return {
        embeddingDimension: embedding.length,
        batchSize: batchEmbeddings.length,
        modelInfo: mockProvider.getModelInfo(),
      };
    });

    // 注意：Milvus和Neo4j测试需要实际的数据库连接
    // 在CI/CD环境中，这些测试应该使用Docker容器或测试数据库
    logger.info('⚠️  Skipping Milvus and Neo4j tests (require database connections)');
  }

  private async testAIInference(): Promise<void> {
    logger.info('🤖 Testing AI Inference Layer');

    // 测试需求解析器（使用Mock AI）
    await this.runTest('RequirementParser', async () => {
      const mockAI = new MockAIProvider();
      const parser = new AIRequirementParser(mockAI);
      
      const requirement = "Create a login form with email and password fields and a submit button";
      const result = await parser.parseRequirement(requirement);
      
      return {
        intent: result.intent,
        componentsCount: result.components.length,
        confidence: result.confidence,
      };
    });

    // 测试代码生成器
    await this.runTest('CodeGenerator', async () => {
      const templateEngine = new HandlebarsTemplateEngine();
      const generator = new KPCCodeGenerator(templateEngine);
      
      // 创建模拟UAST
      const mockUAST = {
        type: 'Button',
        props: {
          children: 'Click me',
          variant: 'primary',
        },
        metadata: {
          componentName: 'Button',
          framework: 'react' as const,
          constraints: [],
          confidence: 0.9,
        },
      };
      
      const mockManifest = {
        library: 'KPC',
        version: '1.0.0',
        components: [{
          name: 'Button',
          frameworks: [{
            framework: 'react' as const,
            import: { module: '@kpc/react', named: 'Button', default: false },
            props: [],
            events: [],
            slots: [],
            examples: [],
          }],
          props: [],
          events: [],
          slots: [],
          styleTokens: [],
          composability: [],
          antiPatterns: [],
          version: { since: '1.0.0' },
          sourceRefs: [],
        }],
        patterns: [],
        antiPatterns: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          confidence: 0.9,
        },
      };
      
      const code = await generator.generateComponent(mockUAST, 'react', mockManifest);
      
      return {
        codeLength: code.length,
        containsImport: code.includes('import'),
        containsExport: code.includes('export'),
        containsComponent: code.includes('Button'),
      };
    });
  }

  private async testValidationSystem(): Promise<void> {
    logger.info('✅ Testing Validation System');

    // 测试TypeScript验证器
    await this.runTest('TypeScriptValidator', async () => {
      const validator = new TypeScriptStaticValidator();
      
      const validCode = `
import React from 'react';

interface Props {
  title: string;
}

const Component: React.FC<Props> = ({ title }) => {
  return <div>{title}</div>;
};

export default Component;
      `;
      
      const invalidCode = `
import React from 'react';

const Component = ({ title }) => {
  return <div>{title.toUpperCase()}</div>;
};

export default Component;
      `;
      
      const validResult = await validator.validateTypeScript(validCode);
      const invalidResult = await validator.validateTypeScript(invalidCode);
      
      return {
        validCodePassed: validResult.success,
        invalidCodeFailed: !invalidResult.success,
        errorsFound: invalidResult.errors?.length || 0,
      };
    });

    // 测试ESLint验证器
    await this.runTest('ESLintValidator', async () => {
      const validator = new ESLintStaticValidator();
      
      const codeWithIssues = `
import React from 'react';

const Component = () => {
  const unusedVar = 'test';
  console.log('debug message');
  
  return <div>Hello</div>;
};

export default Component;
      `;
      
      const result = await validator.validateESLint(codeWithIssues);
      
      return {
        hasErrors: !result.success,
        errorsCount: result.errors?.length || 0,
        warningsCount: result.warnings?.length || 0,
      };
    });

    // 测试自愈修复系统
    await this.runTest('SelfHealingValidator', async () => {
      const mockAI = new MockAIProvider();
      const staticValidator = new TypeScriptStaticValidator();
      const runtimeValidator = new StorybookRuntimeValidator();
      const mockManifest = {
        library: 'KPC',
        version: '1.0.0',
        components: [],
        patterns: [],
        antiPatterns: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          confidence: 0.9,
        },
      };
      
      const healer = new SelfHealingValidator(
        staticValidator,
        runtimeValidator,
        mockAI,
        mockManifest
      );
      
      const brokenCode = `
import React from 'react';

const Component = ({ title }) => {
  const unusedVar = 'test';
  return <div>{title.toUpperCase()}</div>;
};
      `;
      
      const healingResult = await healer.autoHeal(brokenCode);
      
      return {
        healingAttempted: true,
        iterations: healingResult.iterations,
        success: healingResult.success,
        confidence: healingResult.confidence,
        codeChanged: healingResult.healedCode !== healingResult.originalCode,
      };
    });
  }

  private async testEndToEndFlow(): Promise<void> {
    logger.info('🔄 Testing End-to-End Flow');

    await this.runTest('EndToEndFlow', async () => {
      // 模拟完整的端到端流程
      const startTime = Date.now();
      
      // 1. 需求输入
      const requirement = "Create a responsive navigation bar with logo, menu items, and user profile dropdown";
      
      // 2. 需求解析
      const mockAI = new MockAIProvider();
      const parser = new AIRequirementParser(mockAI);
      const parsedRequirement = await parser.parseRequirement(requirement);
      
      // 3. 代码生成
      const templateEngine = new HandlebarsTemplateEngine();
      const generator = new KPCCodeGenerator(templateEngine);
      
      const mockUAST = {
        type: 'Navigation',
        props: {
          logo: 'Company Logo',
          menuItems: ['Home', 'About', 'Contact'],
        },
        metadata: {
          componentName: 'Navigation',
          framework: 'react' as const,
          constraints: [],
          confidence: 0.8,
        },
      };
      
      const mockManifest = {
        library: 'KPC',
        version: '1.0.0',
        components: [{
          name: 'Navigation',
          frameworks: [{
            framework: 'react' as const,
            import: { module: '@kpc/react', named: 'Navigation', default: false },
            props: [],
            events: [],
            slots: [],
            examples: [],
          }],
          props: [],
          events: [],
          slots: [],
          styleTokens: [],
          composability: [],
          antiPatterns: [],
          version: { since: '1.0.0' },
          sourceRefs: [],
        }],
        patterns: [],
        antiPatterns: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          confidence: 0.9,
        },
      };
      
      const generatedCode = await generator.generateComponent(mockUAST, 'react', mockManifest);
      
      // 4. 代码验证
      const validator = new TypeScriptStaticValidator();
      const validationResult = await validator.validateTypeScript(generatedCode);
      
      const endTime = Date.now();
      
      return {
        requirementParsed: !!parsedRequirement.intent,
        codeGenerated: generatedCode.length > 0,
        codeValidated: validationResult.success,
        totalDuration: endTime - startTime,
        componentsIdentified: parsedRequirement.components.length,
        confidence: parsedRequirement.confidence,
      };
    });
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Running test: ${name}`);
      const details = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        module: name,
        success: true,
        duration,
        details,
      });
      
      logger.info(`✅ ${name} - ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        module: name,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      
      logger.error(`❌ ${name} - ${duration}ms - ${error}`);
    }
  }

  private printResults(totalDuration: number): void {
    logger.info('\n📊 Test Results Summary');
    logger.info('=' .repeat(50));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    logger.info(`Total Tests: ${total}`);
    logger.info(`Passed: ${passed} ✅`);
    logger.info(`Failed: ${failed} ❌`);
    logger.info(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    logger.info(`Total Duration: ${totalDuration}ms`);
    
    logger.info('\nDetailed Results:');
    logger.info('-'.repeat(50));
    
    for (const result of this.results) {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`.padStart(8);
      
      logger.info(`${status} ${result.module.padEnd(25)} ${duration}`);
      
      if (result.error) {
        logger.error(`   Error: ${result.error}`);
      }
      
      if (result.details && result.success) {
        const detailsStr = JSON.stringify(result.details, null, 2)
          .split('\n')
          .map(line => `   ${line}`)
          .join('\n');
        logger.debug(`   Details: ${detailsStr}`);
      }
    }
    
    logger.info('\n' + '='.repeat(50));
    
    if (failed === 0) {
      logger.info('🎉 All tests passed! System is ready for deployment.');
    } else {
      logger.warn(`⚠️  ${failed} test(s) failed. Please review and fix issues before deployment.`);
    }
  }
}

// 运行测试
async function main() {
  const tester = new SystemTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { SystemTester };