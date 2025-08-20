import { ESLint } from 'eslint';
import { 
  StaticValidator, 
  ESLintRule, 
  ValidationError,
  FixResult,
  ValidationResult,
  ComponentManifest,
  createLogger,
  createSuccessResult,
  createErrorResult 
} from '@kpc/shared';

const logger = createLogger('ESLintValidator');

export class ESLintStaticValidator implements StaticValidator {
  private eslint: ESLint;
  private customRules: Map<string, any> = new Map();

  constructor(baseConfig?: ESLint.Options) {
    const defaultConfig: ESLint.Options = {
      baseConfig: {
        env: {
          browser: true,
          es2021: true,
          node: true,
        },
        extends: [
          'eslint:recommended',
          '@typescript-eslint/recommended',
          'plugin:react/recommended',
          'plugin:react-hooks/recommended',
        ],
        parser: '@typescript-eslint/parser',
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
          ecmaVersion: 12,
          sourceType: 'module',
        },
        plugins: [
          'react',
          'react-hooks',
          '@typescript-eslint',
        ],
        rules: {
          // 基础规则
          'no-console': 'warn',
          'no-debugger': 'error',
          'no-unused-vars': 'off', // 使用TypeScript版本
          '@typescript-eslint/no-unused-vars': 'error',
          
          // React规则
          'react/react-in-jsx-scope': 'off', // React 17+不需要
          'react/prop-types': 'off', // 使用TypeScript
          'react/jsx-uses-react': 'off',
          'react/jsx-uses-vars': 'error',
          
          // React Hooks规则
          'react-hooks/rules-of-hooks': 'error',
          'react-hooks/exhaustive-deps': 'warn',
        },
        settings: {
          react: {
            version: 'detect',
          },
        },
      },
      useEslintrc: false,
      ...baseConfig,
    };

    this.eslint = new ESLint(defaultConfig);
    this.registerCustomRules();
  }

  async validateTypeScript(code: string): Promise<ValidationResult> {
    // TypeScript验证委托给TypeScript验证器
    throw new Error('TypeScript validation not implemented in ESLint validator');
  }

  async validateESLint(code: string, rules?: ESLintRule[]): Promise<ValidationResult> {
    logger.debug('Validating code with ESLint');

    try {
      // 如果提供了自定义规则，创建新的ESLint实例
      let eslintInstance = this.eslint;
      
      if (rules && rules.length > 0) {
        const customConfig = await this.createCustomConfig(rules);
        eslintInstance = new ESLint(customConfig);
      }

      // 执行ESLint检查
      const results = await eslintInstance.lintText(code, { filePath: 'temp.tsx' });
      
      if (results.length === 0) {
        return createSuccessResult();
      }

      const result = results[0];
      const errors: ValidationError[] = [];
      const warnings: string[] = [];

      for (const message of result.messages) {
        const error: ValidationError = {
          message: message.message,
          severity: message.severity === 2 ? 'error' : 'warning',
          line: message.line,
          column: message.column,
          rule: message.ruleId || undefined,
          fixable: message.fix !== undefined,
        };

        if (error.severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(error.message);
        }
      }

      if (errors.length > 0) {
        return createErrorResult(
          `ESLint validation failed with ${errors.length} errors`,
          'error',
          { errors, warnings }
        );
      }

      return createSuccessResult({ warnings });

    } catch (error) {
      logger.error(`ESLint validation failed: ${error}`);
      return createErrorResult(`ESLint error: ${error}`, 'error');
    }
  }

  async autoFix(code: string, errors: ValidationError[]): Promise<FixResult> {
    logger.debug(`Attempting to auto-fix ${errors.length} ESLint errors`);

    try {
      // 使用ESLint的自动修复功能
      const results = await this.eslint.lintText(code, { filePath: 'temp.tsx' });
      
      if (results.length === 0) {
        return {
          success: true,
          fixedCode: code,
          explanation: 'No fixes needed',
          confidence: 1.0,
          appliedFixes: [],
        };
      }

      const result = results[0];
      
      // 应用自动修复
      const fixedCode = ESLint.getSourceCode(result)?.getText() || code;
      
      // 统计应用的修复
      const appliedFixes = result.messages
        .filter(msg => msg.fix)
        .map(msg => ({
          rule: msg.ruleId || 'unknown',
          description: msg.message,
          line: msg.line,
          column: msg.column,
        }));

      // 验证修复后的代码
      const validationResult = await this.validateESLint(fixedCode);
      const success = validationResult.success;

      return {
        success,
        fixedCode: success ? fixedCode : undefined,
        explanation: `Applied ${appliedFixes.length} ESLint fixes`,
        confidence: success ? 0.9 : 0.5,
        appliedFixes,
      };

    } catch (error) {
      logger.error(`ESLint auto-fix failed: ${error}`);
      return {
        success: false,
        explanation: `Auto-fix failed: ${error}`,
        confidence: 0,
        appliedFixes: [],
      };
    }
  }

  async getTypeInfo(): Promise<any> {
    throw new Error('Type info not available in ESLint validator');
  }

  async validateComponentAPI(code: string, manifest: ComponentManifest): Promise<ValidationResult> {
    logger.debug('Validating component API with custom ESLint rules');

    try {
      // 生成基于清单的自定义规则
      const customRules = this.generateManifestRules(manifest);
      
      // 使用自定义规则验证
      const result = await this.validateESLint(code, customRules);
      
      return result;

    } catch (error) {
      logger.error(`Component API validation failed: ${error}`);
      return createErrorResult(`Validation error: ${error}`, 'error');
    }
  }

  /**
   * 生成基于组件清单的ESLint规则
   */
  generateManifestRules(manifest: ComponentManifest): ESLintRule[] {
    const rules: ESLintRule[] = [];

    // 组件白名单规则
    rules.push({
      name: 'kpc/allowed-components',
      severity: 'error',
      options: {
        allowedComponents: manifest.components.map(c => c.name),
      },
    });

    // 属性验证规则
    for (const component of manifest.components) {
      rules.push({
        name: 'kpc/component-props',
        severity: 'error',
        options: {
          componentName: component.name,
          requiredProps: component.props.filter(p => p.required).map(p => p.name),
          allowedProps: component.props.map(p => p.name),
          deprecatedProps: component.props.filter(p => p.deprecated).map(p => p.name),
        },
      });
    }

    // 反模式检测规则
    for (const antiPattern of manifest.antiPatterns) {
      rules.push({
        name: 'kpc/anti-pattern',
        severity: antiPattern.severity === 'error' ? 'error' : 'warn',
        options: {
          patternId: antiPattern.id,
          description: antiPattern.description,
          badExample: antiPattern.badExample,
          goodExample: antiPattern.goodExample,
        },
      });
    }

    return rules;
  }

  /**
   * 注册自定义ESLint规则
   */
  private registerCustomRules(): void {
    // 允许的组件规则
    this.customRules.set('kpc/allowed-components', {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce usage of only allowed components from manifest',
          category: 'Possible Errors',
        },
        schema: [
          {
            type: 'object',
            properties: {
              allowedComponents: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create: (context: any) => {
        const options = context.options[0] || {};
        const allowedComponents = new Set(options.allowedComponents || []);

        return {
          JSXOpeningElement(node: any) {
            const componentName = node.name.name;
            
            if (componentName && !allowedComponents.has(componentName)) {
              // 检查是否是HTML标签
              if (!/^[a-z]/.test(componentName)) {
                context.report({
                  node,
                  message: `Component '${componentName}' is not allowed. Use only components from the manifest.`,
                });
              }
            }
          },
        };
      },
    });

    // 组件属性验证规则
    this.customRules.set('kpc/component-props', {
      meta: {
        type: 'problem',
        docs: {
          description: 'Validate component props against manifest',
          category: 'Possible Errors',
        },
        schema: [
          {
            type: 'object',
            properties: {
              componentName: { type: 'string' },
              requiredProps: {
                type: 'array',
                items: { type: 'string' },
              },
              allowedProps: {
                type: 'array',
                items: { type: 'string' },
              },
              deprecatedProps: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create: (context: any) => {
        const options = context.options[0] || {};
        const { componentName, requiredProps = [], allowedProps = [], deprecatedProps = [] } = options;

        return {
          JSXOpeningElement(node: any) {
            if (node.name.name !== componentName) {
              return;
            }

            const usedProps = new Set<string>();
            
            // 收集使用的属性
            for (const attr of node.attributes) {
              if (attr.type === 'JSXAttribute' && attr.name) {
                const propName = attr.name.name;
                usedProps.add(propName);

                // 检查是否是允许的属性
                if (allowedProps.length > 0 && !allowedProps.includes(propName)) {
                  context.report({
                    node: attr,
                    message: `Property '${propName}' is not allowed for component '${componentName}'.`,
                  });
                }

                // 检查是否是废弃的属性
                if (deprecatedProps.includes(propName)) {
                  context.report({
                    node: attr,
                    message: `Property '${propName}' is deprecated for component '${componentName}'.`,
                  });
                }
              }
            }

            // 检查必需属性
            for (const requiredProp of requiredProps) {
              if (!usedProps.has(requiredProp)) {
                context.report({
                  node,
                  message: `Required property '${requiredProp}' is missing for component '${componentName}'.`,
                });
              }
            }
          },
        };
      },
    });

    // 反模式检测规则
    this.customRules.set('kpc/anti-pattern', {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Detect anti-patterns in component usage',
          category: 'Best Practices',
        },
        schema: [
          {
            type: 'object',
            properties: {
              patternId: { type: 'string' },
              description: { type: 'string' },
              badExample: { type: 'string' },
              goodExample: { type: 'string' },
            },
            additionalProperties: false,
          },
        ],
      },
      create: (context: any) => {
        const options = context.options[0] || {};
        const { patternId, description, badExample, goodExample } = options;

        return {
          Program(node: any) {
            const sourceCode = context.getSourceCode();
            const text = sourceCode.getText();

            // 简单的模式匹配检测
            if (badExample && text.includes(badExample.trim())) {
              context.report({
                node,
                message: `Anti-pattern detected (${patternId}): ${description}. Consider using: ${goodExample}`,
              });
            }
          },
        };
      },
    });

    logger.debug(`Registered ${this.customRules.size} custom ESLint rules`);
  }

  private async createCustomConfig(rules: ESLintRule[]): Promise<ESLint.Options> {
    const baseConfig = await this.eslint.calculateConfigForFile('temp.tsx');
    
    // 应用自定义规则
    const customRules: Record<string, any> = {};
    
    for (const rule of rules) {
      if (rule.severity === 'off') {
        customRules[rule.name] = 'off';
      } else {
        customRules[rule.name] = [rule.severity, rule.options];
      }
    }

    return {
      baseConfig: {
        ...baseConfig,
        rules: {
          ...baseConfig.rules,
          ...customRules,
        },
      },
      useEslintrc: false,
    };
  }

  /**
   * 添加自定义规则到ESLint配置
   */
  addCustomRule(name: string, rule: any): void {
    this.customRules.set(name, rule);
    logger.debug(`Added custom ESLint rule: ${name}`);
  }

  /**
   * 获取所有可用的规则
   */
  getAvailableRules(): string[] {
    return Array.from(this.customRules.keys());
  }

  /**
   * 生成规则文档
   */
  generateRuleDocumentation(): Record<string, any> {
    const docs: Record<string, any> = {};
    
    for (const [name, rule] of this.customRules) {
      docs[name] = {
        description: rule.meta?.docs?.description || 'No description available',
        category: rule.meta?.docs?.category || 'Custom',
        type: rule.meta?.type || 'suggestion',
        schema: rule.meta?.schema || [],
      };
    }
    
    return docs;
  }
}