import { 
  UAST, 
  RequirementParseResult, 
  CodeGenerationContext, 
  Framework, 
  ValidationResult 
} from '@kpc/shared';

export interface RequirementParser {
  /**
   * 解析自然语言需求为结构化结果
   */
  parseRequirement(requirement: string): Promise<RequirementParseResult>;
  
  /**
   * 从需求生成UAST
   */
  generateUAST(requirement: RequirementParseResult, manifest: any): Promise<UAST>;
  
  /**
   * 验证UAST的有效性
   */
  validateUAST(uast: UAST, manifest: any): ValidationResult;
  
  /**
   * 优化UAST结构
   */
  optimizeUAST(uast: UAST): Promise<UAST>;
}

export interface CodeGenerator {
  /**
   * 从UAST生成代码
   */
  generateCode(context: CodeGenerationContext): Promise<GeneratedCode>;
  
  /**
   * 生成组件代码
   */
  generateComponent(uast: UAST, framework: Framework, manifest: any): Promise<string>;
  
  /**
   * 生成样式代码
   */
  generateStyles(uast: UAST, framework: Framework): Promise<string>;
  
  /**
   * 生成测试代码
   */
  generateTests(uast: UAST, framework: Framework): Promise<string>;
  
  /**
   * 生成Storybook stories
   */
  generateStories(uast: UAST, framework: Framework): Promise<string>;
}

export interface TemplateEngine {
  /**
   * 注册模板
   */
  registerTemplate(name: string, template: string): void;
  
  /**
   * 渲染模板
   */
  render(templateName: string, data: any): Promise<string>;
  
  /**
   * 编译模板
   */
  compile(template: string): CompiledTemplate;
  
  /**
   * 获取可用模板列表
   */
  getAvailableTemplates(): string[];
}

export interface CompiledTemplate {
  (data: any): string;
}

export interface GeneratedCode {
  component: string;
  styles?: string;
  tests?: string;
  stories?: string;
  types?: string;
  metadata: CodeMetadata;
}

export interface CodeMetadata {
  framework: Framework;
  componentName: string;
  dependencies: string[];
  imports: ImportStatement[];
  exports: ExportStatement[];
  generatedAt: string;
  confidence: number;
}

export interface ImportStatement {
  module: string;
  named?: string[];
  default?: string;
  namespace?: string;
}

export interface ExportStatement {
  name: string;
  type: 'default' | 'named';
  value?: string;
}

export interface AIProvider {
  /**
   * 生成文本补全
   */
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  
  /**
   * 生成聊天回复
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  
  /**
   * 生成代码
   */
  generateCode(prompt: string, language: string): Promise<string>;
  
  /**
   * 解析结构化数据
   */
  parseStructured<T>(prompt: string, schema: any): Promise<T>;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
}

export interface ChatOptions extends CompletionOptions {
  systemMessage?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}