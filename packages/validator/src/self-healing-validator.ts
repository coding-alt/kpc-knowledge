import { 
  CodeFixProvider,
  FixSuggestion,
  CodeChange,
  ValidationError,
  FixResult,
  ValidationResult,
  StaticValidator,
  RuntimeValidator,
  AIProvider,
  ComponentManifest,
  createLogger,
  createSuccessResult,
  createErrorResult 
} from '@kpc/shared';

const logger = createLogger('SelfHealingValidator');

export class SelfHealingValidator implements CodeFixProvider {
  constructor(
    private staticValidator: StaticValidator,
    private runtimeValidator: RuntimeValidator,
    private aiProvider: AIProvider,
    private manifest: ComponentManifest
  ) {}

  async getFixSuggestions(error: ValidationError, code: string): Promise<FixSuggestion[]> {
    logger.debug(`Generating fix suggestions for error: ${error.message}`);

    try {
      const suggestions: FixSuggestion[] = [];

      // 1. 基于规则的修复建议
      const ruleBased = await this.generateRuleBasedFixes(error, code);
      suggestions.push(...ruleBased);

      // 2. AI驱动的修复建议
      const aiGenerated = await this.generateAIFixes(error, code);
      suggestions.push(...aiGenerated);

      // 3. 基于清单的修复建议
      const manifestBased = await this.generateManifestBasedFixes(error, code);
      suggestions.push(...manifestBased);

      // 按置信度排序
      suggestions.sort((a, b) => b.confidence - a.confidence);

      logger.debug(`Generated ${suggestions.length} fix suggestions`);
      return suggestions;

    } catch (error) {
      logger.error(`Failed to generate fix suggestions: ${error}`);
      return [];
    }
  }

  async applyFix(code: string, fix: FixSuggestion): Promise<string> {
    logger.debug(`Applying fix: ${fix.title}`);

    try {
      let fixedCode = code;

      // 按顺序应用所有变更
      for (const change of fix.changes) {
        fixedCode = this.applyCodeChange(fixedCode, change);
      }

      // 验证修复后的代码
      const validation = await this.validateFixedCode(fixedCode);
      
      if (!validation.success) {
        logger.warn(`Fix validation failed: ${validation.errors?.[0]?.message}`);
      }

      return fixedCode;

    } catch (error) {
      logger.error(`Failed to apply fix: ${error}`);
      throw error;
    }
  }

  async applyFixes(code: string, fixes: FixSuggestion[]): Promise<string> {
    logger.debug(`Applying ${fixes.length} fixes`);

    let fixedCode = code;

    // 按置信度排序，优先应用高置信度的修复
    const sortedFixes = [...fixes].sort((a, b) => b.confidence - a.confidence);

    for (const fix of sortedFixes) {
      try {
        const tempFixed = await this.applyFix(fixedCode, fix);
        
        // 验证修复是否改善了代码
        const improvement = await this.assessImprovement(fixedCode, tempFixed);
        
        if (improvement.improved) {
          fixedCode = tempFixed;
          logger.debug(`Applied fix: ${fix.title}`);
        } else {
          logger.debug(`Skipped fix (no improvement): ${fix.title}`);
        }

      } catch (error) {
        logger.warn(`Failed to apply fix ${fix.title}: ${error}`);
        continue;
      }
    }

    return fixedCode;
  }

  /**
   * 自动修复代码中的所有问题
   */
  async autoHeal(code: string): Promise<HealingResult> {
    logger.info('Starting auto-healing process');

    const startTime = Date.now();
    const healingSteps: HealingStep[] = [];
    let currentCode = code;
    let iteration = 0;
    const maxIterations = 5;

    try {
      while (iteration < maxIterations) {
        iteration++;
        logger.debug(`Healing iteration ${iteration}`);

        // 1. 静态分析
        const staticValidation = await this.staticValidator.validateTypeScript(currentCode);
        const eslintValidation = await this.staticValidator.validateESLint(currentCode);

        // 2. 收集所有错误
        const allErrors = [
          ...(staticValidation.errors || []),
          ...(eslintValidation.errors || []),
        ];

        if (allErrors.length === 0) {
          logger.info(`Auto-healing completed successfully in ${iteration} iterations`);
          break;
        }

        // 3. 生成修复建议
        const allSuggestions: FixSuggestion[] = [];
        for (const error of allErrors) {
          const suggestions = await this.getFixSuggestions(error, currentCode);
          allSuggestions.push(...suggestions);
        }

        if (allSuggestions.length === 0) {
          logger.warn('No fix suggestions available');
          break;
        }

        // 4. 应用修复
        const previousCode = currentCode;
        currentCode = await this.applyFixes(currentCode, allSuggestions);

        // 5. 记录修复步骤
        const step: HealingStep = {
          iteration,
          errorsFound: allErrors.length,
          fixesApplied: allSuggestions.length,
          codeChanged: currentCode !== previousCode,
          errors: allErrors,
          appliedFixes: allSuggestions.filter(fix => 
            this.wasFixApplied(previousCode, currentCode, fix)
          ),
        };

        healingSteps.push(step);

        // 6. 如果代码没有改变，停止迭代
        if (currentCode === previousCode) {
          logger.info('No more changes possible, stopping healing process');
          break;
        }
      }

      // 最终验证
      const finalValidation = await this.performFinalValidation(currentCode);
      const duration = Date.now() - startTime;

      const result: HealingResult = {
        success: finalValidation.success,
        originalCode: code,
        healedCode: currentCode,
        iterations: iteration,
        totalErrors: healingSteps.reduce((sum, step) => sum + step.errorsFound, 0),
        totalFixes: healingSteps.reduce((sum, step) => sum + step.fixesApplied, 0),
        duration,
        steps: healingSteps,
        finalValidation,
        confidence: this.calculateHealingConfidence(healingSteps, finalValidation),
      };

      logger.info(`Auto-healing ${result.success ? 'completed' : 'partially completed'} in ${duration}ms`);
      return result;

    } catch (error) {
      logger.error(`Auto-healing failed: ${error}`);
      
      return {
        success: false,
        originalCode: code,
        healedCode: currentCode,
        iterations: iteration,
        totalErrors: 0,
        totalFixes: 0,
        duration: Date.now() - startTime,
        steps: healingSteps,
        error: error.toString(),
        confidence: 0,
      };
    }
  }

  /**
   * 智能错误分析和分类
   */
  async analyzeErrors(errors: ValidationError[]): Promise<ErrorAnalysis> {
    logger.debug(`Analyzing ${errors.length} errors`);

    const analysis: ErrorAnalysis = {
      totalErrors: errors.length,
      categories: {},
      severity: { error: 0, warning: 0, info: 0 },
      fixability: { fixable: 0, unfixable: 0 },
      patterns: [],
      recommendations: [],
    };

    // 分类错误
    for (const error of errors) {
      // 按严重程度分类
      analysis.severity[error.severity]++;

      // 按可修复性分类
      if (error.fixable) {
        analysis.fixability.fixable++;
      } else {
        analysis.fixability.unfixable++;
      }

      // 按规则分类
      const category = this.categorizeError(error);
      analysis.categories[category] = (analysis.categories[category] || 0) + 1;
    }

    // 检测错误模式
    analysis.patterns = this.detectErrorPatterns(errors);

    // 生成修复建议
    analysis.recommendations = await this.generateRecommendations(analysis);

    return analysis;
  }

  private async generateRuleBasedFixes(error: ValidationError, code: string): Promise<FixSuggestion[]> {
    const fixes: FixSuggestion[] = [];

    // TypeScript错误修复
    if (error.rule?.startsWith('TS')) {
      const tsFixes = this.generateTypeScriptFixes(error, code);
      fixes.push(...tsFixes);
    }

    // ESLint错误修复
    if (error.rule && !error.rule.startsWith('TS')) {
      const eslintFixes = this.generateESLintFixes(error, code);
      fixes.push(...eslintFixes);
    }

    return fixes;
  }

  private async generateAIFixes(error: ValidationError, code: string): Promise<FixSuggestion[]> {
    try {
      const prompt = this.buildFixPrompt(error, code);
      const aiResponse = await this.aiProvider.parseStructured<AIFixResponse>(
        prompt,
        this.getFixResponseSchema()
      );

      return aiResponse.suggestions.map(suggestion => ({
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: suggestion.title,
        description: suggestion.description,
        changes: suggestion.changes,
        confidence: suggestion.confidence,
      }));

    } catch (error) {
      logger.warn(`AI fix generation failed: ${error}`);
      return [];
    }
  }

  private async generateManifestBasedFixes(error: ValidationError, code: string): Promise<FixSuggestion[]> {
    const fixes: FixSuggestion[] = [];

    // 基于组件清单的修复
    if (error.message.includes('not allowed') || error.message.includes('not found')) {
      const componentFixes = this.generateComponentFixes(error, code);
      fixes.push(...componentFixes);
    }

    // 基于属性清单的修复
    if (error.message.includes('property') || error.message.includes('prop')) {
      const propFixes = this.generatePropertyFixes(error, code);
      fixes.push(...propFixes);
    }

    return fixes;
  }

  private generateTypeScriptFixes(error: ValidationError, code: string): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];
    const ruleCode = error.rule?.replace('TS', '');

    switch (ruleCode) {
      case '2304': // Cannot find name
        fixes.push(this.generateImportFix(error, code));
        break;
      
      case '2322': // Type is not assignable
        fixes.push(this.generateTypeFix(error, code));
        break;
      
      case '2339': // Property does not exist
        fixes.push(this.generatePropertyFix(error, code));
        break;
      
      case '2554': // Expected N arguments, but got M
        fixes.push(this.generateArgumentFix(error, code));
        break;
    }

    return fixes.filter(Boolean);
  }

  private generateESLintFixes(error: ValidationError, code: string): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    switch (error.rule) {
      case 'no-unused-vars':
      case '@typescript-eslint/no-unused-vars':
        fixes.push(this.generateUnusedVarFix(error, code));
        break;
      
      case 'react/jsx-uses-vars':
        fixes.push(this.generateJSXVarFix(error, code));
        break;
      
      case 'react-hooks/exhaustive-deps':
        fixes.push(this.generateHookDepsFix(error, code));
        break;
    }

    return fixes.filter(Boolean);
  }

  private generateComponentFixes(error: ValidationError, code: string): FixSuggestion[] {
    // 基于组件清单生成修复建议
    const allowedComponents = this.manifest.components.map(c => c.name);
    
    // 提取错误中的组件名
    const componentMatch = error.message.match(/Component '([^']+)'/);
    if (!componentMatch) return [];
    
    const invalidComponent = componentMatch[1];
    
    // 查找相似的有效组件
    const suggestions = this.findSimilarComponents(invalidComponent, allowedComponents);
    
    return suggestions.map(suggestion => ({
      id: `component-${Date.now()}`,
      title: `Replace with ${suggestion}`,
      description: `Replace invalid component '${invalidComponent}' with '${suggestion}'`,
      changes: [{
        type: 'replace' as const,
        start: { line: error.line || 1, column: error.column || 1 },
        text: suggestion,
      }],
      confidence: this.calculateSimilarity(invalidComponent, suggestion),
    }));
  }

  private generatePropertyFixes(error: ValidationError, code: string): FixSuggestion[] {
    // 基于属性清单生成修复建议
    return [];
  }

  private generateImportFix(error: ValidationError, code: string): FixSuggestion {
    const missingName = this.extractMissingName(error.message);
    
    return {
      id: `import-${Date.now()}`,
      title: `Add import for ${missingName}`,
      description: `Import ${missingName} from React`,
      changes: [{
        type: 'insert',
        start: { line: 1, column: 1 },
        text: `import { ${missingName} } from 'react';\n`,
      }],
      confidence: 0.8,
    };
  }

  private generateTypeFix(error: ValidationError, code: string): FixSuggestion {
    return {
      id: `type-${Date.now()}`,
      title: 'Fix type assignment',
      description: 'Add type assertion or fix type mismatch',
      changes: [],
      confidence: 0.6,
    };
  }

  private generatePropertyFix(error: ValidationError, code: string): FixSuggestion {
    return {
      id: `property-${Date.now()}`,
      title: 'Add missing property',
      description: 'Add the missing property to the interface',
      changes: [],
      confidence: 0.7,
    };
  }

  private generateArgumentFix(error: ValidationError, code: string): FixSuggestion {
    return {
      id: `argument-${Date.now()}`,
      title: 'Fix function arguments',
      description: 'Adjust the number of function arguments',
      changes: [],
      confidence: 0.7,
    };
  }

  private generateUnusedVarFix(error: ValidationError, code: string): FixSuggestion {
    const varName = this.extractVariableName(error.message);
    
    return {
      id: `unused-var-${Date.now()}`,
      title: `Remove unused variable ${varName}`,
      description: `Remove the unused variable '${varName}'`,
      changes: [{
        type: 'delete',
        start: { line: error.line || 1, column: 1 },
        end: { line: error.line || 1, column: 100 },
      }],
      confidence: 0.9,
    };
  }

  private generateJSXVarFix(error: ValidationError, code: string): FixSuggestion {
    return {
      id: `jsx-var-${Date.now()}`,
      title: 'Fix JSX variable usage',
      description: 'Ensure JSX variables are properly used',
      changes: [],
      confidence: 0.8,
    };
  }

  private generateHookDepsFix(error: ValidationError, code: string): FixSuggestion {
    return {
      id: `hook-deps-${Date.now()}`,
      title: 'Fix hook dependencies',
      description: 'Add missing dependencies to useEffect',
      changes: [],
      confidence: 0.8,
    };
  }

  private applyCodeChange(code: string, change: CodeChange): string {
    const lines = code.split('\n');
    
    switch (change.type) {
      case 'insert':
        lines.splice(change.start.line - 1, 0, change.text || '');
        break;
      
      case 'delete':
        if (change.end) {
          lines.splice(change.start.line - 1, change.end.line - change.start.line + 1);
        } else {
          lines.splice(change.start.line - 1, 1);
        }
        break;
      
      case 'replace':
        const line = lines[change.start.line - 1];
        if (change.end) {
          // 多行替换
          const newLines = (change.text || '').split('\n');
          lines.splice(change.start.line - 1, change.end.line - change.start.line + 1, ...newLines);
        } else {
          // 单行替换
          const before = line.substring(0, change.start.column - 1);
          const after = line.substring(change.start.column - 1);
          lines[change.start.line - 1] = before + (change.text || '') + after;
        }
        break;
    }
    
    return lines.join('\n');
  }

  private async validateFixedCode(code: string): Promise<ValidationResult> {
    try {
      const staticResult = await this.staticValidator.validateTypeScript(code);
      const eslintResult = await this.staticValidator.validateESLint(code);
      
      const allErrors = [
        ...(staticResult.errors || []),
        ...(eslintResult.errors || []),
      ];
      
      if (allErrors.length > 0) {
        return createErrorResult(
          `Fixed code still has ${allErrors.length} errors`,
          'error',
          { errors: allErrors }
        );
      }
      
      return createSuccessResult();
      
    } catch (error) {
      return createErrorResult(`Validation failed: ${error}`, 'error');
    }
  }

  private async assessImprovement(originalCode: string, fixedCode: string): Promise<ImprovementAssessment> {
    try {
      const originalValidation = await this.validateFixedCode(originalCode);
      const fixedValidation = await this.validateFixedCode(fixedCode);
      
      const originalErrors = originalValidation.errors?.length || 0;
      const fixedErrors = fixedValidation.errors?.length || 0;
      
      return {
        improved: fixedErrors < originalErrors,
        errorReduction: originalErrors - fixedErrors,
        originalErrors,
        fixedErrors,
      };
      
    } catch (error) {
      return {
        improved: false,
        errorReduction: 0,
        originalErrors: 0,
        fixedErrors: 0,
      };
    }
  }

  private async performFinalValidation(code: string): Promise<ValidationResult> {
    // 执行全面的最终验证
    const validations = await Promise.all([
      this.staticValidator.validateTypeScript(code),
      this.staticValidator.validateESLint(code),
      this.staticValidator.validateComponentAPI(code, this.manifest),
    ]);
    
    const allErrors = validations.flatMap(v => v.errors || []);
    const allWarnings = validations.flatMap(v => v.warnings || []);
    
    if (allErrors.length > 0) {
      return createErrorResult(
        `Final validation failed with ${allErrors.length} errors`,
        'error',
        { errors: allErrors, warnings: allWarnings }
      );
    }
    
    return createSuccessResult({ warnings: allWarnings });
  }

  private calculateHealingConfidence(steps: HealingStep[], finalValidation: ValidationResult): number {
    if (!finalValidation.success) {
      return 0.3; // 低置信度，因为仍有错误
    }
    
    const totalErrors = steps.reduce((sum, step) => sum + step.errorsFound, 0);
    const totalFixes = steps.reduce((sum, step) => sum + step.fixesApplied, 0);
    
    if (totalErrors === 0) {
      return 1.0; // 没有错误，完美
    }
    
    const fixRate = totalFixes / totalErrors;
    const iterationPenalty = Math.max(0, (steps.length - 1) * 0.1); // 迭代次数越多，置信度越低
    
    return Math.max(0.5, Math.min(1.0, fixRate - iterationPenalty));
  }

  private wasFixApplied(originalCode: string, fixedCode: string, fix: FixSuggestion): boolean {
    // 简单检查：如果代码发生了变化，认为修复被应用了
    return originalCode !== fixedCode;
  }

  private categorizeError(error: ValidationError): string {
    if (error.rule?.startsWith('TS')) {
      return 'typescript';
    }
    
    if (error.rule?.includes('react')) {
      return 'react';
    }
    
    if (error.rule?.includes('hook')) {
      return 'hooks';
    }
    
    return 'general';
  }

  private detectErrorPatterns(errors: ValidationError[]): string[] {
    const patterns: string[] = [];
    
    // 检测常见模式
    const ruleGroups = errors.reduce((groups, error) => {
      const rule = error.rule || 'unknown';
      groups[rule] = (groups[rule] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
    
    for (const [rule, count] of Object.entries(ruleGroups)) {
      if (count > 3) {
        patterns.push(`Repeated ${rule} errors (${count} occurrences)`);
      }
    }
    
    return patterns;
  }

  private async generateRecommendations(analysis: ErrorAnalysis): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (analysis.severity.error > 5) {
      recommendations.push('Consider reviewing the component structure - many errors detected');
    }
    
    if (analysis.categories.typescript > analysis.categories.react) {
      recommendations.push('Focus on TypeScript type definitions');
    }
    
    if (analysis.fixability.fixable > analysis.fixability.unfixable) {
      recommendations.push('Most errors are auto-fixable - run auto-healing');
    }
    
    return recommendations;
  }

  private buildFixPrompt(error: ValidationError, code: string): string {
    return `
Fix the following error in the React/TypeScript code:

Error: ${error.message}
Rule: ${error.rule}
Line: ${error.line}
Severity: ${error.severity}

Code context:
\`\`\`typescript
${code}
\`\`\`

Please provide fix suggestions in the following JSON format:
{
  "suggestions": [
    {
      "title": "Brief fix title",
      "description": "Detailed description of the fix",
      "confidence": 0.9,
      "changes": [
        {
          "type": "insert|delete|replace",
          "start": {"line": 1, "column": 1},
          "end": {"line": 1, "column": 10},
          "text": "replacement text"
        }
      ]
    }
  ]
}

Focus on minimal changes that fix the specific error while maintaining code quality.
`;
  }

  private getFixResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              changes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['insert', 'delete', 'replace'] },
                    start: {
                      type: 'object',
                      properties: {
                        line: { type: 'number' },
                        column: { type: 'number' },
                      },
                    },
                    end: {
                      type: 'object',
                      properties: {
                        line: { type: 'number' },
                        column: { type: 'number' },
                      },
                    },
                    text: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private findSimilarComponents(invalid: string, valid: string[]): string[] {
    return valid
      .map(component => ({
        component,
        similarity: this.calculateSimilarity(invalid, component),
      }))
      .filter(item => item.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.component);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // 简单的字符串相似度计算
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private extractMissingName(message: string): string {
    const match = message.match(/Cannot find name '([^']+)'/);
    return match ? match[1] : 'unknown';
  }

  private extractVariableName(message: string): string {
    const match = message.match(/'([^']+)' is (defined but never used|assigned a value but never used)/);
    return match ? match[1] : 'unknown';
  }
}

// 接口定义
export interface HealingResult {
  success: boolean;
  originalCode: string;
  healedCode: string;
  iterations: number;
  totalErrors: number;
  totalFixes: number;
  duration: number;
  steps: HealingStep[];
  finalValidation?: ValidationResult;
  error?: string;
  confidence: number;
}

export interface HealingStep {
  iteration: number;
  errorsFound: number;
  fixesApplied: number;
  codeChanged: boolean;
  errors: ValidationError[];
  appliedFixes: FixSuggestion[];
}

export interface ErrorAnalysis {
  totalErrors: number;
  categories: Record<string, number>;
  severity: Record<string, number>;
  fixability: { fixable: number; unfixable: number };
  patterns: string[];
  recommendations: string[];
}

export interface ImprovementAssessment {
  improved: boolean;
  errorReduction: number;
  originalErrors: number;
  fixedErrors: number;
}

export interface AIFixResponse {
  suggestions: {
    title: string;
    description: string;
    confidence: number;
    changes: CodeChange[];
  }[];
}