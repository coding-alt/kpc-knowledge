import { ValidationResult, TestResult, RenderResult, ComparisonResult, FixResult } from '@kpc/shared';

export interface StaticValidator {
  /**
   * 验证TypeScript代码
   */
  validateTypeScript(code: string, options?: TypeScriptValidationOptions): Promise<ValidationResult>;
  
  /**
   * 验证ESLint规则
   */
  validateESLint(code: string, rules?: ESLintRule[]): Promise<ValidationResult>;
  
  /**
   * 自动修复代码问题
   */
  autoFix(code: string, errors: ValidationError[]): Promise<FixResult>;
  
  /**
   * 获取类型信息
   */
  getTypeInfo(code: string, position: CodePosition): Promise<TypeInfo>;
  
  /**
   * 验证组件API一致性
   */
  validateComponentAPI(code: string, manifest: any): Promise<ValidationResult>;
}

export interface RuntimeValidator {
  /**
   * 渲染组件并验证
   */
  renderComponent(code: string, framework: string, props?: any): Promise<RenderResult>;
  
  /**
   * 运行组件测试
   */
  runTests(testCode: string, componentCode: string): Promise<TestResult>;
  
  /**
   * 视觉回归测试
   */
  visualRegression(code: string, baseline?: string): Promise<ComparisonResult>;
  
  /**
   * 无障碍性检查
   */
  checkAccessibility(html: string): Promise<ValidationResult>;
  
  /**
   * 性能测试
   */
  performanceTest(code: string): Promise<PerformanceResult>;
}

export interface TypeScriptValidationOptions {
  strict?: boolean;
  target?: string;
  module?: string;
  lib?: string[];
  skipLibCheck?: boolean;
  declaration?: boolean;
}

export interface ESLintRule {
  name: string;
  severity: 'error' | 'warn' | 'off';
  options?: any;
}

export interface ValidationError {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
  rule?: string;
  fixable?: boolean;
}

export interface CodePosition {
  line: number;
  column: number;
}

export interface TypeInfo {
  type: string;
  documentation?: string;
  signature?: string;
  parameters?: ParameterInfo[];
  returnType?: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  documentation?: string;
}

export interface PerformanceResult {
  renderTime: number;
  memoryUsage: number;
  bundleSize: number;
  metrics: Record<string, number>;
}

export interface CodeFixProvider {
  /**
   * 获取可用的修复建议
   */
  getFixSuggestions(error: ValidationError, code: string): Promise<FixSuggestion[]>;
  
  /**
   * 应用修复建议
   */
  applyFix(code: string, fix: FixSuggestion): Promise<string>;
  
  /**
   * 批量应用修复
   */
  applyFixes(code: string, fixes: FixSuggestion[]): Promise<string>;
}

export interface FixSuggestion {
  id: string;
  title: string;
  description: string;
  changes: CodeChange[];
  confidence: number;
}

export interface CodeChange {
  type: 'insert' | 'delete' | 'replace';
  start: CodePosition;
  end?: CodePosition;
  text?: string;
}