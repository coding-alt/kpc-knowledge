import { 
  RequirementParser, 
  AIProvider,
  RequirementParseResult, 
  UAST, 
  UASTNode,
  ValidationResult,
  ComponentManifest,
  ComponentSpec,
  createLogger,
  createSuccessResult,
  createErrorResult 
} from '@kpc/shared';

const logger = createLogger('RequirementParser');

export class AIRequirementParser implements RequirementParser {
  constructor(private aiProvider: AIProvider) {}

  async parseRequirement(requirement: string): Promise<RequirementParseResult> {
    logger.info(`Parsing requirement: ${requirement.substring(0, 100)}...`);
    
    try {
      const prompt = this.buildRequirementParsePrompt(requirement);
      const result = await this.aiProvider.parseStructured<RequirementParseResult>(
        prompt,
        this.getRequirementParseSchema()
      );
      
      // 验证解析结果
      if (!result.intent || result.components.length === 0) {
        throw new Error('Invalid requirement parse result');
      }
      
      logger.info(`Parsed requirement: ${result.components.length} components identified`);
      return result;
      
    } catch (error) {
      logger.error(`Failed to parse requirement: ${error}`);
      throw error;
    }
  }

  async generateUAST(requirement: RequirementParseResult, manifest: ComponentManifest): Promise<UAST> {
    logger.info(`Generating UAST for requirement: ${requirement.intent}`);
    
    try {
      // 验证组件是否在清单中存在
      const validComponents = this.validateComponents(requirement.components, manifest);
      
      if (validComponents.length === 0) {
        throw new Error('No valid components found in manifest');
      }
      
      // 构建UAST结构
      const uast = await this.buildUASTStructure(requirement, validComponents, manifest);
      
      // 应用约束
      const constrainedUAST = this.applyConstraints(uast, manifest);
      
      logger.info(`Generated UAST with ${this.countNodes(constrainedUAST)} nodes`);
      return constrainedUAST;
      
    } catch (error) {
      logger.error(`Failed to generate UAST: ${error}`);
      throw error;
    }
  }

  validateUAST(uast: UAST, manifest: ComponentManifest): ValidationResult {
    logger.debug('Validating UAST structure');
    
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // 验证节点结构
      this.validateNodeStructure(uast, errors, warnings);
      
      // 验证组件存在性
      this.validateComponentExistence(uast, manifest, errors);
      
      // 验证属性约束
      this.validatePropertyConstraints(uast, manifest, errors, warnings);
      
      // 验证组合规则
      this.validateCompositionRules(uast, manifest, errors, warnings);
      
      if (errors.length > 0) {
        return createErrorResult(errors.join('; '), 'error', { warnings });
      }
      
      return createSuccessResult({ warnings });
      
    } catch (error) {
      logger.error(`UAST validation failed: ${error}`);
      return createErrorResult(`Validation error: ${error}`, 'error');
    }
  }

  async optimizeUAST(uast: UAST): Promise<UAST> {
    logger.debug('Optimizing UAST structure');
    
    try {
      let optimized = { ...uast };
      
      // 移除冗余节点
      optimized = this.removeRedundantNodes(optimized);
      
      // 合并相似节点
      optimized = this.mergeSimilarNodes(optimized);
      
      // 优化嵌套结构
      optimized = this.optimizeNesting(optimized);
      
      // 应用最佳实践
      optimized = this.applyBestPractices(optimized);
      
      logger.debug('UAST optimization completed');
      return optimized;
      
    } catch (error) {
      logger.error(`UAST optimization failed: ${error}`);
      return uast; // 返回原始UAST
    }
  }

  private buildRequirementParsePrompt(requirement: string): string {
    return `
Analyze the following UI requirement and extract structured information:

Requirement: "${requirement}"

Please identify:
1. The main intent/purpose of the UI
2. Required components (use standard component names like Button, Input, Modal, etc.)
3. Layout structure (if specified)
4. User interactions (click, hover, input, etc.)
5. Any constraints or special requirements

Return the analysis in the following JSON format:
{
  "intent": "Brief description of what the UI should do",
  "components": ["Component1", "Component2", ...],
  "layout": "Description of layout structure",
  "interactions": ["interaction1", "interaction2", ...],
  "constraints": ["constraint1", "constraint2", ...],
  "confidence": 0.95
}

Focus on identifying standard UI components and common interaction patterns.
`;
  }

  private getRequirementParseSchema(): any {
    return {
      type: 'object',
      properties: {
        intent: { type: 'string' },
        components: { 
          type: 'array', 
          items: { type: 'string' } 
        },
        layout: { type: 'string' },
        interactions: { 
          type: 'array', 
          items: { type: 'string' } 
        },
        constraints: { 
          type: 'array', 
          items: { type: 'string' } 
        },
        confidence: { 
          type: 'number', 
          minimum: 0, 
          maximum: 1 
        },
      },
      required: ['intent', 'components', 'confidence'],
    };
  }

  private validateComponents(components: string[], manifest: ComponentManifest): ComponentSpec[] {
    const validComponents: ComponentSpec[] = [];
    
    for (const componentName of components) {
      const spec = manifest.components.find(c => 
        c.name.toLowerCase() === componentName.toLowerCase() ||
        c.alias?.some(alias => alias.toLowerCase() === componentName.toLowerCase())
      );
      
      if (spec) {
        validComponents.push(spec);
      } else {
        logger.warn(`Component not found in manifest: ${componentName}`);
      }
    }
    
    return validComponents;
  }

  private async buildUASTStructure(
    requirement: RequirementParseResult,
    components: ComponentSpec[],
    manifest: ComponentManifest
  ): Promise<UAST> {
    // 确定根组件
    const rootComponent = this.determineRootComponent(requirement, components);
    
    // 构建UAST节点
    const rootNode: UASTNode = {
      type: rootComponent.name,
      props: this.inferProps(requirement, rootComponent),
      children: await this.buildChildNodes(requirement, components, manifest),
      metadata: {
        componentName: rootComponent.name,
        framework: 'react', // 默认框架，后续可配置
        constraints: this.extractConstraints(rootComponent),
        confidence: requirement.confidence,
      },
    };
    
    return rootNode;
  }

  private determineRootComponent(
    requirement: RequirementParseResult,
    components: ComponentSpec[]
  ): ComponentSpec {
    // 优先选择容器类组件
    const containerComponents = ['Form', 'Modal', 'Card', 'Container', 'Layout'];
    
    for (const containerName of containerComponents) {
      const container = components.find(c => 
        c.name.toLowerCase().includes(containerName.toLowerCase())
      );
      if (container) {
        return container;
      }
    }
    
    // 如果没有容器组件，选择第一个组件
    return components[0];
  }

  private inferProps(
    requirement: RequirementParseResult,
    component: ComponentSpec
  ): Record<string, any> {
    const props: Record<string, any> = {};
    
    // 设置必需属性的默认值
    for (const prop of component.props) {
      if (prop.required && prop.default !== undefined) {
        props[prop.name] = prop.default;
      }
    }
    
    // 从需求中推断属性值
    const intent = requirement.intent.toLowerCase();
    
    // 推断常见属性
    if (intent.includes('submit') && component.name.toLowerCase().includes('button')) {
      props.type = 'submit';
    }
    
    if (intent.includes('disabled') || intent.includes('readonly')) {
      props.disabled = true;
    }
    
    if (intent.includes('required')) {
      props.required = true;
    }
    
    return props;
  }

  private async buildChildNodes(
    requirement: RequirementParseResult,
    components: ComponentSpec[],
    manifest: ComponentManifest
  ): Promise<UASTNode[]> {
    const children: UASTNode[] = [];
    
    // 为每个非根组件创建子节点
    for (const component of components.slice(1)) {
      const childNode: UASTNode = {
        type: component.name,
        props: this.inferProps(requirement, component),
        metadata: {
          componentName: component.name,
          framework: 'react',
          constraints: this.extractConstraints(component),
          confidence: requirement.confidence * 0.9, // 子节点置信度略低
        },
      };
      
      children.push(childNode);
    }
    
    return children;
  }

  private extractConstraints(component: ComponentSpec): any[] {
    const constraints: any[] = [];
    
    // 从组件规格中提取约束
    for (const rule of component.composability) {
      constraints.push({
        type: rule.type,
        target: rule.target,
        value: rule.condition,
        message: rule.message,
      });
    }
    
    // 添加属性约束
    for (const prop of component.props) {
      if (prop.required) {
        constraints.push({
          type: 'prop_required',
          target: prop.name,
          message: `Property ${prop.name} is required`,
        });
      }
      
      if (prop.enum) {
        constraints.push({
          type: 'prop_enum',
          target: prop.name,
          value: prop.enum,
          message: `Property ${prop.name} must be one of: ${prop.enum.join(', ')}`,
        });
      }
    }
    
    return constraints;
  }

  private applyConstraints(uast: UAST, manifest: ComponentManifest): UAST {
    // 递归应用约束到所有节点
    return this.applyConstraintsToNode(uast, manifest);
  }

  private applyConstraintsToNode(node: UASTNode, manifest: ComponentManifest): UASTNode {
    const constrainedNode = { ...node };
    
    // 应用组件约束
    const component = manifest.components.find(c => c.name === node.metadata.componentName);
    if (component) {
      // 验证并修正属性
      constrainedNode.props = this.validateAndFixProps(node.props || {}, component);
    }
    
    // 递归处理子节点
    if (node.children) {
      constrainedNode.children = node.children.map(child => 
        this.applyConstraintsToNode(child, manifest)
      );
    }
    
    return constrainedNode;
  }

  private validateAndFixProps(props: Record<string, any>, component: ComponentSpec): Record<string, any> {
    const validatedProps = { ...props };
    
    for (const propSpec of component.props) {
      const propValue = props[propSpec.name];
      
      // 设置必需属性的默认值
      if (propSpec.required && propValue === undefined && propSpec.default !== undefined) {
        validatedProps[propSpec.name] = propSpec.default;
      }
      
      // 验证枚举值
      if (propSpec.enum && propValue !== undefined) {
        if (!propSpec.enum.includes(propValue)) {
          validatedProps[propSpec.name] = propSpec.enum[0]; // 使用第一个有效值
        }
      }
    }
    
    return validatedProps;
  }

  private validateNodeStructure(node: UASTNode, errors: string[], warnings: string[]): void {
    if (!node.type) {
      errors.push('Node missing type');
    }
    
    if (!node.metadata || !node.metadata.componentName) {
      errors.push('Node missing component metadata');
    }
    
    if (node.metadata && node.metadata.confidence < 0.5) {
      warnings.push(`Low confidence node: ${node.metadata.componentName}`);
    }
    
    // 递归验证子节点
    if (node.children) {
      for (const child of node.children) {
        this.validateNodeStructure(child, errors, warnings);
      }
    }
  }

  private validateComponentExistence(node: UASTNode, manifest: ComponentManifest, errors: string[]): void {
    const component = manifest.components.find(c => c.name === node.metadata.componentName);
    
    if (!component) {
      errors.push(`Component not found in manifest: ${node.metadata.componentName}`);
    }
    
    // 递归验证子节点
    if (node.children) {
      for (const child of node.children) {
        this.validateComponentExistence(child, manifest, errors);
      }
    }
  }

  private validatePropertyConstraints(
    node: UASTNode, 
    manifest: ComponentManifest, 
    errors: string[], 
    warnings: string[]
  ): void {
    const component = manifest.components.find(c => c.name === node.metadata.componentName);
    
    if (component) {
      const props = node.props || {};
      
      // 验证必需属性
      for (const propSpec of component.props) {
        if (propSpec.required && props[propSpec.name] === undefined) {
          errors.push(`Required property missing: ${propSpec.name} in ${component.name}`);
        }
        
        if (propSpec.deprecated && props[propSpec.name] !== undefined) {
          warnings.push(`Using deprecated property: ${propSpec.name} in ${component.name}`);
        }
      }
    }
    
    // 递归验证子节点
    if (node.children) {
      for (const child of node.children) {
        this.validatePropertyConstraints(child, manifest, errors, warnings);
      }
    }
  }

  private validateCompositionRules(
    node: UASTNode, 
    manifest: ComponentManifest, 
    errors: string[], 
    warnings: string[]
  ): void {
    const component = manifest.components.find(c => c.name === node.metadata.componentName);
    
    if (component && node.children) {
      for (const rule of component.composability) {
        switch (rule.type) {
          case 'forbids_child':
            const forbiddenChild = node.children.find(child => 
              child.metadata.componentName === rule.target
            );
            if (forbiddenChild) {
              errors.push(`Forbidden child component: ${rule.target} in ${component.name}`);
            }
            break;
            
          case 'requires_parent':
            // 这个验证需要父节点信息，暂时跳过
            break;
        }
      }
    }
    
    // 递归验证子节点
    if (node.children) {
      for (const child of node.children) {
        this.validateCompositionRules(child, manifest, errors, warnings);
      }
    }
  }

  private countNodes(node: UASTNode): number {
    let count = 1;
    
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    
    return count;
  }

  private removeRedundantNodes(uast: UAST): UAST {
    // 移除冗余节点的逻辑
    return uast;
  }

  private mergeSimilarNodes(uast: UAST): UAST {
    // 合并相似节点的逻辑
    return uast;
  }

  private optimizeNesting(uast: UAST): UAST {
    // 优化嵌套结构的逻辑
    return uast;
  }

  private applyBestPractices(uast: UAST): UAST {
    // 应用最佳实践的逻辑
    return uast;
  }
}