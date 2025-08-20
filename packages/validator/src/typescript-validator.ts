import * as ts from 'typescript';
import { 
  StaticValidator, 
  TypeScriptValidationOptions, 
  ValidationError,
  TypeInfo,
  CodePosition,
  FixResult,
  ValidationResult,
  createLogger,
  createSuccessResult,
  createErrorResult 
} from '@kpc/shared';

const logger = createLogger('TypeScriptValidator');

export class TypeScriptStaticValidator implements StaticValidator {
  private compilerOptions: ts.CompilerOptions;
  private host: ts.CompilerHost;

  constructor(options: TypeScriptValidationOptions = {}) {
    this.compilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      lib: ['ES2020', 'DOM'],
      strict: options.strict ?? true,
      skipLibCheck: options.skipLibCheck ?? true,
      declaration: options.declaration ?? false,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      jsx: ts.JsxEmit.React,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      ...this.parseOptions(options),
    };

    this.host = ts.createCompilerHost(this.compilerOptions);
  }

  async validateTypeScript(code: string, options?: TypeScriptValidationOptions): Promise<ValidationResult> {
    logger.debug('Validating TypeScript code');

    try {
      // 创建临时文件名
      const fileName = 'temp.tsx';
      
      // 创建源文件
      const sourceFile = ts.createSourceFile(
        fileName,
        code,
        this.compilerOptions.target || ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TSX
      );

      // 创建程序
      const program = ts.createProgram([fileName], this.compilerOptions, {
        ...this.host,
        getSourceFile: (name) => name === fileName ? sourceFile : this.host.getSourceFile(name, this.compilerOptions.target!),
      });

      // 获取诊断信息
      const diagnostics = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile),
      ];

      const errors: ValidationError[] = [];
      const warnings: string[] = [];

      for (const diagnostic of diagnostics) {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        const severity = this.getDiagnosticSeverity(diagnostic.category);
        
        let line: number | undefined;
        let column: number | undefined;

        if (diagnostic.file && diagnostic.start !== undefined) {
          const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          line = position.line + 1;
          column = position.character + 1;
        }

        const error: ValidationError = {
          message,
          severity,
          line,
          column,
          rule: `TS${diagnostic.code}`,
          fixable: this.isFixableDiagnostic(diagnostic),
        };

        if (severity === 'error') {
          errors.push(error);
        } else {
          warnings.push(message);
        }
      }

      if (errors.length > 0) {
        return createErrorResult(
          `TypeScript validation failed with ${errors.length} errors`,
          'error',
          { errors, warnings }
        );
      }

      return createSuccessResult({ warnings });

    } catch (error) {
      logger.error(`TypeScript validation failed: ${error}`);
      return createErrorResult(`Validation error: ${error}`, 'error');
    }
  }

  async validateESLint(code: string, rules?: any[]): Promise<ValidationResult> {
    // ESLint验证将在eslint-validator.ts中实现
    throw new Error('ESLint validation not implemented in TypeScript validator');
  }

  async autoFix(code: string, errors: ValidationError[]): Promise<FixResult> {
    logger.debug(`Attempting to auto-fix ${errors.length} errors`);

    try {
      let fixedCode = code;
      const appliedFixes: any[] = [];
      let confidence = 0.8;

      // 创建源文件用于分析
      const sourceFile = ts.createSourceFile(
        'temp.tsx',
        code,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TSX
      );

      for (const error of errors) {
        const fix = await this.generateFix(error, sourceFile);
        if (fix) {
          fixedCode = this.applyFix(fixedCode, fix);
          appliedFixes.push({
            rule: error.rule,
            description: fix.description,
            line: error.line,
            column: error.column,
          });
        }
      }

      // 验证修复后的代码
      const validationResult = await this.validateTypeScript(fixedCode);
      const success = validationResult.success;

      if (!success) {
        confidence *= 0.5; // 降低置信度
      }

      return {
        success,
        fixedCode: success ? fixedCode : undefined,
        explanation: `Applied ${appliedFixes.length} fixes`,
        confidence,
        appliedFixes,
      };

    } catch (error) {
      logger.error(`Auto-fix failed: ${error}`);
      return {
        success: false,
        explanation: `Auto-fix failed: ${error}`,
        confidence: 0,
        appliedFixes: [],
      };
    }
  }

  async getTypeInfo(code: string, position: CodePosition): Promise<TypeInfo> {
    logger.debug(`Getting type info at position ${position.line}:${position.column}`);

    try {
      const fileName = 'temp.tsx';
      const sourceFile = ts.createSourceFile(
        fileName,
        code,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TSX
      );

      const program = ts.createProgram([fileName], this.compilerOptions, {
        ...this.host,
        getSourceFile: (name) => name === fileName ? sourceFile : this.host.getSourceFile(name, this.compilerOptions.target!),
      });

      const typeChecker = program.getTypeChecker();
      const offset = sourceFile.getPositionOfLineAndCharacter(position.line - 1, position.column - 1);
      const node = this.findNodeAtPosition(sourceFile, offset);

      if (!node) {
        throw new Error('No node found at position');
      }

      const type = typeChecker.getTypeAtLocation(node);
      const symbol = typeChecker.getSymbolAtLocation(node);

      const typeInfo: TypeInfo = {
        type: typeChecker.typeToString(type),
        documentation: symbol ? ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)) : undefined,
      };

      // 如果是函数类型，获取签名信息
      const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call);
      if (signatures.length > 0) {
        const signature = signatures[0];
        typeInfo.signature = typeChecker.signatureToString(signature);
        typeInfo.returnType = typeChecker.typeToString(signature.getReturnType());
        typeInfo.parameters = signature.parameters.map(param => ({
          name: param.getName(),
          type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(param, node)),
          optional: typeChecker.isOptionalParameter(param.valueDeclaration as ts.ParameterDeclaration),
          documentation: ts.displayPartsToString(param.getDocumentationComment(typeChecker)),
        }));
      }

      return typeInfo;

    } catch (error) {
      logger.error(`Failed to get type info: ${error}`);
      throw error;
    }
  }

  async validateComponentAPI(code: string, manifest: any): Promise<ValidationResult> {
    logger.debug('Validating component API against manifest');

    try {
      const sourceFile = ts.createSourceFile(
        'temp.tsx',
        code,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TSX
      );

      const errors: ValidationError[] = [];
      const warnings: string[] = [];

      // 查找组件定义
      const componentNode = this.findComponentDefinition(sourceFile);
      if (!componentNode) {
        errors.push({
          message: 'No component definition found',
          severity: 'error',
        });
        return createErrorResult('Component validation failed', 'error', { errors });
      }

      // 验证Props接口
      const propsInterface = this.findPropsInterface(sourceFile);
      if (propsInterface && manifest.props) {
        this.validatePropsInterface(propsInterface, manifest.props, errors, warnings);
      }

      // 验证事件处理
      if (manifest.events) {
        this.validateEventHandlers(sourceFile, manifest.events, errors, warnings);
      }

      if (errors.length > 0) {
        return createErrorResult(
          `Component API validation failed with ${errors.length} errors`,
          'error',
          { errors, warnings }
        );
      }

      return createSuccessResult({ warnings });

    } catch (error) {
      logger.error(`Component API validation failed: ${error}`);
      return createErrorResult(`Validation error: ${error}`, 'error');
    }
  }

  private parseOptions(options: TypeScriptValidationOptions): Partial<ts.CompilerOptions> {
    const parsed: Partial<ts.CompilerOptions> = {};

    if (options.target) {
      parsed.target = this.parseScriptTarget(options.target);
    }

    if (options.module) {
      parsed.module = this.parseModuleKind(options.module);
    }

    if (options.lib) {
      parsed.lib = options.lib.map(lib => `lib.${lib.toLowerCase()}.d.ts`);
    }

    return parsed;
  }

  private parseScriptTarget(target: string): ts.ScriptTarget {
    const targetMap: Record<string, ts.ScriptTarget> = {
      'es3': ts.ScriptTarget.ES3,
      'es5': ts.ScriptTarget.ES5,
      'es2015': ts.ScriptTarget.ES2015,
      'es2016': ts.ScriptTarget.ES2016,
      'es2017': ts.ScriptTarget.ES2017,
      'es2018': ts.ScriptTarget.ES2018,
      'es2019': ts.ScriptTarget.ES2019,
      'es2020': ts.ScriptTarget.ES2020,
      'esnext': ts.ScriptTarget.ESNext,
    };

    return targetMap[target.toLowerCase()] || ts.ScriptTarget.ES2020;
  }

  private parseModuleKind(module: string): ts.ModuleKind {
    const moduleMap: Record<string, ts.ModuleKind> = {
      'none': ts.ModuleKind.None,
      'commonjs': ts.ModuleKind.CommonJS,
      'amd': ts.ModuleKind.AMD,
      'system': ts.ModuleKind.System,
      'umd': ts.ModuleKind.UMD,
      'es6': ts.ModuleKind.ES2015,
      'es2015': ts.ModuleKind.ES2015,
      'es2020': ts.ModuleKind.ES2020,
      'esnext': ts.ModuleKind.ESNext,
    };

    return moduleMap[module.toLowerCase()] || ts.ModuleKind.ESNext;
  }

  private getDiagnosticSeverity(category: ts.DiagnosticCategory): 'error' | 'warning' | 'info' {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return 'error';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      case ts.DiagnosticCategory.Suggestion:
      case ts.DiagnosticCategory.Message:
        return 'info';
      default:
        return 'error';
    }
  }

  private isFixableDiagnostic(diagnostic: ts.Diagnostic): boolean {
    // 某些TypeScript错误是可以自动修复的
    const fixableCodes = [
      2304, // Cannot find name
      2307, // Cannot find module
      2322, // Type is not assignable
      2339, // Property does not exist
      2345, // Argument of type is not assignable
      2554, // Expected N arguments, but got M
    ];

    return fixableCodes.includes(diagnostic.code);
  }

  private async generateFix(error: ValidationError, sourceFile: ts.SourceFile): Promise<any> {
    // 根据错误类型生成修复建议
    if (!error.rule || !error.line) {
      return null;
    }

    const ruleCode = parseInt(error.rule.replace('TS', ''));

    switch (ruleCode) {
      case 2304: // Cannot find name
        return this.generateImportFix(error, sourceFile);
      
      case 2322: // Type is not assignable
        return this.generateTypeFix(error, sourceFile);
      
      case 2339: // Property does not exist
        return this.generatePropertyFix(error, sourceFile);
      
      default:
        return null;
    }
  }

  private generateImportFix(error: ValidationError, sourceFile: ts.SourceFile): any {
    // 生成导入修复
    const missingName = this.extractMissingName(error.message);
    if (!missingName) return null;

    return {
      description: `Add import for ${missingName}`,
      type: 'import',
      name: missingName,
    };
  }

  private generateTypeFix(error: ValidationError, sourceFile: ts.SourceFile): any {
    // 生成类型修复
    return {
      description: 'Fix type assignment',
      type: 'type',
    };
  }

  private generatePropertyFix(error: ValidationError, sourceFile: ts.SourceFile): any {
    // 生成属性修复
    return {
      description: 'Add missing property',
      type: 'property',
    };
  }

  private applyFix(code: string, fix: any): string {
    // 应用修复到代码
    switch (fix.type) {
      case 'import':
        return this.addImport(code, fix.name);
      
      case 'type':
        return this.fixType(code, fix);
      
      case 'property':
        return this.addProperty(code, fix);
      
      default:
        return code;
    }
  }

  private addImport(code: string, name: string): string {
    // 简单的导入添加逻辑
    const importStatement = `import { ${name} } from 'react';\n`;
    return importStatement + code;
  }

  private fixType(code: string, fix: any): string {
    // 简单的类型修复逻辑
    return code;
  }

  private addProperty(code: string, fix: any): string {
    // 简单的属性添加逻辑
    return code;
  }

  private extractMissingName(message: string): string | null {
    const match = message.match(/Cannot find name '([^']+)'/);
    return match ? match[1] : null;
  }

  private findNodeAtPosition(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
      if (position >= node.getStart() && position < node.getEnd()) {
        return ts.forEachChild(node, find) || node;
      }
      return undefined;
    }

    return find(sourceFile);
  }

  private findComponentDefinition(sourceFile: ts.SourceFile): ts.Node | undefined {
    // 查找React组件定义
    function visit(node: ts.Node): ts.Node | undefined {
      // 查找函数组件
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
        // 检查是否返回JSX
        if (this.returnsJSX(node)) {
          return node;
        }
      }

      // 查找类组件
      if (ts.isClassDeclaration(node)) {
        // 检查是否继承自React.Component
        if (this.extendsReactComponent(node)) {
          return node;
        }
      }

      return ts.forEachChild(node, visit);
    }

    return visit(sourceFile);
  }

  private returnsJSX(node: ts.FunctionDeclaration | ts.ArrowFunction): boolean {
    // 简化的JSX返回检查
    return true; // 实际实现需要更复杂的AST分析
  }

  private extendsReactComponent(node: ts.ClassDeclaration): boolean {
    // 简化的React组件继承检查
    return true; // 实际实现需要更复杂的AST分析
  }

  private findPropsInterface(sourceFile: ts.SourceFile): ts.InterfaceDeclaration | undefined {
    function visit(node: ts.Node): ts.InterfaceDeclaration | undefined {
      if (ts.isInterfaceDeclaration(node) && node.name.text.includes('Props')) {
        return node;
      }
      return ts.forEachChild(node, visit);
    }

    return visit(sourceFile);
  }

  private validatePropsInterface(
    propsInterface: ts.InterfaceDeclaration,
    manifestProps: any[],
    errors: ValidationError[],
    warnings: string[]
  ): void {
    // 验证Props接口与清单的一致性
    const interfaceProps = new Set<string>();
    
    for (const member of propsInterface.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        interfaceProps.add(member.name.text);
      }
    }

    // 检查清单中的属性是否在接口中定义
    for (const prop of manifestProps) {
      if (!interfaceProps.has(prop.name)) {
        if (prop.required) {
          errors.push({
            message: `Required property '${prop.name}' is missing from Props interface`,
            severity: 'error',
          });
        } else {
          warnings.push(`Optional property '${prop.name}' is missing from Props interface`);
        }
      }
    }

    // 检查接口中的属性是否在清单中定义
    const manifestPropNames = new Set(manifestProps.map(p => p.name));
    for (const propName of interfaceProps) {
      if (!manifestPropNames.has(propName)) {
        warnings.push(`Property '${propName}' in interface is not defined in manifest`);
      }
    }
  }

  private validateEventHandlers(
    sourceFile: ts.SourceFile,
    manifestEvents: any[],
    errors: ValidationError[],
    warnings: string[]
  ): void {
    // 验证事件处理器
    // 这里需要更复杂的AST分析来查找事件处理器
    // 简化实现
  }
}