import { Project, SourceFile, Node, SyntaxKind, JSDocTag } from 'ts-morph';
import { 
  ComponentDefinition, 
  PropDefinition, 
  EventDefinition, 
  SlotDefinition,
  StyleToken,
  SourceReference,
  createLogger 
} from '@kpc/shared';
import { ASTParser, ParseContext } from './interfaces/parser';

const logger = createLogger('TypeScriptParser');

export class TypeScriptParser implements ASTParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // Latest
        module: 99, // ESNext
        jsx: 4, // React JSX
        allowJs: true,
        declaration: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    });
  }

  async parseTypeScript(filePath: string, content: string): Promise<ComponentDefinition> {
    logger.info(`Parsing TypeScript file: ${filePath}`);
    
    try {
      const sourceFile = this.project.createSourceFile(filePath, content, { overwrite: true });
      
      const component: ComponentDefinition = {
        name: this.extractComponentName(sourceFile, filePath),
        framework: 'react',
        props: await this.extractProps(sourceFile),
        events: await this.extractEvents(sourceFile),
        slots: await this.extractSlots(sourceFile),
        styleTokens: await this.extractStyleTokens(sourceFile),
        sourceRefs: [this.createSourceRef(filePath, 1, sourceFile.getEndLineNumber())],
        docs: this.extractComponentDocs(sourceFile),
      };
      
      logger.info(`Parsed component: ${component.name} with ${component.props.length} props`);
      return component;
      
    } catch (error) {
      logger.error(`Failed to parse TypeScript file ${filePath}: ${error}`);
      throw error;
    }
  }

  async parseVue(filePath: string, content: string): Promise<ComponentDefinition> {
    // Vue解析将在vue-parser.ts中实现
    throw new Error('Vue parsing not implemented in TypeScript parser');
  }

  async parseIntact(filePath: string, content: string): Promise<ComponentDefinition> {
    // Intact解析将在intact-parser.ts中实现
    throw new Error('Intact parsing not implemented in TypeScript parser');
  }

  validateParsedComponent(component: ComponentDefinition): any {
    // TODO: 实现组件验证逻辑
    return { success: true, errors: [], warnings: [] };
  }

  private extractComponentName(sourceFile: SourceFile, filePath: string): string {
    // 尝试从默认导出获取组件名
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      const name = defaultExport.getName();
      if (name !== 'default') {
        return name;
      }
    }
    
    // 尝试从函数声明获取
    const functionDeclarations = sourceFile.getFunctions();
    for (const func of functionDeclarations) {
      if (func.isExported()) {
        return func.getName() || 'UnknownComponent';
      }
    }
    
    // 尝试从类声明获取
    const classDeclarations = sourceFile.getClasses();
    for (const cls of classDeclarations) {
      if (cls.isExported()) {
        return cls.getName() || 'UnknownComponent';
      }
    }
    
    // 尝试从变量声明获取
    const variableStatements = sourceFile.getVariableStatements();
    for (const statement of variableStatements) {
      if (statement.isExported()) {
        const declarations = statement.getDeclarations();
        for (const decl of declarations) {
          const name = decl.getName();
          if (name) {
            return name;
          }
        }
      }
    }
    
    // 从文件名推断
    const fileName = filePath.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') || 'UnknownComponent';
    return fileName;
  }

  private async extractProps(sourceFile: SourceFile): Promise<PropDefinition[]> {
    const props: PropDefinition[] = [];
    
    // 查找Props接口定义
    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      const name = iface.getName();
      if (name.toLowerCase().includes('props') || name.toLowerCase().includes('properties')) {
        const properties = iface.getProperties();
        
        for (const prop of properties) {
          const propDef = this.extractPropFromProperty(prop, sourceFile);
          if (propDef) {
            props.push(propDef);
          }
        }
      }
    }
    
    // 查找类型别名
    const typeAliases = sourceFile.getTypeAliases();
    for (const alias of typeAliases) {
      const name = alias.getName();
      if (name.toLowerCase().includes('props')) {
        const typeNode = alias.getTypeNode();
        if (Node.isTypeLiteralNode(typeNode)) {
          const members = typeNode.getMembers();
          for (const member of members) {
            if (Node.isPropertySignature(member)) {
              const propDef = this.extractPropFromProperty(member, sourceFile);
              if (propDef) {
                props.push(propDef);
              }
            }
          }
        }
      }
    }
    
    return props;
  }

  private extractPropFromProperty(prop: any, sourceFile: SourceFile): PropDefinition | null {
    try {
      const name = prop.getName();
      if (!name) return null;
      
      const typeText = prop.getType().getText();
      const isOptional = prop.hasQuestionToken();
      
      // 提取JSDoc注释
      const jsDocs = prop.getJsDocs();
      let docs = '';
      let deprecated = false;
      
      for (const jsDoc of jsDocs) {
        docs += jsDoc.getDescription();
        const tags = jsDoc.getTags();
        for (const tag of tags) {
          if (tag.getTagName() === 'deprecated') {
            deprecated = true;
          }
        }
      }
      
      // 提取默认值
      let defaultValue: any = undefined;
      const initializer = prop.getInitializer?.();
      if (initializer) {
        defaultValue = initializer.getText();
      }
      
      return {
        name,
        type: typeText,
        required: !isOptional,
        default: defaultValue,
        deprecated,
        docs: docs.trim() || undefined,
        sourceRef: this.createSourceRef(
          sourceFile.getFilePath(),
          prop.getStartLineNumber(),
          prop.getEndLineNumber()
        ),
      };
    } catch (error) {
      logger.warn(`Failed to extract prop: ${error}`);
      return null;
    }
  }

  private async extractEvents(sourceFile: SourceFile): Promise<EventDefinition[]> {
    const events: EventDefinition[] = [];
    
    // 查找事件处理器props (以on开头的props)
    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      const name = iface.getName();
      if (name.toLowerCase().includes('props')) {
        const properties = iface.getProperties();
        
        for (const prop of properties) {
          const propName = prop.getName();
          if (propName?.startsWith('on') && propName.length > 2) {
            const eventName = propName.slice(2).toLowerCase();
            const typeText = prop.getType().getText();
            
            // 提取事件payload类型
            let payload: string | undefined;
            const match = typeText.match(/\(([^)]*)\)\s*=>/);
            if (match) {
              payload = match[1];
            }
            
            events.push({
              name: eventName,
              type: typeText,
              payload,
              sourceRef: this.createSourceRef(
                sourceFile.getFilePath(),
                prop.getStartLineNumber(),
                prop.getEndLineNumber()
              ),
            });
          }
        }
      }
    }
    
    return events;
  }

  private async extractSlots(sourceFile: SourceFile): Promise<SlotDefinition[]> {
    const slots: SlotDefinition[] = [];
    
    // React中的slots通常是children或render props
    // 查找children prop
    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      const properties = iface.getProperties();
      
      for (const prop of properties) {
        const propName = prop.getName();
        if (propName === 'children' || propName?.includes('render')) {
          const typeText = prop.getType().getText();
          
          slots.push({
            name: propName,
            type: typeText,
            sourceRef: this.createSourceRef(
              sourceFile.getFilePath(),
              prop.getStartLineNumber(),
              prop.getEndLineNumber()
            ),
          });
        }
      }
    }
    
    return slots;
  }

  private async extractStyleTokens(sourceFile: SourceFile): Promise<StyleToken[]> {
    const tokens: StyleToken[] = [];
    
    // 查找CSS-in-JS或styled-components相关的样式定义
    // 这里是一个简化的实现，实际可能需要更复杂的解析
    
    const variableStatements = sourceFile.getVariableStatements();
    for (const statement of variableStatements) {
      const declarations = statement.getDeclarations();
      
      for (const decl of declarations) {
        const name = decl.getName();
        const initializer = decl.getInitializer();
        
        if (name && initializer && name.toLowerCase().includes('style')) {
          const value = initializer.getText();
          
          tokens.push({
            name,
            value,
            category: 'component-style',
            sourceRef: this.createSourceRef(
              sourceFile.getFilePath(),
              decl.getStartLineNumber(),
              decl.getEndLineNumber()
            ),
          });
        }
      }
    }
    
    return tokens;
  }

  private extractComponentDocs(sourceFile: SourceFile): string | undefined {
    // 查找组件级别的JSDoc注释
    const functions = sourceFile.getFunctions();
    const classes = sourceFile.getClasses();
    const variables = sourceFile.getVariableStatements();
    
    // 检查函数组件的JSDoc
    for (const func of functions) {
      if (func.isExported()) {
        const jsDocs = func.getJsDocs();
        if (jsDocs.length > 0) {
          return jsDocs[0].getDescription();
        }
      }
    }
    
    // 检查类组件的JSDoc
    for (const cls of classes) {
      if (cls.isExported()) {
        const jsDocs = cls.getJsDocs();
        if (jsDocs.length > 0) {
          return jsDocs[0].getDescription();
        }
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