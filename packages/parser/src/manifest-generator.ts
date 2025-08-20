import { 
  ComponentDefinition, 
  ComponentManifest, 
  ComponentSpec,
  UsagePattern,
  AntiPattern,
  ValidationResult,
  FrameworkBinding,
  createLogger,
  validateWithSchema,
  ComponentManifestSchema
} from '@kpc/shared';
import { CrossFrameworkAligner, AlignedComponent } from './framework-alignment';

const logger = createLogger('ManifestGenerator');

export interface ManifestGenerator {
  /**
   * 从组件定义生成组件清单
   */
  generateManifest(components: ComponentDefinition[]): Promise<ComponentManifest>;
  
  /**
   * 验证组件清单
   */
  validateManifest(manifest: ComponentManifest): ValidationResult;
  
  /**
   * 检测反模式
   */
  detectAntiPatterns(components: ComponentDefinition[]): AntiPattern[];
  
  /**
   * 提取使用模式
   */
  extractUsagePatterns(components: ComponentDefinition[]): UsagePattern[];
}

export class KPCManifestGenerator implements ManifestGenerator {
  private aligner: CrossFrameworkAligner;
  
  constructor() {
    this.aligner = new CrossFrameworkAligner();
  }

  async generateManifest(components: ComponentDefinition[]): Promise<ComponentManifest> {
    logger.info(`Generating manifest from ${components.length} components`);
    
    try {
      // 跨框架对齐
      const alignedComponents = this.aligner.alignComponents(components);
      
      // 生成组件规格
      const componentSpecs = await this.generateComponentSpecs(alignedComponents);
      
      // 提取使用模式
      const patterns = this.extractUsagePatterns(components);
      
      // 检测反模式
      const antiPatterns = this.detectAntiPatterns(components);
      
      const manifest: ComponentManifest = {
        library: 'KPC',
        version: this.extractLibraryVersion(components),
        components: componentSpecs,
        patterns,
        antiPatterns,
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceCommit: this.extractSourceCommit(components),
          confidence: this.calculateOverallConfidence(alignedComponents),
        },
      };
      
      logger.info(`Generated manifest with ${componentSpecs.length} component specs`);
      return manifest;
      
    } catch (error) {
      logger.error(`Failed to generate manifest: ${error}`);
      throw error;
    }
  }

  validateManifest(manifest: ComponentManifest): ValidationResult {
    logger.info('Validating component manifest');
    
    // 使用Zod schema验证
    const schemaResult = validateWithSchema(manifest, ComponentManifestSchema);
    if (!schemaResult.success) {
      return schemaResult;
    }
    
    // 额外的业务逻辑验证
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 验证组件规格
    for (const component of manifest.components) {
      const componentErrors = this.validateComponentSpec(component);
      errors.push(...componentErrors);
    }
    
    // 验证使用模式
    for (const pattern of manifest.patterns) {
      const patternErrors = this.validateUsagePattern(pattern, manifest.components);
      errors.push(...patternErrors);
    }
    
    // 验证反模式
    for (const antiPattern of manifest.antiPatterns) {
      const antiPatternErrors = this.validateAntiPattern(antiPattern);
      warnings.push(...antiPatternErrors);
    }
    
    return {
      success: errors.length === 0,
      errors: errors.map(msg => ({ message: msg, severity: 'error' as const })),
      warnings,
    };
  }

  detectAntiPatterns(components: ComponentDefinition[]): AntiPattern[] {
    logger.info('Detecting anti-patterns in components');
    
    const antiPatterns: AntiPattern[] = [];
    
    // 检测常见反模式
    antiPatterns.push(...this.detectNamingAntiPatterns(components));
    antiPatterns.push(...this.detectPropAntiPatterns(components));
    antiPatterns.push(...this.detectEventAntiPatterns(components));
    antiPatterns.push(...this.detectStructuralAntiPatterns(components));
    
    logger.info(`Detected ${antiPatterns.length} anti-patterns`);
    return antiPatterns;
  }

  extractUsagePatterns(components: ComponentDefinition[]): UsagePattern[] {
    logger.info('Extracting usage patterns from components');
    
    const patterns: UsagePattern[] = [];
    
    // 提取常见使用模式
    patterns.push(...this.extractFormPatterns(components));
    patterns.push(...this.extractLayoutPatterns(components));
    patterns.push(...this.extractDataDisplayPatterns(components));
    patterns.push(...this.extractFeedbackPatterns(components));
    
    logger.info(`Extracted ${patterns.length} usage patterns`);
    return patterns;
  }

  private async generateComponentSpecs(alignedComponents: AlignedComponent[]): Promise<ComponentSpec[]> {
    const specs: ComponentSpec[] = [];
    
    for (const aligned of alignedComponents) {
      try {
        const spec = await this.generateComponentSpec(aligned);
        specs.push(spec);
      } catch (error) {
        logger.warn(`Failed to generate spec for component ${aligned.name}: ${error}`);
      }
    }
    
    return specs;
  }

  private async generateComponentSpec(aligned: AlignedComponent): Promise<ComponentSpec> {
    // 选择主要实现（通常是React版本）
    const primaryImpl = aligned.frameworks.find(f => f.framework === 'react') || aligned.frameworks[0];
    
    const spec: ComponentSpec = {
      name: aligned.name,
      alias: this.extractAliases(aligned),
      import: {
        module: this.inferModuleName(aligned.name),
        named: aligned.name,
      },
      category: aligned.category,
      description: aligned.description,
      frameworks: this.generateFrameworkBindings(aligned),
      props: aligned.unifiedProps.map(prop => ({
        name: prop.name,
        type: prop.type,
        required: prop.required,
        docs: prop.description,
        sourceRef: primaryImpl.component.sourceRefs[0], // 使用主要实现的源引用
      })),
      events: aligned.unifiedEvents.map(event => ({
        name: event.name,
        type: event.type,
        payload: event.payload,
        docs: event.description,
        sourceRef: primaryImpl.component.sourceRefs[0],
      })),
      slots: aligned.unifiedSlots.map(slot => ({
        name: slot.name,
        type: slot.type,
        docs: slot.description,
        sourceRef: primaryImpl.component.sourceRefs[0],
      })),
      styleTokens: primaryImpl.component.styleTokens,
      composability: this.generateComposabilityRules(aligned),
      antiPatterns: this.generateComponentAntiPatterns(aligned),
      version: {
        since: '1.0.0', // TODO: 从源码中提取版本信息
      },
      sourceRefs: primaryImpl.component.sourceRefs,
    };
    
    return spec;
  }

  private generateFrameworkBindings(aligned: AlignedComponent): FrameworkBinding[] {
    const bindings: FrameworkBinding[] = [];
    
    for (const impl of aligned.frameworks) {
      const binding: FrameworkBinding = {
        framework: impl.framework,
        import: {
          module: this.inferModuleName(aligned.name, impl.framework),
          named: impl.component.name,
        },
        props: aligned.unifiedProps.map(prop => {
          const mapping = prop.frameworkMappings[impl.framework];
          return {
            name: prop.name,
            frameworkName: mapping?.name,
            type: mapping?.type || prop.type,
            transform: mapping?.transform,
          };
        }),
        events: aligned.unifiedEvents.map(event => {
          const mapping = event.frameworkMappings[impl.framework];
          return {
            name: event.name,
            frameworkName: mapping?.name,
            type: mapping?.type || event.type,
            transform: mapping?.transform,
          };
        }),
        slots: aligned.unifiedSlots.map(slot => {
          const mapping = slot.frameworkMappings[impl.framework];
          return {
            name: slot.name,
            frameworkName: mapping?.name,
            type: mapping?.type || slot.type,
          };
        }),
        examples: this.generateFrameworkExamples(aligned, impl.framework),
      };
      
      bindings.push(binding);
    }
    
    return bindings;
  }

  private generateFrameworkExamples(aligned: AlignedComponent, framework: string): any[] {
    // 生成框架特定的代码示例
    const examples = [];
    
    // 基础使用示例
    examples.push({
      title: `Basic ${aligned.name} Usage`,
      description: `Basic usage of ${aligned.name} component`,
      code: this.generateBasicExample(aligned, framework as any),
      framework,
      category: 'basic',
    });
    
    // 高级使用示例
    if (aligned.unifiedProps.length > 2) {
      examples.push({
        title: `Advanced ${aligned.name} Usage`,
        description: `Advanced usage with multiple props`,
        code: this.generateAdvancedExample(aligned, framework as any),
        framework,
        category: 'advanced',
      });
    }
    
    return examples;
  }

  private generateBasicExample(aligned: AlignedComponent, framework: 'react' | 'vue' | 'intact'): string {
    const requiredProps = aligned.unifiedProps.filter(p => p.required);
    
    switch (framework) {
      case 'react':
        const propsStr = requiredProps.map(p => `${p.name}="example"`).join(' ');
        return `<${aligned.name} ${propsStr} />`;
      
      case 'vue':
        const vuePropsStr = requiredProps.map(p => `:${p.name}="'example'"`).join(' ');
        return `<${aligned.name} ${vuePropsStr} />`;
      
      case 'intact':
        const intactPropsStr = requiredProps.map(p => `${p.name}="example"`).join(' ');
        return `<${aligned.name} ${intactPropsStr} />`;
      
      default:
        return `<${aligned.name} />`;
    }
  }

  private generateAdvancedExample(aligned: AlignedComponent, framework: 'react' | 'vue' | 'intact'): string {
    const allProps = aligned.unifiedProps.slice(0, 4); // 限制属性数量
    
    switch (framework) {
      case 'react':
        const propsStr = allProps.map(p => `${p.name}={${this.getExampleValue(p.type)}}`).join('\n  ');
        return `<${aligned.name}\n  ${propsStr}\n/>`;
      
      case 'vue':
        const vuePropsStr = allProps.map(p => `:${p.name}="${this.getExampleValue(p.type)}"`).join('\n  ');
        return `<${aligned.name}\n  ${vuePropsStr}\n/>`;
      
      case 'intact':
        const intactPropsStr = allProps.map(p => `${p.name}={${this.getExampleValue(p.type)}}`).join('\n  ');
        return `<${aligned.name}\n  ${intactPropsStr}\n/>`;
      
      default:
        return `<${aligned.name} />`;
    }
  }

  private getExampleValue(type: string): string {
    switch (type.toLowerCase()) {
      case 'string': return '"example"';
      case 'number': return '42';
      case 'boolean': return 'true';
      case 'array': return '[]';
      case 'object': return '{}';
      case 'function': return '() => {}';
      default: return '"example"';
    }
  }

  private generateComposabilityRules(aligned: AlignedComponent): any[] {
    // 生成组合规则
    const rules = [];
    
    // 基于组件类型生成规则
    if (aligned.category === 'form') {
      rules.push({
        type: 'requires_parent',
        target: 'Form',
        message: 'Form components should be used within a Form container',
      });
    }
    
    return rules;
  }

  private generateComponentAntiPatterns(aligned: AlignedComponent): AntiPattern[] {
    // 为特定组件生成反模式
    return [];
  }

  private detectNamingAntiPatterns(components: ComponentDefinition[]): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    
    for (const component of components) {
      // 检测命名不一致
      if (component.name.includes('_') || component.name.includes('-')) {
        patterns.push({
          id: `naming-${component.name}`,
          name: 'Inconsistent Naming',
          description: 'Component name uses non-standard naming convention',
          badExample: component.name,
          goodExample: this.toPascalCase(component.name),
          reason: 'Component names should use PascalCase',
          severity: 'warning',
        });
      }
    }
    
    return patterns;
  }

  private detectPropAntiPatterns(components: ComponentDefinition[]): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    
    for (const component of components) {
      for (const prop of component.props) {
        // 检测布尔属性命名
        if (prop.type === 'boolean' && !prop.name.startsWith('is') && !prop.name.startsWith('has') && !prop.name.startsWith('can')) {
          patterns.push({
            id: `prop-boolean-${component.name}-${prop.name}`,
            name: 'Boolean Prop Naming',
            description: 'Boolean props should have descriptive names',
            badExample: `${prop.name}: boolean`,
            goodExample: `is${this.capitalize(prop.name)}: boolean`,
            reason: 'Boolean props should clearly indicate their purpose',
            severity: 'info',
          });
        }
      }
    }
    
    return patterns;
  }

  private detectEventAntiPatterns(components: ComponentDefinition[]): AntiPattern[] {
    // 检测事件相关反模式
    return [];
  }

  private detectStructuralAntiPatterns(components: ComponentDefinition[]): AntiPattern[] {
    // 检测结构相关反模式
    return [];
  }

  private extractFormPatterns(components: ComponentDefinition[]): UsagePattern[] {
    const formComponents = components.filter(c => 
      c.name.toLowerCase().includes('input') || 
      c.name.toLowerCase().includes('button') ||
      c.name.toLowerCase().includes('form')
    );
    
    if (formComponents.length === 0) return [];
    
    return [{
      id: 'form-pattern',
      name: 'Form Pattern',
      description: 'Common form layout pattern',
      components: formComponents.map(c => c.name),
      template: 'Form with input fields and submit button',
      examples: [],
      bestPractices: [
        'Use proper form validation',
        'Provide clear error messages',
        'Include proper labels for accessibility',
      ],
    }];
  }

  private extractLayoutPatterns(components: ComponentDefinition[]): UsagePattern[] {
    // 提取布局模式
    return [];
  }

  private extractDataDisplayPatterns(components: ComponentDefinition[]): UsagePattern[] {
    // 提取数据展示模式
    return [];
  }

  private extractFeedbackPatterns(components: ComponentDefinition[]): UsagePattern[] {
    // 提取反馈模式
    return [];
  }

  private validateComponentSpec(spec: ComponentSpec): string[] {
    const errors: string[] = [];
    
    if (!spec.name) {
      errors.push('Component spec must have a name');
    }
    
    if (!spec.description) {
      errors.push(`Component ${spec.name} must have a description`);
    }
    
    if (spec.frameworks.length === 0) {
      errors.push(`Component ${spec.name} must have at least one framework implementation`);
    }
    
    return errors;
  }

  private validateUsagePattern(pattern: UsagePattern, components: ComponentSpec[]): string[] {
    const errors: string[] = [];
    const componentNames = components.map(c => c.name);
    
    for (const componentName of pattern.components) {
      if (!componentNames.includes(componentName)) {
        errors.push(`Usage pattern ${pattern.id} references unknown component: ${componentName}`);
      }
    }
    
    return errors;
  }

  private validateAntiPattern(antiPattern: AntiPattern): string[] {
    const warnings: string[] = [];
    
    if (!antiPattern.goodExample) {
      warnings.push(`Anti-pattern ${antiPattern.id} should provide a good example`);
    }
    
    return warnings;
  }

  private extractLibraryVersion(components: ComponentDefinition[]): string {
    // TODO: 从源码或package.json中提取版本
    return '1.0.0';
  }

  private extractSourceCommit(components: ComponentDefinition[]): string | undefined {
    // TODO: 从git信息中提取commit hash
    return undefined;
  }

  private calculateOverallConfidence(alignedComponents: AlignedComponent[]): number {
    if (alignedComponents.length === 0) return 0;
    
    const totalConfidence = alignedComponents.reduce((sum, comp) => sum + comp.confidence, 0);
    return totalConfidence / alignedComponents.length;
  }

  private extractAliases(aligned: AlignedComponent): string[] {
    // 提取组件别名
    const aliases = new Set<string>();
    
    for (const impl of aligned.frameworks) {
      if (impl.component.name !== aligned.name) {
        aliases.add(impl.component.name);
      }
    }
    
    return Array.from(aliases);
  }

  private inferModuleName(componentName: string, framework?: string): string {
    const baseName = componentName.toLowerCase();
    
    switch (framework) {
      case 'react':
        return `@kpc/react/${baseName}`;
      case 'vue':
        return `@kpc/vue/${baseName}`;
      case 'intact':
        return `@kpc/intact/${baseName}`;
      default:
        return `@kpc/${baseName}`;
    }
  }

  private toPascalCase(str: string): string {
    return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase())
              .replace(/^(.)/, char => char.toUpperCase());
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}