import { 
  CodeGenerator, 
  TemplateEngine,
  GeneratedCode, 
  CodeMetadata,
  ImportStatement,
  ExportStatement,
  UAST, 
  UASTNode,
  Framework, 
  ComponentManifest,
  ComponentSpec,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('CodeGenerator');

export class KPCCodeGenerator implements CodeGenerator {
  constructor(private templateEngine: TemplateEngine) {}

  async generateCode(context: any): Promise<GeneratedCode> {
    logger.info(`Generating code for framework: ${context.framework}`);
    
    try {
      const component = await this.generateComponent(
        context.uast, 
        context.framework, 
        context.manifest
      );
      
      const styles = context.options?.cssModules ? 
        await this.generateStyles(context.uast, context.framework) : undefined;
      
      const tests = context.options?.tests ? 
        await this.generateTests(context.uast, context.framework) : undefined;
      
      const stories = context.options?.storybook ? 
        await this.generateStories(context.uast, context.framework) : undefined;
      
      const types = context.options?.typescript ? 
        await this.generateTypes(context.uast, context.framework) : undefined;

      const metadata = this.generateMetadata(context.uast, context.framework, context.manifest);

      const generatedCode: GeneratedCode = {
        component,
        styles,
        tests,
        stories,
        types,
        metadata,
      };

      logger.info(`Code generation completed for ${metadata.componentName}`);
      return generatedCode;

    } catch (error) {
      logger.error(`Failed to generate code: ${error}`);
      throw error;
    }
  }

  async generateComponent(uast: UAST, framework: Framework, manifest: ComponentManifest): Promise<string> {
    logger.debug(`Generating ${framework} component`);
    
    try {
      const templateData = this.buildTemplateData(uast, framework, manifest);
      const templateName = this.getComponentTemplateName(framework);
      
      const component = await this.templateEngine.render(templateName, templateData);
      
      // 后处理：格式化和优化代码
      const formattedComponent = this.formatCode(component, framework);
      
      return formattedComponent;

    } catch (error) {
      logger.error(`Failed to generate ${framework} component: ${error}`);
      throw error;
    }
  }

  async generateStyles(uast: UAST, framework: Framework): Promise<string> {
    logger.debug(`Generating styles for ${framework}`);
    
    try {
      const styleData = this.extractStyleData(uast);
      
      if (framework === 'vue') {
        return this.generateVueStyles(styleData);
      } else {
        return this.generateCSSModules(styleData);
      }

    } catch (error) {
      logger.error(`Failed to generate styles: ${error}`);
      throw error;
    }
  }

  async generateTests(uast: UAST, framework: Framework): Promise<string> {
    logger.debug(`Generating tests for ${framework}`);
    
    try {
      const testData = this.buildTestData(uast, framework);
      const testTemplate = await this.templateEngine.render('component-test', testData);
      
      return this.formatCode(testTemplate, 'typescript');

    } catch (error) {
      logger.error(`Failed to generate tests: ${error}`);
      throw error;
    }
  }

  async generateStories(uast: UAST, framework: Framework): Promise<string> {
    logger.debug(`Generating Storybook stories for ${framework}`);
    
    try {
      const storyData = this.buildStoryData(uast, framework);
      const stories = await this.templateEngine.render('storybook-stories', storyData);
      
      return this.formatCode(stories, 'typescript');

    } catch (error) {
      logger.error(`Failed to generate stories: ${error}`);
      throw error;
    }
  }

  private async generateTypes(uast: UAST, framework: Framework): Promise<string> {
    logger.debug(`Generating TypeScript types for ${framework}`);
    
    try {
      const typeData = this.buildTypeData(uast, framework);
      const types = await this.templateEngine.render('typescript-interface', typeData);
      
      return this.formatCode(types, 'typescript');

    } catch (error) {
      logger.error(`Failed to generate types: ${error}`);
      throw error;
    }
  }

  private buildTemplateData(uast: UAST, framework: Framework, manifest: ComponentManifest): any {
    const componentName = uast.metadata.componentName;
    const componentSpec = manifest.components.find(c => c.name === componentName);
    
    if (!componentSpec) {
      throw new Error(`Component spec not found: ${componentName}`);
    }

    const frameworkBinding = componentSpec.frameworks.find(f => f.framework === framework);
    
    if (!frameworkBinding) {
      throw new Error(`Framework binding not found: ${framework} for ${componentName}`);
    }

    const templateData = {
      componentName,
      framework,
      imports: this.generateImports(uast, framework, componentSpec),
      interfaces: this.generateInterfaces(componentSpec),
      props: componentSpec.props,
      events: componentSpec.events,
      slots: componentSpec.slots,
      propsInterface: `${componentName}Props`,
      destructuredProps: this.getDestructuredProps(componentSpec.props),
      componentDoc: componentSpec.description,
      defaultExport: true,
      ...this.buildComponentStructure(uast, framework),
    };

    return templateData;
  }

  private generateImports(uast: UAST, framework: Framework, componentSpec: ComponentSpec): ImportStatement[] {
    const imports: ImportStatement[] = [];

    // 框架核心导入
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
          named: ['defineComponent', 'PropType'],
        });
        break;
      
      case 'intact':
        imports.push({
          module: 'intact',
          named: ['Component'],
        });
        break;
    }

    // 组件依赖导入
    const dependencies = this.extractDependencies(uast);
    for (const dep of dependencies) {
      imports.push({
        module: dep.module,
        named: dep.components,
      });
    }

    return imports;
  }

  private generateInterfaces(componentSpec: ComponentSpec): any[] {
    const interfaces = [];

    // Props接口
    if (componentSpec.props.length > 0) {
      interfaces.push({
        name: `${componentSpec.name}Props`,
        properties: componentSpec.props,
        doc: `Props for ${componentSpec.name} component`,
      });
    }

    // Events接口
    if (componentSpec.events.length > 0) {
      interfaces.push({
        name: `${componentSpec.name}Events`,
        properties: componentSpec.events.map(event => ({
          name: event.name,
          type: event.payload || 'void',
          required: false,
          docs: event.docs,
        })),
        doc: `Events for ${componentSpec.name} component`,
      });
    }

    return interfaces;
  }

  private getDestructuredProps(props: any[]): any[] {
    return props.map(prop => ({
      name: prop.name,
      required: prop.required,
      default: prop.default,
    }));
  }

  private buildComponentStructure(uast: UAST, framework: Framework): any {
    const structure = this.convertUASTToTemplateStructure(uast, framework);
    
    return {
      tagName: structure.tagName,
      className: structure.className,
      attributes: structure.attributes,
      children: structure.children,
      textContent: structure.textContent,
    };
  }

  private convertUASTToTemplateStructure(node: UASTNode, framework: Framework): any {
    const componentName = node.metadata.componentName;
    
    // 将组件名转换为HTML标签名或组件引用
    const tagName = this.getTagName(componentName, framework);
    
    const structure = {
      tagName,
      className: this.generateClassName(node, framework),
      attributes: this.convertPropsToAttributes(node.props || {}, framework),
      children: node.children ? 
        node.children.map(child => this.convertUASTToTemplateStructure(child, framework)) : 
        undefined,
      textContent: this.extractTextContent(node),
    };

    return structure;
  }

  private getTagName(componentName: string, framework: Framework): string {
    // HTML标签映射
    const htmlTags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'input', 'form'];
    
    if (htmlTags.includes(componentName.toLowerCase())) {
      return componentName.toLowerCase();
    }

    // 组件名处理
    switch (framework) {
      case 'react':
        return componentName; // React使用PascalCase
      
      case 'vue':
        return this.toKebabCase(componentName); // Vue使用kebab-case
      
      case 'intact':
        return componentName; // Intact使用PascalCase
      
      default:
        return componentName;
    }
  }

  private generateClassName(node: UASTNode, framework: Framework): string | undefined {
    const componentName = node.metadata.componentName;
    
    // 生成基础类名
    const baseClassName = this.toKebabCase(componentName);
    
    // 添加状态类名
    const stateClasses = [];
    const props = node.props || {};
    
    if (props.disabled) stateClasses.push('disabled');
    if (props.active) stateClasses.push('active');
    if (props.loading) stateClasses.push('loading');
    
    const allClasses = [baseClassName, ...stateClasses];
    return allClasses.length > 0 ? allClasses.join(' ') : undefined;
  }

  private convertPropsToAttributes(props: Record<string, any>, framework: Framework): any[] {
    const attributes = [];

    for (const [name, value] of Object.entries(props)) {
      // 跳过特殊属性
      if (['children', 'className', 'class'].includes(name)) {
        continue;
      }

      const attribute = {
        name: this.convertPropName(name, framework),
        value: this.convertPropValue(value, framework),
        isString: typeof value === 'string',
      };

      attributes.push(attribute);
    }

    return attributes;
  }

  private convertPropName(propName: string, framework: Framework): string {
    switch (framework) {
      case 'react':
        return propName; // React使用camelCase
      
      case 'vue':
        // Vue支持kebab-case和camelCase，这里使用kebab-case
        return this.toKebabCase(propName);
      
      case 'intact':
        return propName; // Intact使用camelCase
      
      default:
        return propName;
    }
  }

  private convertPropValue(value: any, framework: Framework): string {
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'boolean') {
      switch (framework) {
        case 'react':
          return `{${value}}`;
        case 'vue':
          return value.toString();
        case 'intact':
          return `{${value}}`;
        default:
          return value.toString();
      }
    }
    
    if (typeof value === 'number') {
      switch (framework) {
        case 'react':
          return `{${value}}`;
        case 'vue':
          return value.toString();
        case 'intact':
          return `{${value}}`;
        default:
          return value.toString();
      }
    }
    
    // 对象和数组
    return `{${JSON.stringify(value)}}`;
  }

  private extractTextContent(node: UASTNode): string | undefined {
    // 如果节点有文本内容属性
    if (node.props?.children && typeof node.props.children === 'string') {
      return node.props.children;
    }
    
    // 如果是叶子节点且没有子组件，可能包含文本
    if (!node.children || node.children.length === 0) {
      const componentName = node.metadata.componentName.toLowerCase();
      
      // 某些组件类型的默认文本
      if (componentName.includes('button')) {
        return 'Button';
      }
      
      if (componentName.includes('text') || componentName.includes('label')) {
        return 'Text';
      }
    }
    
    return undefined;
  }

  private extractDependencies(uast: UAST): { module: string; components: string[] }[] {
    const dependencies: Map<string, Set<string>> = new Map();
    
    this.collectDependencies(uast, dependencies);
    
    return Array.from(dependencies.entries()).map(([module, components]) => ({
      module,
      components: Array.from(components),
    }));
  }

  private collectDependencies(node: UASTNode, dependencies: Map<string, Set<string>>): void {
    const componentName = node.metadata.componentName;
    
    // 假设组件来自KPC库
    const module = `@kpc/react`; // 可以根据实际情况调整
    
    if (!dependencies.has(module)) {
      dependencies.set(module, new Set());
    }
    
    dependencies.get(module)!.add(componentName);
    
    // 递归处理子节点
    if (node.children) {
      for (const child of node.children) {
        this.collectDependencies(child, dependencies);
      }
    }
  }

  private extractStyleData(uast: UAST): any {
    // 从UAST中提取样式相关数据
    return {
      componentName: uast.metadata.componentName,
      styles: this.collectStyles(uast),
    };
  }

  private collectStyles(node: UASTNode): any[] {
    const styles = [];
    
    // 收集节点的样式
    if (node.props?.style) {
      styles.push({
        selector: `.${this.toKebabCase(node.metadata.componentName)}`,
        rules: node.props.style,
      });
    }
    
    // 递归收集子节点样式
    if (node.children) {
      for (const child of node.children) {
        styles.push(...this.collectStyles(child));
      }
    }
    
    return styles;
  }

  private generateVueStyles(styleData: any): string {
    const { styles } = styleData;
    
    return styles.map((style: any) => `
${style.selector} {
${Object.entries(style.rules).map(([prop, value]) => `  ${prop}: ${value};`).join('\n')}
}
`).join('\n');
  }

  private generateCSSModules(styleData: any): string {
    const { componentName, styles } = styleData;
    
    return `
.${this.toKebabCase(componentName)} {
  /* Component styles */
}

${styles.map((style: any) => `
${style.selector} {
${Object.entries(style.rules).map(([prop, value]) => `  ${prop}: ${value};`).join('\n')}
}
`).join('\n')}
`;
  }

  private buildTestData(uast: UAST, framework: Framework): any {
    const componentName = uast.metadata.componentName;
    
    return {
      componentName,
      imports: [
        { module: '@testing-library/react', named: ['render', 'screen'] },
        { module: '@testing-library/jest-dom', default: 'expect' },
        { module: `./${componentName}`, default: componentName },
      ],
      testCases: [
        {
          description: 'renders without crashing',
          testBody: `
const component = render(<${componentName} />);
expect(component).toBeTruthy();
          `,
        },
        {
          description: 'displays correct content',
          testBody: `
const component = render(<${componentName} />);
expect(screen.getByRole('button')).toBeInTheDocument();
          `,
        },
      ],
    };
  }

  private buildStoryData(uast: UAST, framework: Framework): any {
    const componentName = uast.metadata.componentName;
    
    return {
      componentName,
      storyTitle: `Components/${componentName}`,
      imports: [
        { module: '@storybook/react', named: ['Meta', 'StoryObj'] },
        { module: `./${componentName}`, default: componentName },
      ],
      argTypes: this.generateArgTypes(uast),
      stories: [
        {
          name: 'Default',
          args: this.generateDefaultArgs(uast),
        },
        {
          name: 'WithProps',
          args: this.generatePropsArgs(uast),
        },
      ],
    };
  }

  private buildTypeData(uast: UAST, framework: Framework): any {
    const componentName = uast.metadata.componentName;
    
    return {
      name: `${componentName}Props`,
      properties: this.extractPropsFromUAST(uast),
      doc: `Props interface for ${componentName} component`,
    };
  }

  private generateArgTypes(uast: UAST): any[] {
    const props = this.extractPropsFromUAST(uast);
    
    return props.map(prop => ({
      name: prop.name,
      control: this.getControlType(prop.type),
      description: prop.docs,
      options: prop.enum,
    }));
  }

  private getControlType(type: string): string {
    const controlMap: Record<string, string> = {
      'string': 'text',
      'number': 'number',
      'boolean': 'boolean',
      'array': 'object',
      'object': 'object',
    };
    
    return controlMap[type.toLowerCase()] || 'text';
  }

  private generateDefaultArgs(uast: UAST): Record<string, any> {
    const props = this.extractPropsFromUAST(uast);
    const args: Record<string, any> = {};
    
    for (const prop of props) {
      if (prop.default !== undefined) {
        args[prop.name] = prop.default;
      }
    }
    
    return args;
  }

  private generatePropsArgs(uast: UAST): Record<string, any> {
    const props = this.extractPropsFromUAST(uast);
    const args: Record<string, any> = {};
    
    for (const prop of props) {
      args[prop.name] = this.getExampleValue(prop.type);
    }
    
    return args;
  }

  private getExampleValue(type: string): any {
    const exampleMap: Record<string, any> = {
      'string': 'Example text',
      'number': 42,
      'boolean': true,
      'array': [],
      'object': {},
    };
    
    return exampleMap[type.toLowerCase()] || 'example';
  }

  private extractPropsFromUAST(uast: UAST): any[] {
    // 从UAST中提取属性定义
    return Object.entries(uast.props || {}).map(([name, value]) => ({
      name,
      type: typeof value,
      required: true,
      docs: `${name} property`,
    }));
  }

  private generateMetadata(uast: UAST, framework: Framework, manifest: ComponentManifest): CodeMetadata {
    const componentName = uast.metadata.componentName;
    const dependencies = this.extractDependencies(uast);
    
    return {
      framework,
      componentName,
      dependencies: dependencies.map(dep => dep.module),
      imports: this.generateImports(uast, framework, manifest.components.find(c => c.name === componentName)!),
      exports: [
        { name: componentName, type: 'default' },
        { name: `${componentName}Props`, type: 'named' },
      ],
      generatedAt: new Date().toISOString(),
      confidence: uast.metadata.confidence || 0.8,
    };
  }

  private getComponentTemplateName(framework: Framework): string {
    const templateMap: Record<Framework, string> = {
      'react': 'react-component',
      'vue': 'vue-component',
      'intact': 'intact-component',
    };
    
    return templateMap[framework];
  }

  private formatCode(code: string, language: string): string {
    // 基础代码格式化
    return code
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 移除多余空行
      .replace(/^\s+$/gm, '') // 移除只包含空格的行
      .trim();
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }
}