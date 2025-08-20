import { 
  RequirementParseResult, 
  UAST, 
  GeneratedCode,
  ValidationResult,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('GenerateService');

export class GenerateService {
  
  async parseRequirement(requirement: string): Promise<RequirementParseResult> {
    logger.debug(`Parsing requirement: ${requirement}`);
    
    // 模拟需求解析
    const components = this.extractComponents(requirement);
    const intent = this.extractIntent(requirement);
    
    return {
      intent,
      components,
      layout: this.extractLayout(requirement),
      interactions: this.extractInteractions(requirement),
      constraints: this.extractConstraints(requirement),
      confidence: 0.85,
    };
  }

  async generateUAST(requirement: RequirementParseResult): Promise<UAST> {
    logger.debug('Generating UAST from requirement');
    
    // 模拟UAST生成
    const primaryComponent = requirement.components[0] || 'div';
    
    const uast: UAST = {
      type: primaryComponent,
      props: this.generateProps(requirement),
      children: this.generateChildren(requirement),
      metadata: {
        componentName: primaryComponent,
        framework: 'react',
        constraints: [],
        confidence: requirement.confidence * 0.9,
      },
    };
    
    return uast;
  }

  async generateCode(uast: UAST, options: any): Promise<GeneratedCode> {
    logger.debug(`Generating ${options.framework} code`);
    
    const componentName = uast.metadata.componentName;
    const component = this.generateComponentCode(uast, options);
    
    const metadata = {
      framework: options.framework,
      componentName,
      dependencies: this.extractDependencies(uast),
      imports: this.generateImports(uast, options.framework),
      exports: [{ name: componentName, type: 'default' as const }],
      generatedAt: new Date().toISOString(),
      confidence: uast.metadata.confidence || 0.8,
    };

    const result: GeneratedCode = {
      component,
      metadata,
    };

    if (options.tests) {
      result.tests = this.generateTests(uast, options.framework);
    }

    if (options.stories) {
      result.stories = this.generateStories(uast, options.framework);
    }

    return result;
  }

  async validateCode(code: string, framework: string): Promise<ValidationResult> {
    logger.debug('Validating generated code');
    
    // 简单的代码验证
    const errors = [];
    const warnings = [];
    
    // 检查基本语法
    if (!code.includes('export')) {
      errors.push({
        message: 'Component must have an export statement',
        severity: 'error' as const,
      });
    }
    
    if (framework === 'react' && !code.includes('React')) {
      warnings.push('React import might be missing');
    }
    
    if (code.includes('console.log')) {
      warnings.push('Remove console.log statements in production code');
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  async writeFiles(generatedCode: GeneratedCode, options: any): Promise<string[]> {
    logger.debug(`Writing files to ${options.output}`);
    
    const files = [];
    const componentName = generatedCode.metadata.componentName;
    const extension = options.typescript ? 'tsx' : 'jsx';
    
    // 主组件文件
    const componentFile = `${options.output}/${componentName}.${extension}`;
    files.push(componentFile);
    
    // 测试文件
    if (generatedCode.tests) {
      const testFile = `${options.output}/${componentName}.test.${extension}`;
      files.push(testFile);
    }
    
    // Storybook文件
    if (generatedCode.stories) {
      const storyFile = `${options.output}/${componentName}.stories.${extension}`;
      files.push(storyFile);
    }
    
    // 这里应该实际写入文件，但为了演示，我们只返回文件路径
    return files;
  }

  private extractComponents(requirement: string): string[] {
    const components = [];
    
    // 简单的组件识别逻辑
    const componentKeywords = {
      'button': 'Button',
      'input': 'Input',
      'form': 'Form',
      'modal': 'Modal',
      'dialog': 'Dialog',
      'navigation': 'Navigation',
      'nav': 'Navigation',
      'menu': 'Menu',
      'table': 'Table',
      'list': 'List',
      'card': 'Card',
      'header': 'Header',
      'footer': 'Footer',
    };
    
    const lowerReq = requirement.toLowerCase();
    
    for (const [keyword, component] of Object.entries(componentKeywords)) {
      if (lowerReq.includes(keyword)) {
        components.push(component);
      }
    }
    
    return components.length > 0 ? components : ['Component'];
  }

  private extractIntent(requirement: string): string {
    // 提取主要意图
    if (requirement.toLowerCase().includes('create')) {
      return `Create ${requirement.replace(/create\s+/i, '')}`;
    }
    
    return requirement;
  }

  private extractLayout(requirement: string): string | undefined {
    if (requirement.toLowerCase().includes('responsive')) {
      return 'responsive';
    }
    
    if (requirement.toLowerCase().includes('grid')) {
      return 'grid';
    }
    
    if (requirement.toLowerCase().includes('flex')) {
      return 'flexbox';
    }
    
    return undefined;
  }

  private extractInteractions(requirement: string): string[] {
    const interactions = [];
    
    if (requirement.toLowerCase().includes('click')) {
      interactions.push('click');
    }
    
    if (requirement.toLowerCase().includes('hover')) {
      interactions.push('hover');
    }
    
    if (requirement.toLowerCase().includes('submit')) {
      interactions.push('submit');
    }
    
    return interactions;
  }

  private extractConstraints(requirement: string): string[] {
    const constraints = [];
    
    if (requirement.toLowerCase().includes('accessible')) {
      constraints.push('accessibility');
    }
    
    if (requirement.toLowerCase().includes('mobile')) {
      constraints.push('mobile-friendly');
    }
    
    return constraints;
  }

  private generateProps(requirement: RequirementParseResult): Record<string, any> {
    const props: Record<string, any> = {};
    
    // 基于组件类型生成默认属性
    if (requirement.components.includes('Button')) {
      props.children = 'Click me';
      props.variant = 'primary';
    }
    
    if (requirement.components.includes('Input')) {
      props.placeholder = 'Enter text...';
      props.type = 'text';
    }
    
    return props;
  }

  private generateChildren(requirement: RequirementParseResult): any[] | undefined {
    // 如果有多个组件，生成子组件
    if (requirement.components.length > 1) {
      return requirement.components.slice(1).map(component => ({
        type: component,
        props: {},
        metadata: {
          componentName: component,
          framework: 'react' as const,
          constraints: [],
        },
      }));
    }
    
    return undefined;
  }

  private generateComponentCode(uast: UAST, options: any): string {
    const componentName = uast.metadata.componentName;
    const framework = options.framework;
    
    switch (framework) {
      case 'react':
        return this.generateReactCode(uast, options);
      case 'vue':
        return this.generateVueCode(uast, options);
      case 'intact':
        return this.generateIntactCode(uast, options);
      default:
        return this.generateReactCode(uast, options);
    }
  }

  private generateReactCode(uast: UAST, options: any): string {
    const componentName = uast.metadata.componentName;
    const props = uast.props || {};
    
    const propsInterface = options.typescript ? `
interface ${componentName}Props {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}
` : '';

    const propsType = options.typescript ? `: React.FC<${componentName}Props>` : '';
    const propsParam = options.typescript ? '{ children, className, onClick }' : 'props';
    const propsAccess = options.typescript ? '' : 'props.';

    return `import React from 'react';
${propsInterface}
/**
 * ${componentName} component
 * Generated by KPC Knowledge System
 */
const ${componentName}${propsType} = (${propsParam}) => {
  return (
    <${uast.type.toLowerCase()}
      className={className}
      onClick={onClick}
    >
      {children || '${props.children || componentName}'}
    </${uast.type.toLowerCase()}>
  );
};

export default ${componentName};`;
  }

  private generateVueCode(uast: UAST, options: any): string {
    const componentName = uast.metadata.componentName;
    const props = uast.props || {};

    return `<template>
  <${uast.type.toLowerCase()}
    :class="className"
    @click="handleClick"
  >
    <slot>${props.children || componentName}</slot>
  </${uast.type.toLowerCase()}>
</template>

<script setup lang="ts">
interface Props {
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  className: '',
});

const emit = defineEmits<{
  click: [];
}>();

const handleClick = () => {
  emit('click');
};
</script>

<style scoped>
/* Component styles */
</style>`;
  }

  private generateIntactCode(uast: UAST, options: any): string {
    const componentName = uast.metadata.componentName;
    const props = uast.props || {};

    return `import { Component } from 'intact';

export default class ${componentName} extends Component {
  static template = \`
    <${uast.type.toLowerCase()}
      class={{ {className} }}
      ev-click={{ {this.handleClick} }}
    >
      <b:block>${props.children || componentName}</b:block>
    </${uast.type.toLowerCase()}>
  \`;

  static defaults() {
    return {
      className: '',
    };
  }

  handleClick() {
    this.trigger('click');
  }
}`;
  }

  private generateTests(uast: UAST, framework: string): string {
    const componentName = uast.metadata.componentName;

    return `import { render, screen } from '@testing-library/react';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  it('renders without crashing', () => {
    render(<${componentName} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<${componentName} onClick={handleClick} />);
    
    screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});`;
  }

  private generateStories(uast: UAST, framework: string): string {
    const componentName = uast.metadata.componentName;

    return `import type { Meta, StoryObj } from '@storybook/react';
import ${componentName} from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomText: Story = {
  args: {
    children: 'Custom Button Text',
  },
};`;
  }

  private extractDependencies(uast: UAST): string[] {
    const deps = ['react'];
    
    // 基于组件类型添加依赖
    if (uast.metadata.componentName.includes('Icon')) {
      deps.push('@heroicons/react');
    }
    
    return deps;
  }

  private generateImports(uast: UAST, framework: string): any[] {
    const imports = [];
    
    switch (framework) {
      case 'react':
        imports.push({
          module: 'react',
          default: 'React',
        });
        break;
      case 'vue':
        imports.push({
          module: 'vue',
          named: ['defineComponent'],
        });
        break;
      case 'intact':
        imports.push({
          module: 'intact',
          named: ['Component'],
        });
        break;
    }
    
    return imports;
  }
}