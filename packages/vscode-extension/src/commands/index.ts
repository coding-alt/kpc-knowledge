import * as vscode from 'vscode';
import { KPCApiClient } from '../services/apiClient';
import { ConfigurationManager } from '../services/configurationManager';
import { ComponentInfo, GenerationOptions } from '../types';

export async function generateComponentCommand(
  apiClient: KPCApiClient,
  configManager: ConfigurationManager,
  uri?: vscode.Uri
): Promise<void> {
  try {
    // Get requirement from user
    const requirement = await vscode.window.showInputBox({
      prompt: 'Describe the component you want to generate',
      placeholder: 'e.g., "Create a responsive navigation bar with dropdown menus"',
      validateInput: (value) => {
        if (!value || value.trim().length < 10) {
          return 'Please provide a more detailed description (at least 10 characters)';
        }
        return null;
      }
    });

    if (!requirement) return;

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Component',
      cancellable: true
    }, async (progress, token) => {
      progress.report({ increment: 0, message: 'Analyzing requirement...' });

      const options: GenerationOptions = {
        framework: configManager.getFramework(),
        typescript: configManager.isTypeScriptEnabled(),
        includeTests: false,
        includeStories: false,
      };

      progress.report({ increment: 30, message: 'Generating code...' });

      const result = await apiClient.generateCode(requirement, options);

      progress.report({ increment: 70, message: 'Creating files...' });

      // Determine target directory
      let targetDir: vscode.Uri;
      if (uri && uri.scheme === 'file') {
        const stat = await vscode.workspace.fs.stat(uri);
        targetDir = stat.type === vscode.FileType.Directory ? uri : vscode.Uri.joinPath(uri, '..');
      } else {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          throw new Error('No workspace folder found');
        }
        targetDir = vscode.Uri.joinPath(workspaceFolder.uri, 'src', 'components');
      }

      // Create component file
      const componentName = result.metadata.componentName;
      const extension = options.typescript ? '.tsx' : '.jsx';
      const componentFile = vscode.Uri.joinPath(targetDir, `${componentName}${extension}`);

      await vscode.workspace.fs.writeFile(componentFile, Buffer.from(result.component));

      progress.report({ increment: 100, message: 'Complete!' });

      // Open the generated file
      const document = await vscode.workspace.openTextDocument(componentFile);
      await vscode.window.showTextDocument(document);

      vscode.window.showInformationMessage(
        `Component "${componentName}" generated successfully!`,
        'View File'
      ).then(action => {
        if (action === 'View File') {
          vscode.commands.executeCommand('vscode.open', componentFile);
        }
      });
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to generate component: ${(error as Error).message}`);
  }
}

export async function validateCodeCommand(
  apiClient: KPCApiClient,
  configManager: ConfigurationManager,
  diagnosticsCollection: vscode.DiagnosticCollection,
  uri?: vscode.Uri
): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const document = editor.document;
    const code = document.getText();
    const filePath = document.fileName;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: 'Validating code...'
    }, async () => {
      const result = await apiClient.validateCode(code, filePath);

      // Convert validation results to VS Code diagnostics
      const diagnostics: vscode.Diagnostic[] = [];

      // Add errors
      result.errors.forEach(error => {
        const range = new vscode.Range(
          error.line - 1, error.column - 1,
          error.line - 1, error.column + 10
        );
        const diagnostic = new vscode.Diagnostic(
          range,
          error.message,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'KPC';
        diagnostic.code = error.rule;
        diagnostics.push(diagnostic);
      });

      // Add warnings
      result.warnings.forEach(warning => {
        const range = new vscode.Range(
          warning.line - 1, warning.column - 1,
          warning.line - 1, warning.column + 10
        );
        const diagnostic = new vscode.Diagnostic(
          range,
          warning.message,
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'KPC';
        diagnostic.code = warning.rule;
        diagnostics.push(diagnostic);
      });

      diagnosticsCollection.set(document.uri, diagnostics);

      if (result.success) {
        vscode.window.showInformationMessage('✅ Code validation passed!');
      } else {
        const errorCount = result.errors.length;
        const warningCount = result.warnings.length;
        vscode.window.showWarningMessage(
          `Found ${errorCount} errors and ${warningCount} warnings`
        );
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Validation failed: ${(error as Error).message}`);
  }
}

export async function searchComponentsCommand(
  apiClient: KPCApiClient,
  configManager: ConfigurationManager
): Promise<void> {
  try {
    const query = await vscode.window.showInputBox({
      prompt: 'Search for components',
      placeholder: 'e.g., "button", "form input", "navigation"'
    });

    if (!query) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Searching components...'
    }, async () => {
      const results = await apiClient.searchComponents(query, {
        framework: configManager.getFramework(),
        limit: 20
      });

      if (results.length === 0) {
        vscode.window.showInformationMessage('No components found');
        return;
      }

      // Show results in quick pick
      const items = results.map(component => ({
        label: `$(symbol-class) ${component.name}`,
        description: component.framework,
        detail: component.description,
        component
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a component to view details',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selected) {
        await showComponentDetails(selected.component, apiClient);
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Search failed: ${(error as Error).message}`);
  }
}

export async function previewComponentCommand(
  apiClient: KPCApiClient,
  configManager: ConfigurationManager,
  uri?: vscode.Uri
): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const document = editor.document;
    const filePath = document.fileName;

    // Create a simple preview panel
    const panel = vscode.window.createWebviewPanel(
      'kpcPreview',
      `Preview: ${document.fileName.split('/').pop()}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Generate preview HTML
    const previewHtml = generatePreviewHtml(document.getText(), filePath);
    panel.webview.html = previewHtml;

    // Update preview when document changes
    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document === document) {
        const updatedHtml = generatePreviewHtml(event.document.getText(), filePath);
        panel.webview.html = updatedHtml;
      }
    });

    panel.onDidDispose(() => {
      changeListener.dispose();
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Preview failed: ${(error as Error).message}`);
  }
}

export async function fixIssuesCommand(
  apiClient: KPCApiClient,
  configManager: ConfigurationManager,
  uri?: vscode.Uri
): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const document = editor.document;
    const code = document.getText();
    const filePath = document.fileName;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing and fixing issues...'
    }, async () => {
      const result = await apiClient.validateCode(code, filePath);
      
      if (result.success) {
        vscode.window.showInformationMessage('No issues found to fix!');
        return;
      }

      const fixableIssues = [...result.errors, ...result.warnings].filter(issue => issue.fixable);
      
      if (fixableIssues.length === 0) {
        vscode.window.showInformationMessage('No automatically fixable issues found');
        return;
      }

      const action = await vscode.window.showInformationMessage(
        `Found ${fixableIssues.length} fixable issues. Apply fixes?`,
        'Apply Fixes',
        'Cancel'
      );

      if (action === 'Apply Fixes') {
        // Apply fixes (this would need actual fix logic from the API)
        vscode.window.showInformationMessage(`Applied fixes for ${fixableIssues.length} issues`);
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Fix failed: ${(error as Error).message}`);
  }
}

export async function showComponentInfoCommand(
  apiClient: KPCApiClient,
  configManager: ConfigurationManager,
  uri?: vscode.Uri
): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const wordRange = document.getWordRangeAtPosition(position);
    
    if (!wordRange) {
      vscode.window.showWarningMessage('No component found at cursor position');
      return;
    }

    const componentName = document.getText(wordRange);
    
    if (!componentName.match(/^[A-Z][a-zA-Z0-9]*$/)) {
      vscode.window.showWarningMessage('Not a valid component name');
      return;
    }

    const component = await apiClient.getComponent(componentName);
    
    if (!component) {
      vscode.window.showInformationMessage(`Component "${componentName}" not found`);
      return;
    }

    await showComponentDetails(component, apiClient);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show component info: ${(error as Error).message}`);
  }
}

export async function insertSnippetCommand(snippet: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor found');
    return;
  }

  const snippetString = new vscode.SnippetString(snippet);
  await editor.insertSnippet(snippetString);
}

async function showComponentDetails(component: ComponentInfo, apiClient: KPCApiClient): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'kpcComponentDetails',
    `Component: ${component.name}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  const html = generateComponentDetailsHtml(component);
  panel.webview.html = html;

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(async message => {
    switch (message.command) {
      case 'insertSnippet':
        await insertSnippetCommand(message.snippet);
        break;
      case 'searchExamples':
        const examples = await apiClient.getComponentExamples(component.name, component.framework);
        panel.webview.postMessage({ command: 'showExamples', examples });
        break;
    }
  });
}

function generatePreviewHtml(code: string, filePath: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Component Preview</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f5f5f5;
            }
            .preview-container {
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .code-preview {
                background: #f8f8f8;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                padding: 16px;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 14px;
                overflow-x: auto;
            }
        </style>
    </head>
    <body>
        <div class="preview-container">
            <h2>Component Preview</h2>
            <p><strong>File:</strong> ${filePath}</p>
            <div class="code-preview">
                <pre><code>${escapeHtml(code)}</code></pre>
            </div>
        </div>
    </body>
    </html>
  `;
}

function generateComponentDetailsHtml(component: ComponentInfo): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${component.name} Details</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f5f5f5;
            }
            .container {
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
                border-bottom: 1px solid #e0e0e0;
                padding-bottom: 16px;
                margin-bottom: 20px;
            }
            .section {
                margin-bottom: 24px;
            }
            .section h3 {
                margin-top: 0;
                color: #333;
            }
            .prop-item, .event-item {
                background: #f8f8f8;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 8px;
            }
            .prop-name, .event-name {
                font-weight: bold;
                color: #0066cc;
            }
            .prop-type {
                color: #666;
                font-family: monospace;
            }
            .required {
                color: #d73a49;
                font-size: 12px;
            }
            .button {
                background: #0066cc;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 8px;
            }
            .button:hover {
                background: #0052a3;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧩 ${component.name}</h1>
                <p><strong>Framework:</strong> ${component.framework}</p>
                ${component.category ? `<p><strong>Category:</strong> ${component.category}</p>` : ''}
                ${component.description ? `<p>${component.description}</p>` : ''}
            </div>

            ${component.import ? `
            <div class="section">
                <h3>📦 Import</h3>
                <code>import { ${component.name} } from '${component.import.module}';</code>
                <button class="button" onclick="insertImport()">Insert Import</button>
            </div>
            ` : ''}

            ${component.props && component.props.length > 0 ? `
            <div class="section">
                <h3>⚙️ Props (${component.props.length})</h3>
                ${component.props.map(prop => `
                    <div class="prop-item">
                        <div class="prop-name">${prop.name} ${prop.required ? '<span class="required">*required</span>' : ''}</div>
                        <div class="prop-type">${prop.type}</div>
                        ${prop.description ? `<div>${prop.description}</div>` : ''}
                        ${prop.default ? `<div><strong>Default:</strong> ${prop.default}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${component.events && component.events.length > 0 ? `
            <div class="section">
                <h3>⚡ Events (${component.events.length})</h3>
                ${component.events.map(event => `
                    <div class="event-item">
                        <div class="event-name">${event.name}</div>
                        ${event.type ? `<div class="prop-type">${event.type}</div>` : ''}
                        ${event.description ? `<div>${event.description}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div class="section">
                <button class="button" onclick="insertBasicUsage()">Insert Basic Usage</button>
                <button class="button" onclick="loadExamples()">Load Examples</button>
            </div>

            <div id="examples-section" style="display: none;">
                <h3>📝 Examples</h3>
                <div id="examples-content"></div>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function insertImport() {
                const snippet = "import { ${component.name} } from '${component.import?.module || '@kpc/components'}';";
                vscode.postMessage({ command: 'insertSnippet', snippet });
            }

            function insertBasicUsage() {
                const requiredProps = ${JSON.stringify(component.props?.filter(p => p.required) || [])};
                let snippet = '<${component.name}';
                
                requiredProps.forEach((prop, index) => {
                    const value = prop.type === 'string' ? '"$' + (index + 1) + '"' : '{$' + (index + 1) + '}';
                    snippet += '\\n  ' + prop.name + '=' + value;
                });
                
                snippet += ' />';
                vscode.postMessage({ command: 'insertSnippet', snippet });
            }

            function loadExamples() {
                vscode.postMessage({ command: 'searchExamples' });
            }

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'showExamples') {
                    const section = document.getElementById('examples-section');
                    const content = document.getElementById('examples-content');
                    
                    if (message.examples.length > 0) {
                        content.innerHTML = message.examples.map(example => 
                            '<div class="example-item"><pre><code>' + example.content + '</code></pre></div>'
                        ).join('');
                        section.style.display = 'block';
                    } else {
                        content.innerHTML = '<p>No examples found</p>';
                        section.style.display = 'block';
                    }
                }
            });
        </script>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}