import { 
  KnowledgeGraphBuilder, 
  GraphValidationResult,
  GraphStore,
  ComponentManifest,
  ComponentSpec,
  UsagePattern,
  AntiPattern,
  GraphNode,
  GraphRelationship,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('KnowledgeGraphBuilder');

export class KPCKnowledgeGraphBuilder implements KnowledgeGraphBuilder {
  constructor(private graphStore: GraphStore) {}

  async buildFromManifest(manifest: ComponentManifest): Promise<void> {
    logger.info(`Building knowledge graph from manifest: ${manifest.library} v${manifest.version}`);
    
    try {
      // 创建库节点
      const libraryId = await this.createLibraryNode(manifest);
      
      // 添加组件节点和关系
      const componentIds: string[] = [];
      for (const component of manifest.components) {
        const componentId = await this.addComponent(component);
        componentIds.push(componentId);
        
        // 创建库到组件的关系
        await this.graphStore.createRelationship({
          id: '',
          type: 'CONTAINS',
          startNode: libraryId,
          endNode: componentId,
          properties: { version: manifest.version },
        });
      }
      
      // 添加使用模式
      for (const pattern of manifest.patterns) {
        await this.addUsagePattern(pattern);
      }
      
      // 添加反模式
      for (const antiPattern of manifest.antiPatterns) {
        await this.addAntiPattern(antiPattern);
      }
      
      // 推断组件之间的关系
      await this.inferRelationships();
      
      logger.info(`Knowledge graph built successfully with ${componentIds.length} components`);
      
    } catch (error) {
      logger.error(`Failed to build knowledge graph: ${error}`);
      throw error;
    }
  }

  async addComponent(component: ComponentSpec): Promise<string> {
    logger.debug(`Adding component: ${component.name}`);
    
    try {
      // 创建组件节点
      const componentNode: GraphNode = {
        id: '',
        type: 'Component',
        properties: {
          name: component.name,
          category: component.category,
          description: component.description,
          version: component.version.since,
          deprecated: component.version.deprecated || false,
          frameworks: component.frameworks.map(f => f.framework),
        },
        labels: ['Component'],
      };
      
      const componentId = await this.graphStore.createNode(componentNode);
      
      // 添加属性节点和关系
      for (const prop of component.props) {
        const propId = await this.addProperty(prop, componentId);
        
        // 创建组件到属性的关系
        await this.graphStore.createRelationship({
          id: '',
          type: 'HAS_PROPERTY',
          startNode: componentId,
          endNode: propId,
          properties: {
            required: prop.required,
            deprecated: prop.deprecated,
          },
        });
      }
      
      // 添加事件节点和关系
      for (const event of component.events) {
        const eventId = await this.addEvent(event, componentId);
        
        // 创建组件到事件的关系
        await this.graphStore.createRelationship({
          id: '',
          type: 'EMITS_EVENT',
          startNode: componentId,
          endNode: eventId,
          properties: {
            deprecated: event.deprecated,
          },
        });
      }
      
      // 添加插槽节点和关系
      for (const slot of component.slots) {
        const slotId = await this.addSlot(slot, componentId);
        
        // 创建组件到插槽的关系
        await this.graphStore.createRelationship({
          id: '',
          type: 'HAS_SLOT',
          startNode: componentId,
          endNode: slotId,
          properties: {
            deprecated: slot.deprecated,
          },
        });
      }
      
      // 添加框架实现关系
      for (const framework of component.frameworks) {
        const frameworkId = await this.getOrCreateFrameworkNode(framework.framework);
        
        await this.graphStore.createRelationship({
          id: '',
          type: 'IMPLEMENTED_IN',
          startNode: componentId,
          endNode: frameworkId,
          properties: {
            module: framework.import.module,
            named: framework.import.named,
            examples: framework.examples.length,
          },
        });
      }
      
      // 添加组合规则关系
      for (const rule of component.composability) {
        await this.addComposabilityRule(rule, componentId);
      }
      
      return componentId;
      
    } catch (error) {
      logger.error(`Failed to add component ${component.name}: ${error}`);
      throw error;
    }
  }

  async addProperty(property: any, componentId: string): Promise<string> {
    const propertyNode: GraphNode = {
      id: '',
      type: 'Property',
      properties: {
        id: `${componentId}_${property.name}`,
        name: property.name,
        type: property.type,
        required: property.required,
        deprecated: property.deprecated || false,
        description: property.docs,
        defaultValue: property.default,
      },
      labels: ['Property'],
    };
    
    return await this.graphStore.createNode(propertyNode);
  }

  async addEvent(event: any, componentId: string): Promise<string> {
    const eventNode: GraphNode = {
      id: '',
      type: 'Event',
      properties: {
        id: `${componentId}_${event.name}`,
        name: event.name,
        type: event.type,
        payload: event.payload,
        deprecated: event.deprecated || false,
        description: event.docs,
      },
      labels: ['Event'],
    };
    
    return await this.graphStore.createNode(eventNode);
  }

  async addSlot(slot: any, componentId: string): Promise<string> {
    const slotNode: GraphNode = {
      id: '',
      type: 'Slot',
      properties: {
        id: `${componentId}_${slot.name}`,
        name: slot.name,
        type: slot.type,
        deprecated: slot.deprecated || false,
        description: slot.docs,
      },
      labels: ['Slot'],
    };
    
    return await this.graphStore.createNode(slotNode);
  }

  async addUsagePattern(pattern: UsagePattern): Promise<string> {
    logger.debug(`Adding usage pattern: ${pattern.name}`);
    
    try {
      const patternNode: GraphNode = {
        id: '',
        type: 'Pattern',
        properties: {
          id: pattern.id,
          name: pattern.name,
          description: pattern.description,
          template: pattern.template,
          bestPractices: pattern.bestPractices,
        },
        labels: ['Pattern', 'UsagePattern'],
      };
      
      const patternId = await this.graphStore.createNode(patternNode);
      
      // 创建模式到组件的关系
      for (const componentName of pattern.components) {
        const components = await this.graphStore.findNodes('Component', { name: componentName });
        
        for (const component of components) {
          await this.graphStore.createRelationship({
            id: '',
            type: 'USES_COMPONENT',
            startNode: patternId,
            endNode: component.id,
            properties: {},
          });
        }
      }
      
      return patternId;
      
    } catch (error) {
      logger.error(`Failed to add usage pattern ${pattern.name}: ${error}`);
      throw error;
    }
  }

  async addAntiPattern(antiPattern: AntiPattern): Promise<string> {
    logger.debug(`Adding anti-pattern: ${antiPattern.name}`);
    
    try {
      const antiPatternNode: GraphNode = {
        id: '',
        type: 'AntiPattern',
        properties: {
          id: antiPattern.id,
          name: antiPattern.name,
          description: antiPattern.description,
          badExample: antiPattern.badExample,
          goodExample: antiPattern.goodExample,
          reason: antiPattern.reason,
          severity: antiPattern.severity,
        },
        labels: ['Pattern', 'AntiPattern'],
      };
      
      return await this.graphStore.createNode(antiPatternNode);
      
    } catch (error) {
      logger.error(`Failed to add anti-pattern ${antiPattern.name}: ${error}`);
      throw error;
    }
  }

  async inferRelationships(): Promise<void> {
    logger.info('Inferring relationships between components');
    
    try {
      // 推断组件相似性关系
      await this.inferSimilarityRelationships();
      
      // 推断组件依赖关系
      await this.inferDependencyRelationships();
      
      // 推断属性类型关系
      await this.inferPropertyTypeRelationships();
      
      // 推断事件关系
      await this.inferEventRelationships();
      
      logger.info('Relationship inference completed');
      
    } catch (error) {
      logger.error(`Failed to infer relationships: ${error}`);
      throw error;
    }
  }

  async validateGraph(): Promise<GraphValidationResult> {
    logger.info('Validating knowledge graph');
    
    try {
      const result: GraphValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        orphanedNodes: [],
        missingRelationships: [],
      };
      
      // 检查孤立节点
      const orphanedNodes = await this.findOrphanedNodes();
      result.orphanedNodes = orphanedNodes;
      
      if (orphanedNodes.length > 0) {
        result.warnings.push(`Found ${orphanedNodes.length} orphaned nodes`);
      }
      
      // 检查必需的关系
      const missingRelationships = await this.findMissingRelationships();
      result.missingRelationships = missingRelationships;
      
      if (missingRelationships.length > 0) {
        result.errors.push(`Found ${missingRelationships.length} missing required relationships`);
        result.valid = false;
      }
      
      // 检查数据完整性
      const integrityErrors = await this.checkDataIntegrity();
      result.errors.push(...integrityErrors);
      
      if (integrityErrors.length > 0) {
        result.valid = false;
      }
      
      logger.info(`Graph validation completed: ${result.valid ? 'VALID' : 'INVALID'}`);
      return result;
      
    } catch (error) {
      logger.error(`Failed to validate graph: ${error}`);
      throw error;
    }
  }

  private async createLibraryNode(manifest: ComponentManifest): Promise<string> {
    const libraryNode: GraphNode = {
      id: '',
      type: 'Library',
      properties: {
        name: manifest.library,
        version: manifest.version,
        generatedAt: manifest.metadata.generatedAt,
        sourceCommit: manifest.metadata.sourceCommit,
        confidence: manifest.metadata.confidence,
        componentCount: manifest.components.length,
        patternCount: manifest.patterns.length,
        antiPatternCount: manifest.antiPatterns.length,
      },
      labels: ['Library'],
    };
    
    return await this.graphStore.createNode(libraryNode);
  }

  private async getOrCreateFrameworkNode(framework: string): Promise<string> {
    // 查找现有框架节点
    const existingFrameworks = await this.graphStore.findNodes('Framework', { name: framework });
    
    if (existingFrameworks.length > 0) {
      return existingFrameworks[0].id;
    }
    
    // 创建新的框架节点
    const frameworkNode: GraphNode = {
      id: '',
      type: 'Framework',
      properties: {
        name: framework,
        description: `${framework} framework`,
      },
      labels: ['Framework'],
    };
    
    return await this.graphStore.createNode(frameworkNode);
  }

  private async addComposabilityRule(rule: any, componentId: string): Promise<void> {
    // 查找目标组件
    const targetComponents = await this.graphStore.findNodes('Component', { name: rule.target });
    
    for (const targetComponent of targetComponents) {
      const relationshipType = this.mapComposabilityRuleToRelationType(rule.type);
      
      await this.graphStore.createRelationship({
        id: '',
        type: relationshipType,
        startNode: componentId,
        endNode: targetComponent.id,
        properties: {
          condition: rule.condition,
          message: rule.message,
        },
      });
    }
  }

  private mapComposabilityRuleToRelationType(ruleType: string): string {
    const mapping: Record<string, string> = {
      'allows_child': 'ALLOWS_CHILD',
      'forbids_child': 'FORBIDS_CHILD',
      'requires_parent': 'REQUIRES_PARENT',
      'conflicts_with': 'CONFLICTS_WITH',
    };
    
    return mapping[ruleType] || 'RELATED_TO';
  }

  private async inferSimilarityRelationships(): Promise<void> {
    // 基于组件名称和类别推断相似性
    const components = await this.graphStore.findNodes('Component');
    
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const comp1 = components[i];
        const comp2 = components[j];
        
        const similarity = this.calculateComponentSimilarity(comp1, comp2);
        
        if (similarity > 0.7) {
          await this.graphStore.createRelationship({
            id: '',
            type: 'SIMILAR_TO',
            startNode: comp1.id,
            endNode: comp2.id,
            properties: { similarity },
          });
        }
      }
    }
  }

  private async inferDependencyRelationships(): Promise<void> {
    // 基于属性类型推断依赖关系
    const components = await this.graphStore.findNodes('Component');
    
    for (const component of components) {
      const properties = await this.graphStore.findNeighbors(component.id, 'HAS_PROPERTY', 'out');
      
      for (const property of properties) {
        const propType = property.properties?.type;
        
        if (propType && this.isComponentType(propType)) {
          const dependencyComponents = await this.graphStore.findNodes('Component', { name: propType });
          
          for (const depComponent of dependencyComponents) {
            await this.graphStore.createRelationship({
              id: '',
              type: 'DEPENDS_ON',
              startNode: component.id,
              endNode: depComponent.id,
              properties: { reason: 'property_type' },
            });
          }
        }
      }
    }
  }

  private async inferPropertyTypeRelationships(): Promise<void> {
    // 推断相同类型属性之间的关系
    const properties = await this.graphStore.findNodes('Property');
    const typeGroups: Record<string, GraphNode[]> = {};
    
    // 按类型分组
    for (const property of properties) {
      const type = property.properties?.type;
      if (type) {
        if (!typeGroups[type]) {
          typeGroups[type] = [];
        }
        typeGroups[type].push(property);
      }
    }
    
    // 为同类型属性创建关系
    for (const [type, props] of Object.entries(typeGroups)) {
      if (props.length > 1) {
        for (let i = 0; i < props.length; i++) {
          for (let j = i + 1; j < props.length; j++) {
            await this.graphStore.createRelationship({
              id: '',
              type: 'SAME_TYPE',
              startNode: props[i].id,
              endNode: props[j].id,
              properties: { type },
            });
          }
        }
      }
    }
  }

  private async inferEventRelationships(): Promise<void> {
    // 推断事件之间的关系
    const events = await this.graphStore.findNodes('Event');
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];
        
        if (this.areRelatedEvents(event1, event2)) {
          await this.graphStore.createRelationship({
            id: '',
            type: 'RELATED_EVENT',
            startNode: event1.id,
            endNode: event2.id,
            properties: {},
          });
        }
      }
    }
  }

  private calculateComponentSimilarity(comp1: GraphNode, comp2: GraphNode): number {
    let similarity = 0;
    
    // 比较类别
    if (comp1.properties?.category === comp2.properties?.category) {
      similarity += 0.3;
    }
    
    // 比较名称相似性
    const name1 = comp1.properties?.name || '';
    const name2 = comp2.properties?.name || '';
    const nameSimilarity = this.calculateStringSimilarity(name1, name2);
    similarity += nameSimilarity * 0.4;
    
    // 比较框架支持
    const frameworks1 = comp1.properties?.frameworks || [];
    const frameworks2 = comp2.properties?.frameworks || [];
    const frameworkOverlap = this.calculateArrayOverlap(frameworks1, frameworks2);
    similarity += frameworkOverlap * 0.3;
    
    return similarity;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // 简单的字符串相似度计算（Jaccard相似度）
    const set1 = new Set(str1.toLowerCase().split(''));
    const set2 = new Set(str2.toLowerCase().split(''));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateArrayOverlap(arr1: any[], arr2: any[]): number {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private isComponentType(type: string): boolean {
    // 检查类型是否是组件类型
    return /^[A-Z][a-zA-Z]*$/.test(type) && !['String', 'Number', 'Boolean', 'Array', 'Object'].includes(type);
  }

  private areRelatedEvents(event1: GraphNode, event2: GraphNode): boolean {
    const name1 = event1.properties?.name || '';
    const name2 = event2.properties?.name || '';
    
    // 检查事件名称是否相关
    const relatedPairs = [
      ['click', 'hover'],
      ['focus', 'blur'],
      ['mouseenter', 'mouseleave'],
      ['change', 'input'],
    ];
    
    return relatedPairs.some(([a, b]) => 
      (name1.includes(a) && name2.includes(b)) || 
      (name1.includes(b) && name2.includes(a))
    );
  }

  private async findOrphanedNodes(): Promise<string[]> {
    const result = await this.graphStore.query(`
      MATCH (n)
      WHERE NOT (n)--()
      RETURN elementId(n) as id
    `);
    
    return result.nodes.map(node => node.id);
  }

  private async findMissingRelationships(): Promise<string[]> {
    const missing: string[] = [];
    
    // 检查组件是否有属性关系
    const componentsWithoutProps = await this.graphStore.query(`
      MATCH (c:Component)
      WHERE NOT (c)-[:HAS_PROPERTY]->()
      RETURN c.name as name
    `);
    
    for (const record of componentsWithoutProps.nodes) {
      missing.push(`Component ${record.properties?.name} has no properties`);
    }
    
    return missing;
  }

  private async checkDataIntegrity(): Promise<string[]> {
    const errors: string[] = [];
    
    // 检查必需字段
    const componentsWithoutName = await this.graphStore.query(`
      MATCH (c:Component)
      WHERE c.name IS NULL OR c.name = ''
      RETURN count(c) as count
    `);
    
    const count = componentsWithoutName.nodes[0]?.properties?.count || 0;
    if (count > 0) {
      errors.push(`Found ${count} components without names`);
    }
    
    return errors;
  }
}