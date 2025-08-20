import * as vscode from 'vscode';
import { KPCApiClient } from '../services/apiClient';
import { ConfigurationManager } from '../services/configurationManager';

export class CodeActionProvider implements vscode.CodeActionProvider {
  constructor(
    private apiClient: KPCApiClient,
    private configManager: ConfigurationManager
  ) {}

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Add quick fixes for KPC diagnostics
    const kpcDiagnostics = context.diagnostics.filter(d => d.source === 'KPC');
    
    for (const diagnostic of kpcDiagnostics) {
      const quickFixes = await this.createQuickFixes(document, diagnostic, range);
      actions.push(...quickFixes);
    }

    // Add refactoring actions
    const refactorActions = await this.createRefactorActions(document, range);
    actions.push(...refactorActions);

    // Add source actions
    const sourceActions = await this.createSourceActions(document, range);
    actions.push(...sourceActions);

    return actions;
  }

  private async createQuickFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    switch (diagnostic.code) {
      case 'missing-prop':
        actions.push(...this.createMissingPropFixes(document, diagnostic, range));
        break;
      case 'invalid-prop-type':
        actions.push(...this.createInvalidPropTypeFixes(document, diagnostic, range));
        break;
      case 'deprecated-component':
        actions.push(...this.createDeprecatedComponentFixes(document, diagnostic, range));
        break;
      case 'missing-import':
        actions.push(...this.createMissingImportFixes(document, diagnostic, range));
        break;
      case 'unused-prop':
        actions.push(...this.createUnusedPropFixes(document, diagnostic, range));
        break;
      case 'accessibility-issue':
        actions.push(...this.createAccessibilityFixes(document, diagnostic, range));
        break;
      default:
        // Generic fix action
        if (diagnostic.message.includes('fixable')) {
          actions.push(this.createGenericFix(document, diagnostic, range));
        }
        break;
    }

    return actions;
  }

  private createMissingPropFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Extract component name and missing prop from diagnostic message
    const match = diagnostic.message.match(/Component '(\w+)' is missing required prop '(\w+)'/);
    if (!match) return actions;

    const [, componentName, propName] = match;

    // Add the missing prop
    const addPropAction = new vscode.CodeAction(
      `Add required prop '${propName}'`,
      vscode.CodeActionKind.QuickFix
    );
    addPropAction.isPreferred = true;

    const line = document.lineAt(diagnostic.range.start.line);
    const componentMatch = line.text.match(new RegExp(`<${componentName}([^>]*)`));
    
    if (componentMatch) {
      const insertPosition = new vscode.Position(
        diagnostic.range.start.line,
        componentMatch.index! + componentMatch[0].length
      );

      addPropAction.edit = new vscode.WorkspaceEdit();
      addPropAction.edit.insert(
        document.uri,
        insertPosition,
        `\n  ${propName}={$1}`
      );
    }

    actions.push(addPropAction);

    // Add prop with default value
    const addPropWithDefaultAction = new vscode.CodeAction(
      `Add '${propName}' with default value`,
      vscode.CodeActionKind.QuickFix
    );

    // This would need to fetch the prop definition to get the default value
    actions.push(addPropWithDefaultAction);

    return actions;
  }

  private createInvalidPropTypeFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Extract expected type from diagnostic message
    const match = diagnostic.message.match(/Expected '(\w+)' but got '(\w+)'/);
    if (!match) return actions;

    const [, expectedType, actualType] = match;

    // Fix the prop type
    const fixTypeAction = new vscode.CodeAction(
      `Change to ${expectedType}`,
      vscode.CodeActionKind.QuickFix
    );
    fixTypeAction.isPreferred = true;

    const line = document.lineAt(diagnostic.range.start.line);
    const propMatch = line.text.match(/(\w+)=["'{]([^"'}]+)["'}]/);
    
    if (propMatch) {
      const [fullMatch, propName, propValue] = propMatch;
      let newValue = propValue;

      // Convert value based on expected type
      switch (expectedType) {
        case 'boolean':
          newValue = propValue.toLowerCase() === 'true' ? 'true' : 'false';
          break;
        case 'number':
          newValue = isNaN(Number(propValue)) ? '0' : propValue;
          break;
        case 'string':
          newValue = `"${propValue}"`;
          break;
      }

      fixTypeAction.edit = new vscode.WorkspaceEdit();
      fixTypeAction.edit.replace(
        document.uri,
        diagnostic.range,
        `${propName}={${newValue}}`
      );
    }

    actions.push(fixTypeAction);

    return actions;
  }

  private createDeprecatedComponentFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Extract component names from diagnostic message
    const match = diagnostic.message.match(/Component '(\w+)' is deprecated, use '(\w+)' instead/);
    if (!match) return actions;

    const [, oldComponent, newComponent] = match;

    // Replace with new component
    const replaceAction = new vscode.CodeAction(
      `Replace with '${newComponent}'`,
      vscode.CodeActionKind.QuickFix
    );
    replaceAction.isPreferred = true;

    replaceAction.edit = new vscode.WorkspaceEdit();
    replaceAction.edit.replace(
      document.uri,
      diagnostic.range,
      newComponent
    );

    actions.push(replaceAction);

    // Update import statement
    const updateImportAction = new vscode.CodeAction(
      `Update import to use '${newComponent}'`,
      vscode.CodeActionKind.QuickFix
    );

    // Find and update import statement
    const text = document.getText();
    const importMatch = text.match(new RegExp(`import\\s*{([^}]*${oldComponent}[^}]*)}\\s*from`));
    
    if (importMatch) {
      const importRange = document.positionAt(text.indexOf(importMatch[0]));
      const importEndRange = document.positionAt(text.indexOf(importMatch[0]) + importMatch[0].length);
      
      updateImportAction.edit = new vscode.WorkspaceEdit();
      updateImportAction.edit.replace(
        document.uri,
        new vscode.Range(importRange, importEndRange),
        importMatch[0].replace(oldComponent, newComponent)
      );
    }

    actions.push(updateImportAction);

    return actions;
  }

  private createMissingImportFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Extract component name from diagnostic message
    const match = diagnostic.message.match(/Component '(\w+)' is not imported/);
    if (!match) return actions;

    const [, componentName] = match;

    // Add import statement
    const addImportAction = new vscode.CodeAction(
      `Import '${componentName}' from KPC`,
      vscode.CodeActionKind.QuickFix
    );
    addImportAction.isPreferred = true;

    // Find the best place to add the import
    const text = document.getText();
    const lines = text.split('\n');
    let insertLine = 0;

    // Find last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        insertLine = i + 1;
      } else if (lines[i].trim() && !lines[i].startsWith('//')) {
        break;
      }
    }

    addImportAction.edit = new vscode.WorkspaceEdit();
    addImportAction.edit.insert(
      document.uri,
      new vscode.Position(insertLine, 0),
      `import { ${componentName} } from '@kpc/components';\n`
    );

    actions.push(addImportAction);

    return actions;
  }

  private createUnusedPropFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Remove unused prop
    const removePropAction = new vscode.CodeAction(
      'Remove unused prop',
      vscode.CodeActionKind.QuickFix
    );
    removePropAction.isPreferred = true;

    // Find the prop and remove it
    const line = document.lineAt(diagnostic.range.start.line);
    const propMatch = line.text.match(/\s*(\w+)=["'{][^"'}]*["'}]/);
    
    if (propMatch) {
      const propStart = line.text.indexOf(propMatch[0]);
      const propEnd = propStart + propMatch[0].length;
      
      removePropAction.edit = new vscode.WorkspaceEdit();
      removePropAction.edit.delete(
        document.uri,
        new vscode.Range(
          diagnostic.range.start.line,
          propStart,
          diagnostic.range.start.line,
          propEnd
        )
      );
    }

    actions.push(removePropAction);

    return actions;
  }

  private createAccessibilityFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    if (diagnostic.message.includes('missing alt attribute')) {
      const addAltAction = new vscode.CodeAction(
        'Add alt attribute',
        vscode.CodeActionKind.QuickFix
      );
      addAltAction.isPreferred = true;

      // Add alt attribute to img tag
      const line = document.lineAt(diagnostic.range.start.line);
      const imgMatch = line.text.match(/<img([^>]*)/);
      
      if (imgMatch) {
        const insertPosition = new vscode.Position(
          diagnostic.range.start.line,
          imgMatch.index! + imgMatch[0].length
        );

        addAltAction.edit = new vscode.WorkspaceEdit();
        addAltAction.edit.insert(
          document.uri,
          insertPosition,
          ' alt="$1"'
        );
      }

      actions.push(addAltAction);
    }

    if (diagnostic.message.includes('missing aria-label')) {
      const addAriaLabelAction = new vscode.CodeAction(
        'Add aria-label',
        vscode.CodeActionKind.QuickFix
      );

      // Similar implementation for aria-label
      actions.push(addAriaLabelAction);
    }

    return actions;
  }

  private createGenericFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    range: vscode.Range
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Apply KPC fix',
      vscode.CodeActionKind.QuickFix
    );

    // This would call the API to get the specific fix
    action.command = {
      command: 'kpc.applyFix',
      title: 'Apply Fix',
      arguments: [document.uri, diagnostic]
    };

    return action;
  }

  private async createRefactorActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Extract component to separate file
    const extractComponentAction = new vscode.CodeAction(
      'Extract component to separate file',
      vscode.CodeActionKind.RefactorExtract
    );

    extractComponentAction.command = {
      command: 'kpc.extractComponent',
      title: 'Extract Component',
      arguments: [document.uri, range]
    };

    actions.push(extractComponentAction);

    // Convert to functional component
    const convertToFunctionalAction = new vscode.CodeAction(
      'Convert to functional component',
      vscode.CodeActionKind.RefactorRewrite
    );

    convertToFunctionalAction.command = {
      command: 'kpc.convertToFunctional',
      title: 'Convert to Functional',
      arguments: [document.uri, range]
    };

    actions.push(convertToFunctionalAction);

    // Add TypeScript types
    const addTypesAction = new vscode.CodeAction(
      'Add TypeScript types',
      vscode.CodeActionKind.RefactorRewrite
    );

    addTypesAction.command = {
      command: 'kpc.addTypes',
      title: 'Add Types',
      arguments: [document.uri, range]
    };

    actions.push(addTypesAction);

    return actions;
  }

  private async createSourceActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Organize imports
    const organizeImportsAction = new vscode.CodeAction(
      'Organize imports',
      vscode.CodeActionKind.SourceOrganizeImports
    );

    organizeImportsAction.command = {
      command: 'kpc.organizeImports',
      title: 'Organize Imports',
      arguments: [document.uri]
    };

    actions.push(organizeImportsAction);

    // Fix all KPC issues
    const fixAllAction = new vscode.CodeAction(
      'Fix all KPC issues',
      vscode.CodeActionKind.SourceFixAll
    );

    fixAllAction.command = {
      command: 'kpc.fixAllIssues',
      title: 'Fix All Issues',
      arguments: [document.uri]
    };

    actions.push(fixAllAction);

    // Generate component documentation
    const generateDocsAction = new vscode.CodeAction(
      'Generate component documentation',
      vscode.CodeActionKind.Source
    );

    generateDocsAction.command = {
      command: 'kpc.generateDocs',
      title: 'Generate Documentation',
      arguments: [document.uri, range]
    };

    actions.push(generateDocsAction);

    return actions;
  }
}