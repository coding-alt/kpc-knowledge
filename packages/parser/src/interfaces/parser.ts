import { ComponentDefinition, ValidationResult } from '@kpc/shared';

export interface ASTParser {
  /**
   * 解析TypeScript/React组件
   */
  parseTypeScript(filePath: string, content: string): Promise<ComponentDefinition>;
  
  /**
   * 解析Vue组件
   */
  parseVue(filePath: string, content: string): Promise<ComponentDefinition>;
  
  /**
   * 解析Intact组件
   */
  parseIntact(filePath: string, content: string): Promise<ComponentDefinition>;
  
  /**
   * 验证解析结果
   */
  validateParsedComponent(component: ComponentDefinition): ValidationResult;
}

export interface ParseContext {
  filePath: string;
  content: string;
  framework: 'react' | 'vue' | 'intact';
  options?: ParseOptions;
}

export interface ParseOptions {
  extractJSDoc?: boolean;
  extractTypes?: boolean;
  extractDefaultValues?: boolean;
  includePrivateMembers?: boolean;
}