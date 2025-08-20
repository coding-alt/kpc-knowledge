import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
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

const logger = createLogger('IntactParser');

export class IntactParser implements ASTParser {
  
  async parseIntact(filePath: string, content: string): Promise<ComponentDefinition> {
    logger.info(`Parsing Intact file: ${filePath}`);
    
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
        ],
      });
      
      const component: ComponentDefinition = {
        name: this.extractComponentName(ast, filePath),
        framework: 'intact',
        props: await this.extractProps(ast),
        events: await this.extractEvents(ast),
        slots: await this.extractSlots(ast),
        styleTokens: await this.extractStyleTokens(ast),
        sourceRefs: [this.createSourceRef(filePath, 1, content.split('\n').length)],
        docs: this.extractComponentDocs(ast),
      };
      
      logger.info(`Parsed Intact component: ${component.name} with ${component.props.length} props`);
      return component;
      
    } catch (error) {
      logger.error(`Failed to parse Intact file ${filePath}: ${error}`);
      throw error;
    }
  }

  async parseTypeScript(filePath: string, content: string): Promise<ComponentDefinition> {
    throw new Error('TypeScript parsing not implemented in Intact parser');
  }

  async parseVue(filePath: string, content: string): Promise<ComponentDefinition> {
    throw new Error('Vue parsing not implemented in Intact parser');
  }

  validateParsedComponent(component: ComponentDefinition): any {
    return { success: true, errors: [], warnings: [] };
  }

  private extractComponentName(ast: any, filePath: string): string {
    let componentName = '';
    
    traverse(ast, {
      // 查找类声明
      ClassDeclaration(path) {
        if (path.node.id && this.isComponentClass(path.node)) {
          componentName = path.node.id.name;
        }
      },
      
      // 查找默认导出
      ExportDefaultDeclaration(path) {
        if (t.isClassDeclaration(path.node.declaration) && path.node.declaration.id) {
          componentName = path.node.declaration.id.name;
        } else if (t.isIdentifier(path.node.declaration)) {
          componentName = path.node.declaration.name;
        }
      },
    });
    
    if (!componentName) {
      // 从文件名推断
      const fileName = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'UnknownComponent';
      componentName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
    }
    
    return componentName;
  }

  private isComponentClass(node: t.ClassDeclaration): boolean {
    // 检查是否继承自Intact组件基类
    if (node.superClass) {
      if (t.isIdentifier(node.superClass)) {
        return ['Component', 'IntactComponent'].includes(node.superClass.name);
      }
      if (t.isMemberExpression(node.superClass)) {
        return node.superClass.property && 
               t.isIdentifier(node.superClass.property) && 
               node.superClass.property.name === 'Component';
      }
    }
    return false;
  }

  private async extractProps(ast: any): Promise<PropDefinition[]> {
    const props: PropDefinition[] = [];
    
    traverse(ast, {
      ClassDeclaration(path) {
        if (this.isComponentClass(path.node)) {
          // 查找静态defaults属性
          const defaultsProperty = this.findStaticProperty(path.node, 'defaults');
          if (defaultsProperty && t.isObjectExpression(defaultsProperty.value)) {
            props.push(...this.extractPropsFromDefaults(defaultsProperty.value));
          }
          
          // 查找propTypes属性
          const propTypesProperty = this.findStaticProperty(path.node, 'propTypes');
          if (propTypesProperty && t.isObjectExpression(propTypesProperty.value)) {
            props.push(...this.extractPropsFromPropTypes(propTypesProperty.value));
          }
        }
      },
    });
    
    return props;
  }

  private findStaticProperty(classNode: t.ClassDeclaration, propertyName: string): t.ClassProperty | null {
    for (const member of classNode.body.body) {
      if (t.isClassProperty(member) && 
          member.static && 
          t.isIdentifier(member.key) && 
          member.key.name === propertyName) {
        return member;
      }
    }
    return null;
  }

  private extractPropsFromDefaults(objectExpression: t.ObjectExpression): PropDefinition[] {
    const props: PropDefinition[] = [];
    
    for (const property of objectExpression.properties) {
      if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
        const name = property.key.name;
        let defaultValue: any = undefined;
        let type = 'any';
        
        // 提取默认值
        if (t.isLiteral(property.value)) {
          defaultValue = (property.value as any).value;
          type = typeof defaultValue;
        } else if (t.isArrayExpression(property.value)) {
          defaultValue = '[]';
          type = 'array';
        } else if (t.isObjectExpression(property.value)) {
          defaultValue = '{}';
          type = 'object';
        }
        
        props.push({
          name,
          type,
          required: false,
          default: defaultValue,
          sourceRef: this.createSourceRef('', 
            property.loc?.start.line || 1, 
            property.loc?.end.line || 1),
        });
      }
    }
    
    return props;
  }

  private extractPropsFromPropTypes(objectExpression: t.ObjectExpression): PropDefinition[] {
    const props: PropDefinition[] = [];
    
    for (const property of objectExpression.properties) {
      if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
        const name = property.key.name;
        let type = 'any';
        let required = false;
        
        // 分析propType定义
        if (t.isMemberExpression(property.value)) {
          const propType = this.analyzePropType(property.value);
          type = propType.type;
          required = propType.required;
        }
        
        props.push({
          name,
          type,
          required,
          sourceRef: this.createSourceRef('', 
            property.loc?.start.line || 1, 
            property.loc?.end.line || 1),
        });
      }
    }
    
    return props;
  }

  private analyzePropType(memberExpression: t.MemberExpression): { type: string; required: boolean } {
    let type = 'any';
    let required = false;
    
    // 分析PropTypes.string, PropTypes.number等
    if (t.isIdentifier(memberExpression.property)) {
      const propTypeName = memberExpression.property.name;
      
      switch (propTypeName) {
        case 'string':
          type = 'string';
          break;
        case 'number':
          type = 'number';
          break;
        case 'bool':
        case 'boolean':
          type = 'boolean';
          break;
        case 'array':
          type = 'array';
          break;
        case 'object':
          type = 'object';
          break;
        case 'func':
        case 'function':
          type = 'function';
          break;
        case 'isRequired':
          required = true;
          // 需要进一步分析父级类型
          if (t.isMemberExpression(memberExpression.object)) {
            const parentType = this.analyzePropType(memberExpression.object);
            type = parentType.type;
          }
          break;
      }
    }
    
    return { type, required };
  }

  private async extractEvents(ast: any): Promise<EventDefinition[]> {
    const events: EventDefinition[] = [];
    
    traverse(ast, {
      ClassDeclaration(path) {
        if (this.isComponentClass(path.node)) {
          // 查找方法中的事件触发
          for (const member of path.node.body.body) {
            if (t.isClassMethod(member)) {
              this.findEventTriggers(member, events);
            }
          }
        }
      },
    });
    
    return events;
  }

  private findEventTriggers(method: t.ClassMethod, events: EventDefinition[]): void {
    traverse(method, {
      CallExpression(path) {
        // 查找 this.trigger('eventName') 调用
        if (t.isMemberExpression(path.node.callee) &&
            t.isThisExpression(path.node.callee.object) &&
            t.isIdentifier(path.node.callee.property) &&
            path.node.callee.property.name === 'trigger') {
          
          const args = path.node.arguments;
          if (args.length > 0 && t.isStringLiteral(args[0])) {
            const eventName = args[0].value;
            
            // 检查是否已经存在
            if (!events.find(e => e.name === eventName)) {
              events.push({
                name: eventName,
                type: 'CustomEvent',
                sourceRef: this.createSourceRef('', 
                  path.node.loc?.start.line || 1, 
                  path.node.loc?.end.line || 1),
              });
            }
          }
        }
      },
    }, path.scope);
  }

  private async extractSlots(ast: any): Promise<SlotDefinition[]> {
    const slots: SlotDefinition[] = [];
    
    traverse(ast, {
      ClassDeclaration(path) {
        if (this.isComponentClass(path.node)) {
          // 查找render方法或template
          const renderMethod = this.findMethod(path.node, 'render');
          if (renderMethod) {
            this.findSlotUsage(renderMethod, slots);
          }
        }
      },
    });
    
    return slots;
  }

  private findMethod(classNode: t.ClassDeclaration, methodName: string): t.ClassMethod | null {
    for (const member of classNode.body.body) {
      if (t.isClassMethod(member) && 
          t.isIdentifier(member.key) && 
          member.key.name === methodName) {
        return member;
      }
    }
    return null;
  }

  private findSlotUsage(method: t.ClassMethod, slots: SlotDefinition[]): void {
    traverse(method, {
      JSXElement(path) {
        // 查找 <b:slot> 或类似的slot元素
        if (t.isJSXIdentifier(path.node.openingElement.name)) {
          const tagName = path.node.openingElement.name.name;
          
          if (tagName.includes('slot') || tagName.startsWith('b:')) {
            const nameAttr = path.node.openingElement.attributes.find(attr =>
              t.isJSXAttribute(attr) && 
              t.isJSXIdentifier(attr.name) && 
              attr.name.name === 'name'
            );
            
            let slotName = 'default';
            if (nameAttr && t.isJSXAttribute(nameAttr) && t.isStringLiteral(nameAttr.value)) {
              slotName = nameAttr.value.value;
            }
            
            if (!slots.find(s => s.name === slotName)) {
              slots.push({
                name: slotName,
                type: 'slot',
                sourceRef: this.createSourceRef('', 
                  path.node.loc?.start.line || 1, 
                  path.node.loc?.end.line || 1),
              });
            }
          }
        }
      },
    }, path.scope);
  }

  private async extractStyleTokens(ast: any): Promise<StyleToken[]> {
    const tokens: StyleToken[] = [];
    
    traverse(ast, {
      VariableDeclarator(path) {
        // 查找样式相关的变量声明
        if (t.isIdentifier(path.node.id) && 
            path.node.id.name.toLowerCase().includes('style')) {
          
          const name = path.node.id.name;
          let value = '';
          
          if (t.isStringLiteral(path.node.init)) {
            value = path.node.init.value;
          } else if (path.node.init) {
            value = path.node.init.toString();
          }
          
          tokens.push({
            name,
            value,
            category: 'component-style',
            sourceRef: this.createSourceRef('', 
              path.node.loc?.start.line || 1, 
              path.node.loc?.end.line || 1),
          });
        }
      },
    });
    
    return tokens;
  }

  private extractComponentDocs(ast: any): string | undefined {
    let docs: string | undefined;
    
    traverse(ast, {
      ClassDeclaration(path) {
        if (this.isComponentClass(path.node)) {
          // 查找类上方的注释
          const leadingComments = path.node.leadingComments;
          if (leadingComments && leadingComments.length > 0) {
            const comment = leadingComments[leadingComments.length - 1];
            if (comment.type === 'CommentBlock') {
              docs = comment.value.replace(/^\*\s?/gm, '').trim();
            }
          }
        }
      },
    });
    
    return docs;
  }

  private createSourceRef(filePath: string, startLine: number, endLine: number): SourceReference {
    return {
      filePath,
      startLine,
      endLine,
    };
  }
}