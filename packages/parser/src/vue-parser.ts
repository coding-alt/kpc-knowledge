import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { 
  ComponentDefinition, 
  PropDefinition, 
  EventDefinition, 
  SlotDefinition,
  StyleToken,
  SourceReference,
  createLogger 
} from '@kpc/shared';
import { ASTParser } from './interfaces/parser';

const logger = createLogger('VueParser');

export class VueParser implements ASTParser {
  
  async parseVue(filePath: string, content: string): Promise<ComponentDefinition> {
    logger.info(`Parsing Vue file: ${filePath}`);
    
    try {
      const { descriptor } = parse(content, { filename: filePath });
      
      const component: ComponentDefinition = {
        name: this.extractComponentName(descriptor, filePath),
        framework: 'vue',
        props: await this.extractProps(descriptor),
        events: await this.extractEvents(descriptor),
        slots: await this.extractSlots(descriptor),
        styleTokens: await this.extractStyleTokens(descriptor),
        sourceRefs: [this.createSourceRef(filePath, 1, content.split('\n').length)],
        docs: this.extractComponentDocs(descriptor),
      };
      
      logger.info(`Parsed Vue component: ${component.name} with ${component.props.length} props`);
      return component;
      
    } catch (error) {
      logger.error(`Failed to parse Vue file ${filePath}: ${error}`);
      throw error;
    }
  }

  async parseTypeScript(filePath: string, content: string): Promise<ComponentDefinition> {
    throw new Error('TypeScript parsing not implemented in Vue parser');
  }

  async parseIntact(filePath: string, content: string): Promise<ComponentDefinition> {
    throw new Error('Intact parsing not implemented in Vue parser');
  }

  validateParsedComponent(component: ComponentDefinition): any {
    return { success: true, errors: [], warnings: [] };
  }

  private extractComponentName(descriptor: any, filePath: string): string {
    // 尝试从script中提取组件名
    if (descriptor.script || descriptor.scriptSetup) {
      const script = descriptor.script || descriptor.scriptSetup;
      const content = script.content;
      
      // 查找 export default { name: 'ComponentName' }
      const nameMatch = content.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
      if (nameMatch) {
        return nameMatch[1];
      }
      
      // 查找 defineComponent({ name: 'ComponentName' })
      const defineComponentMatch = content.match(/defineComponent\s*\(\s*{\s*name\s*:\s*['"`]([^'"`]+)['"`]/);
      if (defineComponentMatch) {
        return defineComponentMatch[1];
      }
    }
    
    // 从文件名推断
    const fileName = filePath.split('/').pop()?.replace(/\.vue$/, '') || 'UnknownComponent';
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  private async extractProps(descriptor: any): Promise<PropDefinition[]> {
    const props: PropDefinition[] = [];
    
    if (!descriptor.script && !descriptor.scriptSetup) {
      return props;
    }
    
    const script = descriptor.script || descriptor.scriptSetup;
    const content = script.content;
    
    // 处理 Composition API (script setup)
    if (descriptor.scriptSetup) {
      return this.extractPropsFromScriptSetup(content, script);
    }
    
    // 处理 Options API
    return this.extractPropsFromOptionsAPI(content, script);
  }

  private extractPropsFromScriptSetup(content: string, script: any): PropDefinition[] {
    const props: PropDefinition[] = [];
    
    // 查找 defineProps 调用
    const definePropsRegex = /defineProps\s*<([^>]+)>\s*\(\)/g;
    const definePropsWithObjectRegex = /defineProps\s*\(\s*({[\s\S]*?})\s*\)/g;
    
    let match;
    
    // 处理 defineProps<Props>()
    while ((match = definePropsRegex.exec(content)) !== null) {
      const typeString = match[1];
      // 这里需要解析TypeScript类型定义
      // 简化实现，实际需要更复杂的类型解析
      props.push(...this.parseTypeScriptInterface(typeString, script));
    }
    
    // 处理 defineProps({ ... })
    while ((match = definePropsWithObjectRegex.exec(content)) !== null) {
      const propsObject = match[1];
      props.push(...this.parsePropsObject(propsObject, script));
    }
    
    return props;
  }

  private extractPropsFromOptionsAPI(content: string, script: any): PropDefinition[] {
    const props: PropDefinition[] = [];
    
    // 查找 props 选项
    const propsRegex = /props\s*:\s*({[\s\S]*?}),?\s*(?=\w+\s*:|$)/g;
    const propsArrayRegex = /props\s*:\s*\[([^\]]+)\]/g;
    
    let match;
    
    // 处理对象形式的props
    while ((match = propsRegex.exec(content)) !== null) {
      const propsObject = match[1];
      props.push(...this.parsePropsObject(propsObject, script));
    }
    
    // 处理数组形式的props
    while ((match = propsArrayRegex.exec(content)) !== null) {
      const propsArray = match[1];
      const propNames = propsArray.split(',').map(name => name.trim().replace(/['"]/g, ''));
      
      for (const name of propNames) {
        if (name) {
          props.push({
            name,
            type: 'any',
            required: false,
            sourceRef: this.createSourceRef(script.loc?.source || '', 
              script.loc?.start.line || 1, 
              script.loc?.end.line || 1),
          });
        }
      }
    }
    
    return props;
  }

  private parsePropsObject(propsObject: string, script: any): PropDefinition[] {
    const props: PropDefinition[] = [];
    
    // 简化的props对象解析
    // 实际实现需要更复杂的AST解析
    const propRegex = /(\w+)\s*:\s*({[^}]*}|[^,}]+)/g;
    let match;
    
    while ((match = propRegex.exec(propsObject)) !== null) {
      const name = match[1];
      const definition = match[2].trim();
      
      let type = 'any';
      let required = false;
      let defaultValue: any = undefined;
      
      if (definition.startsWith('{')) {
        // 对象形式的prop定义
        const typeMatch = definition.match(/type\s*:\s*(\w+)/);
        if (typeMatch) {
          type = typeMatch[1];
        }
        
        const requiredMatch = definition.match(/required\s*:\s*(true|false)/);
        if (requiredMatch) {
          required = requiredMatch[1] === 'true';
        }
        
        const defaultMatch = definition.match(/default\s*:\s*([^,}]+)/);
        if (defaultMatch) {
          defaultValue = defaultMatch[1].trim();
        }
      } else {
        // 简单形式的prop定义
        type = definition;
      }
      
      props.push({
        name,
        type,
        required,
        default: defaultValue,
        sourceRef: this.createSourceRef(script.loc?.source || '', 
          script.loc?.start.line || 1, 
          script.loc?.end.line || 1),
      });
    }
    
    return props;
  }

  private parseTypeScriptInterface(typeString: string, script: any): PropDefinition[] {
    const props: PropDefinition[] = [];
    
    // 简化的TypeScript接口解析
    const propRegex = /(\w+)(\?)?:\s*([^;,}]+)/g;
    let match;
    
    while ((match = propRegex.exec(typeString)) !== null) {
      const name = match[1];
      const optional = match[2] === '?';
      const type = match[3].trim();
      
      props.push({
        name,
        type,
        required: !optional,
        sourceRef: this.createSourceRef(script.loc?.source || '', 
          script.loc?.start.line || 1, 
          script.loc?.end.line || 1),
      });
    }
    
    return props;
  }

  private async extractEvents(descriptor: any): Promise<EventDefinition[]> {
    const events: EventDefinition[] = [];
    
    if (!descriptor.script && !descriptor.scriptSetup) {
      return events;
    }
    
    const script = descriptor.script || descriptor.scriptSetup;
    const content = script.content;
    
    // 查找 defineEmits 调用 (Composition API)
    const defineEmitsRegex = /defineEmits\s*<([^>]+)>\s*\(\)/g;
    const defineEmitsArrayRegex = /defineEmits\s*\(\s*\[([^\]]+)\]\s*\)/g;
    
    let match;
    
    // 处理 defineEmits<Events>()
    while ((match = defineEmitsRegex.exec(content)) !== null) {
      const typeString = match[1];
      events.push(...this.parseEmitsInterface(typeString, script));
    }
    
    // 处理 defineEmits(['event1', 'event2'])
    while ((match = defineEmitsArrayRegex.exec(content)) !== null) {
      const eventsArray = match[1];
      const eventNames = eventsArray.split(',').map(name => name.trim().replace(/['"]/g, ''));
      
      for (const name of eventNames) {
        if (name) {
          events.push({
            name,
            type: 'CustomEvent',
            sourceRef: this.createSourceRef(script.loc?.source || '', 
              script.loc?.start.line || 1, 
              script.loc?.end.line || 1),
          });
        }
      }
    }
    
    // 查找 Options API 中的 emits
    const emitsRegex = /emits\s*:\s*\[([^\]]+)\]/g;
    while ((match = emitsRegex.exec(content)) !== null) {
      const eventsArray = match[1];
      const eventNames = eventsArray.split(',').map(name => name.trim().replace(/['"]/g, ''));
      
      for (const name of eventNames) {
        if (name) {
          events.push({
            name,
            type: 'CustomEvent',
            sourceRef: this.createSourceRef(script.loc?.source || '', 
              script.loc?.start.line || 1, 
              script.loc?.end.line || 1),
          });
        }
      }
    }
    
    return events;
  }

  private parseEmitsInterface(typeString: string, script: any): EventDefinition[] {
    const events: EventDefinition[] = [];
    
    // 解析事件接口定义
    const eventRegex = /(\w+):\s*\[([^\]]*)\]/g;
    let match;
    
    while ((match = eventRegex.exec(typeString)) !== null) {
      const name = match[1];
      const payload = match[2].trim();
      
      events.push({
        name,
        type: 'CustomEvent',
        payload: payload || undefined,
        sourceRef: this.createSourceRef(script.loc?.source || '', 
          script.loc?.start.line || 1, 
          script.loc?.end.line || 1),
      });
    }
    
    return events;
  }

  private async extractSlots(descriptor: any): Promise<SlotDefinition[]> {
    const slots: SlotDefinition[] = [];
    
    if (!descriptor.template) {
      return slots;
    }
    
    const template = descriptor.template.content;
    
    // 查找 <slot> 标签
    const slotRegex = /<slot\s*([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/slot>)/g;
    let match;
    
    while ((match = slotRegex.exec(template)) !== null) {
      const attributes = match[1];
      const content = match[2];
      
      // 提取slot名称
      const nameMatch = attributes.match(/name\s*=\s*['"`]([^'"`]+)['"`]/);
      const name = nameMatch ? nameMatch[1] : 'default';
      
      slots.push({
        name,
        type: 'slot',
        docs: content?.trim() || undefined,
        sourceRef: this.createSourceRef(descriptor.template.loc?.source || '', 
          descriptor.template.loc?.start.line || 1, 
          descriptor.template.loc?.end.line || 1),
      });
    }
    
    return slots;
  }

  private async extractStyleTokens(descriptor: any): Promise<StyleToken[]> {
    const tokens: StyleToken[] = [];
    
    if (!descriptor.styles || descriptor.styles.length === 0) {
      return tokens;
    }
    
    for (const style of descriptor.styles) {
      const content = style.content;
      
      // 查找CSS变量
      const cssVarRegex = /--([^:]+):\s*([^;]+);/g;
      let match;
      
      while ((match = cssVarRegex.exec(content)) !== null) {
        const name = match[1].trim();
        const value = match[2].trim();
        
        tokens.push({
          name: `--${name}`,
          value,
          category: 'css-variable',
          sourceRef: this.createSourceRef(style.loc?.source || '', 
            style.loc?.start.line || 1, 
            style.loc?.end.line || 1),
        });
      }
    }
    
    return tokens;
  }

  private extractComponentDocs(descriptor: any): string | undefined {
    // 查找组件级别的注释
    if (descriptor.script || descriptor.scriptSetup) {
      const script = descriptor.script || descriptor.scriptSetup;
      const content = script.content;
      
      // 查找文件顶部的注释
      const commentMatch = content.match(/^\/\*\*([\s\S]*?)\*\//);
      if (commentMatch) {
        return commentMatch[1].replace(/^\s*\*\s?/gm, '').trim();
      }
    }
    
    return undefined;
  }

  private createSourceRef(filePath: string, startLine: number, endLine: number): SourceReference {
    return {
      filePath,
      startLine,
      endLine,
    };
  }
}