import { 
  ComponentDefinition, 
  Framework, 
  PropDefinition, 
  EventDefinition,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('FrameworkAlignment');

export interface FrameworkAlignment {
  /**
   * 对齐不同框架的组件定义
   */
  alignComponents(components: ComponentDefinition[]): AlignedComponent[];
  
  /**
   * 创建跨框架的属性映射
   */
  createPropMapping(components: ComponentDefinition[]): PropMappingRule[];
  
  /**
   * 创建跨框架的事件映射
   */
  createEventMapping(components: ComponentDefinition[]): EventMappingRule[];
  
  /**
   * 验证对齐结果
   */
  validateAlignment(aligned: AlignedComponent[]): AlignmentValidationResult;
}

export interface AlignedComponent {
  name: string;
  category: string;
  description: string;
  frameworks: FrameworkImplementation[];
  unifiedProps: UnifiedProp[];
  unifiedEvents: UnifiedEvent[];
  unifiedSlots: UnifiedSlot[];
  confidence: number;
}

export interface FrameworkImplementation {
  framework: Framework;
  component: ComponentDefinition;
  propMappings: PropMappingRule[];
  eventMappings: EventMappingRule[];
}

export interface UnifiedProp {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  frameworkMappings: {
    [K in Framework]?: {
      name: string;
      type: string;
      transform?: string;
    };
  };
}

export interface UnifiedEvent {
  name: string;
  type: string;
  payload?: string;
  description?: string;
  frameworkMappings: {
    [K in Framework]?: {
      name: string;
      type: string;
      transform?: string;
    };
  };
}

export interface UnifiedSlot {
  name: string;
  type?: string;
  description?: string;
  frameworkMappings: {
    [K in Framework]?: {
      name: string;
      type?: string;
    };
  };
}

export interface PropMappingRule {
  unifiedName: string;
  mappings: {
    [K in Framework]?: {
      name: string;
      type: string;
      transform?: string;
    };
  };
  confidence: number;
}

export interface EventMappingRule {
  unifiedName: string;
  mappings: {
    [K in Framework]?: {
      name: string;
      type: string;
      transform?: string;
    };
  };
  confidence: number;
}

export interface AlignmentValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    [K in Framework]: number;
  };
}

export class CrossFrameworkAligner implements FrameworkAlignment {
  
  alignComponents(components: ComponentDefinition[]): AlignedComponent[] {
    logger.info(`Aligning ${components.length} components across frameworks`);
    
    // 按组件名称分组
    const componentGroups = this.groupComponentsByName(components);
    const alignedComponents: AlignedComponent[] = [];
    
    for (const [name, groupComponents] of componentGroups) {
      try {
        const aligned = this.alignComponentGroup(name, groupComponents);
        if (aligned) {
          alignedComponents.push(aligned);
        }
      } catch (error) {
        logger.warn(`Failed to align component group ${name}: ${error}`);
      }
    }
    
    logger.info(`Successfully aligned ${alignedComponents.length} component groups`);
    return alignedComponents;
  }

  createPropMapping(components: ComponentDefinition[]): PropMappingRule[] {
    const mappings: PropMappingRule[] = [];
    const propGroups = this.groupPropsBySemantics(components);
    
    for (const [semanticName, props] of propGroups) {
      const mapping: PropMappingRule = {
        unifiedName: semanticName,
        mappings: {},
        confidence: this.calculatePropMappingConfidence(props),
      };
      
      for (const prop of props) {
        const framework = this.getFrameworkFromComponent(prop.component);
        mapping.mappings[framework] = {
          name: prop.name,
          type: prop.type,
          transform: this.generatePropTransform(prop, semanticName),
        };
      }
      
      mappings.push(mapping);
    }
    
    return mappings;
  }

  createEventMapping(components: ComponentDefinition[]): EventMappingRule[] {
    const mappings: EventMappingRule[] = [];
    const eventGroups = this.groupEventsBySemantics(components);
    
    for (const [semanticName, events] of eventGroups) {
      const mapping: EventMappingRule = {
        unifiedName: semanticName,
        mappings: {},
        confidence: this.calculateEventMappingConfidence(events),
      };
      
      for (const event of events) {
        const framework = this.getFrameworkFromComponent(event.component);
        mapping.mappings[framework] = {
          name: event.name,
          type: event.type,
          transform: this.generateEventTransform(event, semanticName),
        };
      }
      
      mappings.push(mapping);
    }
    
    return mappings;
  }

  validateAlignment(aligned: AlignedComponent[]): AlignmentValidationResult {
    const result: AlignmentValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      coverage: {
        react: 0,
        vue: 0,
        intact: 0,
      },
    };
    
    // 计算框架覆盖率
    const frameworkCounts = { react: 0, vue: 0, intact: 0 };
    const totalComponents = aligned.length;
    
    for (const component of aligned) {
      for (const impl of component.frameworks) {
        frameworkCounts[impl.framework]++;
      }
    }
    
    result.coverage.react = frameworkCounts.react / totalComponents;
    result.coverage.vue = frameworkCounts.vue / totalComponents;
    result.coverage.intact = frameworkCounts.intact / totalComponents;
    
    // 验证对齐质量
    for (const component of aligned) {
      if (component.frameworks.length < 2) {
        result.warnings.push(`Component ${component.name} only has ${component.frameworks.length} framework implementation(s)`);
      }
      
      if (component.confidence < 0.8) {
        result.warnings.push(`Component ${component.name} has low alignment confidence: ${component.confidence}`);
      }
      
      // 验证属性对齐
      for (const prop of component.unifiedProps) {
        const frameworkCount = Object.keys(prop.frameworkMappings).length;
        if (frameworkCount < component.frameworks.length) {
          result.warnings.push(`Property ${prop.name} in ${component.name} is missing in some frameworks`);
        }
      }
    }
    
    if (result.errors.length > 0) {
      result.success = false;
    }
    
    return result;
  }

  private groupComponentsByName(components: ComponentDefinition[]): Map<string, ComponentDefinition[]> {
    const groups = new Map<string, ComponentDefinition[]>();
    
    for (const component of components) {
      const normalizedName = this.normalizeComponentName(component.name);
      
      if (!groups.has(normalizedName)) {
        groups.set(normalizedName, []);
      }
      
      groups.get(normalizedName)!.push(component);
    }
    
    return groups;
  }

  private normalizeComponentName(name: string): string {
    // 移除框架特定的前缀/后缀
    return name
      .replace(/^(K|El|Ant|A)([A-Z])/, '$2') // 移除组件库前缀
      .replace(/(Component|Widget)$/, '') // 移除通用后缀
      .toLowerCase();
  }

  private alignComponentGroup(name: string, components: ComponentDefinition[]): AlignedComponent | null {
    if (components.length === 0) return null;
    
    const frameworks: FrameworkImplementation[] = [];
    
    for (const component of components) {
      frameworks.push({
        framework: component.framework,
        component,
        propMappings: [],
        eventMappings: [],
      });
    }
    
    // 对齐属性
    const unifiedProps = this.alignProps(components);
    
    // 对齐事件
    const unifiedEvents = this.alignEvents(components);
    
    // 对齐插槽
    const unifiedSlots = this.alignSlots(components);
    
    // 计算对齐置信度
    const confidence = this.calculateAlignmentConfidence(components, unifiedProps, unifiedEvents);
    
    return {
      name: components[0].name, // 使用第一个组件的名称
      category: this.inferCategory(components),
      description: this.mergeDescriptions(components),
      frameworks,
      unifiedProps,
      unifiedEvents,
      unifiedSlots,
      confidence,
    };
  }

  private alignProps(components: ComponentDefinition[]): UnifiedProp[] {
    const propMap = new Map<string, PropDefinition[]>();
    
    // 收集所有属性
    for (const component of components) {
      for (const prop of component.props) {
        const semanticName = this.getSemanticPropName(prop.name);
        
        if (!propMap.has(semanticName)) {
          propMap.set(semanticName, []);
        }
        
        propMap.get(semanticName)!.push({
          ...prop,
          component: component as any, // 临时添加组件引用
        });
      }
    }
    
    const unifiedProps: UnifiedProp[] = [];
    
    for (const [semanticName, props] of propMap) {
      const unified: UnifiedProp = {
        name: semanticName,
        type: this.unifyPropTypes(props),
        required: this.determinePropRequired(props),
        description: this.mergePropDescriptions(props),
        frameworkMappings: {},
      };
      
      for (const prop of props) {
        const framework = (prop as any).component.framework;
        unified.frameworkMappings[framework] = {
          name: prop.name,
          type: prop.type,
          transform: this.generatePropTransform(prop, semanticName),
        };
      }
      
      unifiedProps.push(unified);
    }
    
    return unifiedProps;
  }

  private alignEvents(components: ComponentDefinition[]): UnifiedEvent[] {
    const eventMap = new Map<string, EventDefinition[]>();
    
    for (const component of components) {
      for (const event of component.events) {
        const semanticName = this.getSemanticEventName(event.name, component.framework);
        
        if (!eventMap.has(semanticName)) {
          eventMap.set(semanticName, []);
        }
        
        eventMap.get(semanticName)!.push({
          ...event,
          component: component as any,
        });
      }
    }
    
    const unifiedEvents: UnifiedEvent[] = [];
    
    for (const [semanticName, events] of eventMap) {
      const unified: UnifiedEvent = {
        name: semanticName,
        type: this.unifyEventTypes(events),
        payload: this.unifyEventPayloads(events),
        description: this.mergeEventDescriptions(events),
        frameworkMappings: {},
      };
      
      for (const event of events) {
        const framework = (event as any).component.framework;
        unified.frameworkMappings[framework] = {
          name: event.name,
          type: event.type,
          transform: this.generateEventTransform(event, semanticName),
        };
      }
      
      unifiedEvents.push(unified);
    }
    
    return unifiedEvents;
  }

  private alignSlots(components: ComponentDefinition[]): UnifiedSlot[] {
    const slotMap = new Map<string, SlotDefinition[]>();
    
    for (const component of components) {
      for (const slot of component.slots) {
        const semanticName = this.getSemanticSlotName(slot.name);
        
        if (!slotMap.has(semanticName)) {
          slotMap.set(semanticName, []);
        }
        
        slotMap.get(semanticName)!.push({
          ...slot,
          component: component as any,
        });
      }
    }
    
    const unifiedSlots: UnifiedSlot[] = [];
    
    for (const [semanticName, slots] of slotMap) {
      const unified: UnifiedSlot = {
        name: semanticName,
        type: this.unifySlotTypes(slots),
        description: this.mergeSlotDescriptions(slots),
        frameworkMappings: {},
      };
      
      for (const slot of slots) {
        const framework = (slot as any).component.framework;
        unified.frameworkMappings[framework] = {
          name: slot.name,
          type: slot.type,
        };
      }
      
      unifiedSlots.push(unified);
    }
    
    return unifiedSlots;
  }

  private getSemanticPropName(propName: string): string {
    // 标准化属性名称
    const mappings: Record<string, string> = {
      'className': 'class',
      'htmlFor': 'for',
      'onClick': 'click',
      'onChange': 'change',
      'onInput': 'input',
    };
    
    return mappings[propName] || propName;
  }

  private getSemanticEventName(eventName: string, framework: Framework): string {
    // 移除框架特定的事件前缀
    let semantic = eventName;
    
    switch (framework) {
      case 'react':
        semantic = eventName.replace(/^on([A-Z])/, (_, letter) => letter.toLowerCase());
        break;
      case 'vue':
        semantic = eventName.replace(/^@/, '');
        break;
      case 'intact':
        semantic = eventName.replace(/^ev-/, '');
        break;
    }
    
    return semantic;
  }

  private getSemanticSlotName(slotName: string): string {
    // 标准化插槽名称
    const mappings: Record<string, string> = {
      'children': 'default',
      'content': 'default',
    };
    
    return mappings[slotName] || slotName;
  }

  private unifyPropTypes(props: PropDefinition[]): string {
    // 统一属性类型
    const types = props.map(p => p.type);
    const uniqueTypes = [...new Set(types)];
    
    if (uniqueTypes.length === 1) {
      return uniqueTypes[0];
    }
    
    // 尝试找到最通用的类型
    if (uniqueTypes.includes('string')) return 'string';
    if (uniqueTypes.includes('number')) return 'number';
    if (uniqueTypes.includes('boolean')) return 'boolean';
    
    return 'any';
  }

  private determinePropRequired(props: PropDefinition[]): boolean {
    // 如果任何框架中该属性是必需的，则认为是必需的
    return props.some(p => p.required);
  }

  private mergePropDescriptions(props: PropDefinition[]): string | undefined {
    const descriptions = props.map(p => p.docs).filter(Boolean);
    return descriptions.length > 0 ? descriptions[0] : undefined;
  }

  private unifyEventTypes(events: EventDefinition[]): string {
    const types = events.map(e => e.type);
    const uniqueTypes = [...new Set(types)];
    return uniqueTypes.length === 1 ? uniqueTypes[0] : 'CustomEvent';
  }

  private unifyEventPayloads(events: EventDefinition[]): string | undefined {
    const payloads = events.map(e => e.payload).filter(Boolean);
    return payloads.length > 0 ? payloads[0] : undefined;
  }

  private mergeEventDescriptions(events: EventDefinition[]): string | undefined {
    const descriptions = events.map(e => e.docs).filter(Boolean);
    return descriptions.length > 0 ? descriptions[0] : undefined;
  }

  private unifySlotTypes(slots: SlotDefinition[]): string | undefined {
    const types = slots.map(s => s.type).filter(Boolean);
    return types.length > 0 ? types[0] : undefined;
  }

  private mergeSlotDescriptions(slots: SlotDefinition[]): string | undefined {
    const descriptions = slots.map(s => s.docs).filter(Boolean);
    return descriptions.length > 0 ? descriptions[0] : undefined;
  }

  private calculateAlignmentConfidence(
    components: ComponentDefinition[],
    props: UnifiedProp[],
    events: UnifiedEvent[]
  ): number {
    let totalScore = 0;
    let maxScore = 0;
    
    // 基于框架覆盖率的得分
    const frameworkCount = components.length;
    const maxFrameworks = 3; // React, Vue, Intact
    totalScore += (frameworkCount / maxFrameworks) * 0.4;
    maxScore += 0.4;
    
    // 基于属性对齐质量的得分
    if (props.length > 0) {
      const propAlignmentScore = props.reduce((sum, prop) => {
        const mappingCount = Object.keys(prop.frameworkMappings).length;
        return sum + (mappingCount / frameworkCount);
      }, 0) / props.length;
      
      totalScore += propAlignmentScore * 0.4;
      maxScore += 0.4;
    }
    
    // 基于事件对齐质量的得分
    if (events.length > 0) {
      const eventAlignmentScore = events.reduce((sum, event) => {
        const mappingCount = Object.keys(event.frameworkMappings).length;
        return sum + (mappingCount / frameworkCount);
      }, 0) / events.length;
      
      totalScore += eventAlignmentScore * 0.2;
      maxScore += 0.2;
    }
    
    return maxScore > 0 ? totalScore / maxScore : 0;
  }

  private inferCategory(components: ComponentDefinition[]): string {
    // 从组件名称推断类别
    const name = components[0].name.toLowerCase();
    
    if (name.includes('button')) return 'form';
    if (name.includes('input') || name.includes('select') || name.includes('textarea')) return 'form';
    if (name.includes('table') || name.includes('list')) return 'data-display';
    if (name.includes('modal') || name.includes('dialog')) return 'feedback';
    if (name.includes('menu') || name.includes('nav')) return 'navigation';
    
    return 'general';
  }

  private mergeDescriptions(components: ComponentDefinition[]): string {
    const descriptions = components.map(c => c.docs).filter(Boolean);
    return descriptions.length > 0 ? descriptions[0]! : `${components[0].name} component`;
  }

  private groupPropsBySemantics(components: ComponentDefinition[]): Map<string, any[]> {
    // 实现属性语义分组逻辑
    return new Map();
  }

  private groupEventsBySemantics(components: ComponentDefinition[]): Map<string, any[]> {
    // 实现事件语义分组逻辑
    return new Map();
  }

  private getFrameworkFromComponent(component: any): Framework {
    return component.framework;
  }

  private calculatePropMappingConfidence(props: any[]): number {
    return 0.9; // 简化实现
  }

  private calculateEventMappingConfidence(events: any[]): number {
    return 0.9; // 简化实现
  }

  private generatePropTransform(prop: PropDefinition, semanticName: string): string | undefined {
    // 生成属性转换逻辑
    if (prop.name !== semanticName) {
      return `rename: ${prop.name} -> ${semanticName}`;
    }
    return undefined;
  }

  private generateEventTransform(event: EventDefinition, semanticName: string): string | undefined {
    // 生成事件转换逻辑
    if (event.name !== semanticName) {
      return `rename: ${event.name} -> ${semanticName}`;
    }
    return undefined;
  }
}