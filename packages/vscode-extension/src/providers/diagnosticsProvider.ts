import * as vscode from 'vscode';
import { KPCApiClient } from '../services/apiClient';
import { ConfigurationManager } from '../services/configurationManager';
import { ValidationResult, ValidationIssue } from '../types';

export class DiagnosticsProvider {
  private validationCache = new Map<string, { result: ValidationResult; timestamp: number }>();
  private readonly cacheTimeout = 30000; // 30 seconds

  constructor(
    private apiClient: KPCApiClient,
    private configManager: ConfigurationManager,
    private diagnosticsCollection: vscode.DiagnosticCollection
  ) {}

  async validateDocument(document: vscode.TextDocument): Promise<void> {
    if (!this.shouldValidateDocument(document)) {
      return;
    }

    const documentUri = document.uri.toString();
    const documentVersion = document.version;
    
    // Check cache first
    const cached = this.validationCache.get(documentUri);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.updateDiagnostics(document, cached.result);
      return;
    }

    try {
      const code = document.getText();
      const filePath = document.fileName;
      const framework = this.detectFramework(document);

      const result = await this.apiClient.validateCode(code, filePath, framework);
      
      // Cache the result
      this.validationCache.set(documentUri, {
        result,
        timestamp: Date.now()
      });

      // Only update diagnostics if document hasn't changed
      if (document.version === documentVersion) {
        this.updateDiagnostics(document, result);
      }

    } catch (error) {
      console.error('Validation failed:', error);
      
      // Show a single diagnostic for validation failure
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `KPC validation failed: ${(error as Error).message}`,
        vscode.DiagnosticSeverity.Information
      );
      diagnostic.source = 'KPC';
      diagnostic.code = 'validation-error';
      
      this.diagnosticsCollection.set(document.uri, [diagnostic]);
    }
  }

  private shouldValidateDocument(document: vscode.TextDocument): boolean {
    // Only validate supported file types
    const supportedLanguages = ['typescriptreact', 'javascriptreact', 'vue'];
    if (!supportedLanguages.includes(document.languageId)) {
      return false;
    }

    // Skip if real-time validation is disabled
    if (!this.configManager.isRealTimeValidationEnabled()) {
      return false;
    }

    // Skip very large files to avoid performance issues
    if (document.getText().length > 100000) {
      return false;
    }

    return true;
  }

  private detectFramework(document: vscode.TextDocument): string {
    const content = document.getText();
    const languageId = document.languageId;

    if (languageId === 'vue') {
      return 'vue';
    }

    if (languageId.includes('react')) {
      return 'react';
    }

    // Try to detect from content
    if (content.includes('import React') || content.includes('from \'react\'')) {
      return 'react';
    }

    if (content.includes('<template>') || content.includes('defineComponent')) {
      return 'vue';
    }

    if (content.includes('Intact') || content.includes('@intact')) {
      return 'intact';
    }

    return this.configManager.getFramework();
  }

  private updateDiagnostics(document: vscode.TextDocument, result: ValidationResult): void {
    const diagnostics: vscode.Diagnostic[] = [];

    // Convert errors to diagnostics
    result.errors.forEach(error => {
      const diagnostic = this.createDiagnostic(error, vscode.DiagnosticSeverity.Error);
      diagnostics.push(diagnostic);
    });

    // Convert warnings to diagnostics
    result.warnings.forEach(warning => {
      const diagnostic = this.createDiagnostic(warning, vscode.DiagnosticSeverity.Warning);
      diagnostics.push(diagnostic);
    });

    // Add suggestions as information diagnostics
    result.suggestions?.forEach(suggestion => {
      const range = new vscode.Range(
        Math.max(0, suggestion.line - 1),
        Math.max(0, suggestion.column - 1),
        Math.max(0, suggestion.line - 1),
        Math.max(0, suggestion.column + 10)
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        suggestion.message,
        vscode.DiagnosticSeverity.Hint
      );
      
      diagnostic.source = 'KPC';
      diagnostic.code = 'suggestion';
      
      // Add related information for the fix
      if (suggestion.fix) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(document.uri, range),
            `Suggested fix: ${suggestion.fix}`
          )
        ];
      }

      diagnostics.push(diagnostic);
    });

    this.diagnosticsCollection.set(document.uri, diagnostics);
  }

  private createDiagnostic(issue: ValidationIssue, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
    const range = new vscode.Range(
      Math.max(0, issue.line - 1),
      Math.max(0, issue.column - 1),
      Math.max(0, issue.line - 1),
      Math.max(0, issue.column + 10)
    );

    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = 'KPC';
    diagnostic.code = issue.rule;

    // Add tags for fixable issues
    if (issue.fixable) {
      diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    }

    return diagnostic;
  }

  clearDiagnostics(document: vscode.TextDocument): void {
    this.diagnosticsCollection.delete(document.uri);
    this.validationCache.delete(document.uri.toString());
  }

  clearAllDiagnostics(): void {
    this.diagnosticsCollection.clear();
    this.validationCache.clear();
  }

  // Validate all open documents
  async validateAllOpenDocuments(): Promise<void> {
    const promises = vscode.workspace.textDocuments
      .filter(doc => this.shouldValidateDocument(doc))
      .map(doc => this.validateDocument(doc));

    await Promise.all(promises);
  }

  // Get validation statistics
  getValidationStats(): { totalIssues: number; errors: number; warnings: number; suggestions: number } {
    let totalIssues = 0;
    let errors = 0;
    let warnings = 0;
    let suggestions = 0;

    this.diagnosticsCollection.forEach((diagnostics) => {
      diagnostics.forEach(diagnostic => {
        totalIssues++;
        switch (diagnostic.severity) {
          case vscode.DiagnosticSeverity.Error:
            errors++;
            break;
          case vscode.DiagnosticSeverity.Warning:
            warnings++;
            break;
          case vscode.DiagnosticSeverity.Hint:
            suggestions++;
            break;
        }
      });
    });

    return { totalIssues, errors, warnings, suggestions };
  }
}