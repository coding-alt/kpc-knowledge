import * as vscode from 'vscode';
import { CompletionProvider } from './providers/completionProvider';
import { HoverProvider } from './providers/hoverProvider';
import { DiagnosticsProvider } from './providers/diagnosticsProvider';
import { CodeActionProvider } from './providers/codeActionProvider';
import { ComponentTreeProvider } from './providers/componentTreeProvider';
import { KPCApiClient } from './services/apiClient';
import { ConfigurationManager } from './services/configurationManager';
import { TelemetryService } from './services/telemetryService';
import { 
  generateComponentCommand,
  validateCodeCommand,
  searchComponentsCommand,
  previewComponentCommand,
  fixIssuesCommand,
  showComponentInfoCommand,
  insertSnippetCommand
} from './commands';

let apiClient: KPCApiClient;
let configManager: ConfigurationManager;
let telemetryService: TelemetryService;
let diagnosticsCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  console.log('KPC Knowledge System extension is now active!');

  // Initialize services
  configManager = new ConfigurationManager();
  apiClient = new KPCApiClient(configManager);
  telemetryService = new TelemetryService(context);
  diagnosticsCollection = vscode.languages.createDiagnosticCollection('kpc');

  // Set context for when extension is enabled
  vscode.commands.executeCommand('setContext', 'kpc.enabled', true);

  // Register completion providers
  const completionProvider = new CompletionProvider(apiClient, configManager);
  const reactCompletionDisposable = vscode.languages.registerCompletionItemProvider(
    [
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'javascriptreact' }
    ],
    completionProvider,
    '<', '"', "'", ' ', '.'
  );

  const vueCompletionDisposable = vscode.languages.registerCompletionItemProvider(
    { scheme: 'file', language: 'vue' },
    completionProvider,
    '<', '"', "'", ' ', ':', '@'
  );

  // Register hover provider
  const hoverProvider = new HoverProvider(apiClient, configManager);
  const hoverDisposable = vscode.languages.registerHoverProvider(
    [
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'vue' }
    ],
    hoverProvider
  );

  // Register diagnostics provider
  const diagnosticsProvider = new DiagnosticsProvider(apiClient, configManager, diagnosticsCollection);
  
  // Register code action provider
  const codeActionProvider = new CodeActionProvider(apiClient, configManager);
  const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
    [
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'vue' }
    ],
    codeActionProvider
  );

  // Register tree view provider
  const componentTreeProvider = new ComponentTreeProvider(apiClient, configManager);
  const treeView = vscode.window.createTreeView('kpcComponents', {
    treeDataProvider: componentTreeProvider,
    showCollapseAll: true
  });

  // Register commands
  const commands = [
    vscode.commands.registerCommand('kpc.generateComponent', 
      (uri?: vscode.Uri) => generateComponentCommand(apiClient, configManager, uri)
    ),
    vscode.commands.registerCommand('kpc.validateCode', 
      (uri?: vscode.Uri) => validateCodeCommand(apiClient, configManager, diagnosticsCollection, uri)
    ),
    vscode.commands.registerCommand('kpc.searchComponents', 
      () => searchComponentsCommand(apiClient, configManager)
    ),
    vscode.commands.registerCommand('kpc.previewComponent', 
      (uri?: vscode.Uri) => previewComponentCommand(apiClient, configManager, uri)
    ),
    vscode.commands.registerCommand('kpc.fixIssues', 
      (uri?: vscode.Uri) => fixIssuesCommand(apiClient, configManager, uri)
    ),
    vscode.commands.registerCommand('kpc.showComponentInfo', 
      (uri?: vscode.Uri) => showComponentInfoCommand(apiClient, configManager, uri)
    ),
    vscode.commands.registerCommand('kpc.insertSnippet', 
      (snippet: string) => insertSnippetCommand(snippet)
    ),
    vscode.commands.registerCommand('kpc.refreshComponents', 
      () => componentTreeProvider.refresh()
    )
  ];

  // Register event listeners
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (configManager.get('realTimeValidation')) {
      diagnosticsProvider.validateDocument(event.document);
    }
  });

  const documentSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
    diagnosticsProvider.validateDocument(document);
    telemetryService.trackEvent('document.saved', {
      language: document.languageId,
      fileSize: document.getText().length
    });
  });

  const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('kpc')) {
      configManager.reload();
      apiClient.updateConfiguration();
      
      // Refresh providers
      componentTreeProvider.refresh();
      
      telemetryService.trackEvent('configuration.changed');
    }
  });

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(symbol-class) KPC';
  statusBarItem.tooltip = 'KPC Knowledge System - Click to search components';
  statusBarItem.command = 'kpc.searchComponents';
  statusBarItem.show();

  // Add all disposables to context
  context.subscriptions.push(
    reactCompletionDisposable,
    vueCompletionDisposable,
    hoverDisposable,
    codeActionDisposable,
    treeView,
    documentChangeListener,
    documentSaveListener,
    configChangeListener,
    statusBarItem,
    diagnosticsCollection,
    ...commands
  );

  // Initialize diagnostics for open documents
  vscode.workspace.textDocuments.forEach(document => {
    if (isKPCDocument(document)) {
      diagnosticsProvider.validateDocument(document);
    }
  });

  // Track activation
  telemetryService.trackEvent('extension.activated', {
    version: context.extension.packageJSON.version
  });

  // Show welcome message for first-time users
  const hasShownWelcome = context.globalState.get('kpc.hasShownWelcome', false);
  if (!hasShownWelcome) {
    showWelcomeMessage(context);
  }
}

export function deactivate() {
  if (telemetryService) {
    telemetryService.trackEvent('extension.deactivated');
    telemetryService.dispose();
  }
  
  if (diagnosticsCollection) {
    diagnosticsCollection.dispose();
  }
}

function isKPCDocument(document: vscode.TextDocument): boolean {
  const supportedLanguages = ['typescriptreact', 'javascriptreact', 'vue'];
  return supportedLanguages.includes(document.languageId);
}

async function showWelcomeMessage(context: vscode.ExtensionContext) {
  const action = await vscode.window.showInformationMessage(
    'Welcome to KPC Knowledge System! Get started with intelligent component generation and validation.',
    'Get Started',
    'Learn More',
    'Don\'t Show Again'
  );

  switch (action) {
    case 'Get Started':
      vscode.commands.executeCommand('kpc.generateComponent');
      break;
    case 'Learn More':
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/ksc-fe/kpc-knowledge-system'));
      break;
    case 'Don\'t Show Again':
      context.globalState.update('kpc.hasShownWelcome', true);
      break;
  }

  if (action !== 'Don\'t Show Again') {
    context.globalState.update('kpc.hasShownWelcome', true);
  }
}