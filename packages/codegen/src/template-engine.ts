import Handlebars from 'handlebars';
import { 
  TemplateEngine, 
  CompiledTemplate,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('TemplateEngine');

export class HandlebarsTemplateEngine implements TemplateEngine {
  private templates: Map<string, CompiledTemplate> = new Map();
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
    this.registerBuiltinTemplates();
  }

  registerTemplate(name: string, template: string): void {
    logger.debug(`Registering template: ${name}`);
    
    try {
      const compiled = this.handlebars.compile(template);
      this.templates.set(name, compiled);
      logger.debug(`Template ${name} registered successfully`);
    } catch (error) {
      logger.error(`Failed to register template ${name}: ${error}`);
      throw error;
    }
  }

  async render(templateName: string, data: any): Promise<string> {
    logger.debug(`Rendering template: ${templateName}`);
    
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    try {
      const result = template(data);
      logger.debug(`Template ${templateName} rendered successfully`);
      return result;
    } catch (error) {
      logger.error(`Failed to render template ${templateName}: ${error}`);
      throw error;
    }
  }

  compile(template: string): CompiledTemplate {
    try {
      return this.handlebars.compile(template);
    } catch (error) {
      logger.error(`Failed to compile template: ${error}`);
      throw error;
    }
  }

  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  private registerHelpers(): void {
    // 注册自定义helpers
    
    // 首字母大写
    this.handlebars.registerHelper('capitalize', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // 驼峰命名转换
    this.handlebars.registerHelper('camelCase', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
    });

    // Pascal命名转换
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      if (typeof str !== 'string') return str;
      const camelCase = str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });

    // kebab命名转换
    this.handlebars.registerHelper('kebabCase', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    });

    // 条件渲染
    this.handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });

    // 数组包含检查
    this.handlebars.registerHelper('includes', (array: any[], item: any) => {
      return Array.isArray(array) && array.includes(item);
    });

    // JSON序列化
    this.handlebars.registerHelper('json', (obj: any) => {
      return JSON.stringify(obj, null, 2);
    });

    // 类型转换
    this.handlebars.registerHelper('typeToTS', (type: string) => {
      const typeMap: Record<string, string> = {
        'string': 'string',
        'number': 'number',
        'boolean': 'boolean',
        'array': 'any[]',
        'object': 'Record<string, any>',
        'function': '(...args: any[]) => any',
      };
      return typeMap[type.toLowerCase()] || 'any';
    });

    // 生成导入语句
    this.handlebars.registerHelper('generateImports', (imports: any[]) => {
      if (!Array.isArray(imports)) return '';
      
      return imports.map(imp => {
        if (imp.default && imp.named) {
          return `import ${imp.default}, { ${imp.named.join(', ')} } from '${imp.module}';`;
        } else if (imp.default) {
          return `import ${imp.default} from '${imp.module}';`;
        } else if (imp.named) {
          return `import { ${imp.named.join(', ')} } from '${imp.module}';`;
        } else if (imp.namespace) {
          return `import * as ${imp.namespace} from '${imp.module}';`;
        }
        return `import '${imp.module}';`;
      }).join('\n');
    });

    // 生成属性类型定义
    this.handlebars.registerHelper('generatePropTypes', (props: any[]) => {
      if (!Array.isArray(props)) return '';
      
      return props.map(prop => {
        const optional = prop.required ? '' : '?';
        const type = this.handlebars.helpers.typeToTS(prop.type);
        const comment = prop.docs ? `  /** ${prop.docs} */\n` : '';
        return `${comment}  ${prop.name}${optional}: ${type};`;
      }).join('\n');
    });

    logger.debug('Handlebars helpers registered');
  }

  private registerBuiltinTemplates(): void {
    // React组件模板
    this.registerTemplate('react-component', `
{{#if imports}}
{{generateImports imports}}
{{/if}}

{{#if interfaces}}
{{#each interfaces}}
export interface {{name}} {
{{generatePropTypes properties}}
}

{{/each}}
{{/if}}

{{#if componentDoc}}
/**
 * {{componentDoc}}
 */
{{/if}}
export const {{componentName}}: React.FC<{{propsInterface}}> = ({{#if destructuredProps}}{
  {{#each destructuredProps}}
  {{name}}{{#unless required}} = {{default}}{{/unless}},
  {{/each}}
}{{else}}props{{/if}}) => {
  return (
    {{> componentBody}}
  );
};

{{#if defaultExport}}
export default {{componentName}};
{{/if}}
`);

    // Vue组件模板
    this.registerTemplate('vue-component', `
<template>
  {{> componentTemplate}}
</template>

<script setup lang="ts">
{{#if imports}}
{{generateImports imports}}
{{/if}}

{{#if interfaces}}
{{#each interfaces}}
interface {{name}} {
{{generatePropTypes properties}}
}

{{/each}}
{{/if}}

{{#if props}}
const props = defineProps<{{propsInterface}}>();
{{/if}}

{{#if events}}
const emit = defineEmits<{
{{#each events}}
  {{name}}: [{{#if payload}}{{payload}}{{/if}}];
{{/each}}
}>();
{{/if}}

{{#if slots}}
const slots = defineSlots<{
{{#each slots}}
  {{name}}?: ({{#if props}}props: {{props}}{{/if}}) => any;
{{/each}}
}>();
{{/if}}

// Component logic here
</script>

{{#if styles}}
<style scoped>
{{styles}}
</style>
{{/if}}
`);

    // Intact组件模板
    this.registerTemplate('intact-component', `
{{#if imports}}
{{generateImports imports}}
{{/if}}

{{#if interfaces}}
{{#each interfaces}}
export interface {{name}} {
{{generatePropTypes properties}}
}

{{/each}}
{{/if}}

export class {{componentName}} extends Component<{{propsInterface}}> {
  static template = \`
    {{> componentTemplate}}
  \`;

  {{#if defaults}}
  static defaults() {
    return {
{{#each defaults}}
      {{name}}: {{value}},
{{/each}}
    };
  }
  {{/if}}

  {{#if propTypes}}
  static propTypes = {
{{#each propTypes}}
    {{name}}: {{type}},
{{/each}}
  };
  {{/if}}

  // Component methods here
}
`);

    // TypeScript接口模板
    this.registerTemplate('typescript-interface', `
{{#if imports}}
{{generateImports imports}}
{{/if}}

{{#if doc}}
/**
 * {{doc}}
 */
{{/if}}
export interface {{name}}{{#if extends}} extends {{extends}}{{/if}} {
{{generatePropTypes properties}}
}
`);

    // 测试模板
    this.registerTemplate('component-test', `
{{#if imports}}
{{generateImports imports}}
{{/if}}

describe('{{componentName}}', () => {
  {{#each testCases}}
  it('{{description}}', {{#if async}}async {{/if}}() => {
    {{> testBody}}
  });

  {{/each}}
});
`);

    // Storybook stories模板
    this.registerTemplate('storybook-stories', `
{{#if imports}}
{{generateImports imports}}
{{/if}}

const meta: Meta<typeof {{componentName}}> = {
  title: '{{storyTitle}}',
  component: {{componentName}},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
{{#each argTypes}}
    {{name}}: {
      control: '{{control}}',
      {{#if description}}description: '{{description}}',{{/if}}
      {{#if options}}options: {{json options}},{{/if}}
    },
{{/each}}
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

{{#each stories}}
export const {{name}}: Story = {
  args: {{json args}},
  {{#if parameters}}
  parameters: {{json parameters}},
  {{/if}}
};

{{/each}}
`);

    logger.debug('Built-in templates registered');
  }
}

// 注册partials
export function registerPartials(engine: HandlebarsTemplateEngine): void {
  const handlebars = (engine as any).handlebars;

  // React组件主体partial
  handlebars.registerPartial('componentBody', `
<{{tagName}}{{#if className}} className="{{className}}"{{/if}}{{#each attributes}} {{name}}={{#if isString}}"{{value}}"{{else}}{{{value}}}{{/if}}{{/each}}>
  {{#if children}}
  {{#each children}}
  {{> componentBody}}
  {{/each}}
  {{else}}
  {{#if textContent}}{{textContent}}{{/if}}
  {{/if}}
</{{tagName}}>
`);

  // Vue模板partial
  handlebars.registerPartial('componentTemplate', `
<{{tagName}}{{#if className}} class="{{className}}"{{/if}}{{#each attributes}} {{name}}="{{value}}"{{/each}}>
  {{#if children}}
  {{#each children}}
  {{> componentTemplate}}
  {{/each}}
  {{else}}
  {{#if textContent}}{{textContent}}{{/if}}
  {{/if}}
</{{tagName}}>
`);

  // 测试主体partial
  handlebars.registerPartial('testBody', `
const {{#if renderFunction}}{{renderFunction}}{{else}}render{{/if}} = {{renderCall}};
{{#each assertions}}
{{assertion}};
{{/each}}
`);
}