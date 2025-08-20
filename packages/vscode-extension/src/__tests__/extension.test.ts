import * as assert from 'assert';
import * as vscode from 'vscode';
import { CompletionProvider } from '../providers/completionProvider';
import { HoverProvider } from '../providers/hoverProvider';
import { DiagnosticsProvider } from '../providers/diagnosticsProvider';
import { KPCApiClient } from '../services/apiClient';
import { ConfigurationManager } from '../services/configurationManager';

// Mock VS Code API
const mockVscode = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createStatusBarItem: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      text: '',
      tooltip: '',
      command: ''
    })),
    createWebviewPanel: jest.fn(),
    createTreeView: jest.fn(),
    activeTextEditor: undefined,
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() }, { isCancellationRequested: false }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      has: jest.fn(),
      inspect: jest.fn(),
      update: jest.fn()
    })),
    onDidChangeConfiguration: jest.fn(),
    onDidChangeTextDocument: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
    textDocuments: [],
    workspaceFolders: []
  },
  languages: {
    createDiagnosticCollection: jest.fn(() => ({
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn(),
      forEach: jest.fn()
    })),
    registerCompletionItemProvider: jest.fn(),
    registerHoverProvider: jest.fn(),
    registerCodeActionsProvider: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  CompletionItemKind: {
    Class: 6,
    Property: 9,
    Event: 4,
    Module: 8,
    EnumMember: 19,
    Value: 11
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  },
  CodeActionKind: {
    QuickFix: 'quickfix',
    RefactorExtract: 'refactor.extract',
    RefactorRewrite: 'refactor.rewrite',
    SourceOrganizeImports: 'source.organizeImports',
    SourceFixAll: 'source.fixAll',
    Source: 'source'
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  ThemeIcon: jest.fn(),
  MarkdownString: jest.fn(() => ({
    appendMarkdown: jest.fn(),
    appendCodeblock: jest.fn(),
    isTrusted: false,
    supportHtml: false
  })),
  Range: jest.fn(),
  Position: jest.fn(),
  Location: jest.fn(),
  Diagnostic: jest.fn(),
  DiagnosticRelatedInformation: jest.fn(),
  CodeAction: jest.fn(),
  WorkspaceEdit: jest.fn(),
  SnippetString: jest.fn(),
  CompletionItem: jest.fn(),
  Hover: jest.fn(),
  TreeItem: jest.fn()
};

// Mock the vscode module
jest.mock('vscode', () => mockVscode, { virtual: true });

describe('KPC VS Code Extension', () => {
  let configManager: ConfigurationManager;
  let apiClient: KPCApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigurationManager();
    apiClient = new KPCApiClient(configManager);
  });

  describe('CompletionProvider', () => {
    let completionProvider: CompletionProvider;

    beforeEach(() => {
      completionProvider = new CompletionProvider(apiClient, configManager);
    });

    it('should provide component completions', async () => {
      const mockDocument = {
        languageId: 'typescriptreact',
        lineAt: jest.fn(() => ({ text: '<But' })),
        getText: jest.fn(() => '<But'),
        fileName: 'test.tsx'
      } as any;

      const mockPosition = { line: 0, character: 4 } as any;
      const mockContext = { triggerKind: 1 } as any;
      const mockToken = {} as any;

      // Mock API response
      jest.spyOn(apiClient, 'searchComponents').mockResolvedValue([
        {
          name: 'Button',
          framework: 'react',
          description: 'A button component',
          props: [
            { name: 'variant', type: 'string', required: false, deprecated: false },
            { name: 'onClick', type: 'function', required: false, deprecated: false }
          ],
          events: [],
          import: { module: '@kpc/react', named: 'Button', default: false }
        }
      ] as any);

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThan(0);
      expect(apiClient.searchComponents).toHaveBeenCalled();
    });

    it('should provide prop completions', async () => {
      const mockDocument = {
        languageId: 'typescriptreact',
        lineAt: jest.fn(() => ({ text: '<Button var' })),
        getText: jest.fn(() => '<Button var'),
        fileName: 'test.tsx'
      } as any;

      const mockPosition = { line: 0, character: 11 } as any;

      // Mock API response
      jest.spyOn(apiClient, 'getComponent').mockResolvedValue({
        name: 'Button',
        framework: 'react',
        props: [
          { name: 'variant', type: 'string', required: false, deprecated: false, enum: ['primary', 'secondary'] },
          { name: 'size', type: 'string', required: false, deprecated: false }
        ]
      } as any);

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      expect(completions).toBeDefined();
      expect(apiClient.getComponent).toHaveBeenCalledWith('Button');
    });
  });

  describe('HoverProvider', () => {
    let hoverProvider: HoverProvider;

    beforeEach(() => {
      hoverProvider = new HoverProvider(apiClient, configManager);
    });

    it('should provide component hover information', async () => {
      const mockDocument = {
        languageId: 'typescriptreact',
        getWordRangeAtPosition: jest.fn(() => ({ start: { line: 0, character: 1 }, end: { line: 0, character: 7 } })),
        getText: jest.fn(() => 'Button'),
        lineAt: jest.fn(() => ({ text: '<Button variant="primary">' })),
        fileName: 'test.tsx'
      } as any;

      const mockPosition = { line: 0, character: 3 } as any;

      // Mock API response
      jest.spyOn(apiClient, 'getComponent').mockResolvedValue({
        name: 'Button',
        framework: 'react',
        description: 'A versatile button component',
        category: 'form',
        props: [
          { name: 'variant', type: 'string', required: false, deprecated: false },
          { name: 'onClick', type: 'function', required: false, deprecated: false }
        ],
        events: [
          { name: 'click', type: 'MouseEvent', deprecated: false }
        ],
        import: { module: '@kpc/react', named: 'Button', default: false }
      } as any);

      const hover = await hoverProvider.provideHover(mockDocument, mockPosition, {} as any);

      expect(hover).toBeDefined();
      expect(apiClient.getComponent).toHaveBeenCalledWith('Button', 'react');
    });

    it('should provide prop hover information', async () => {
      const mockDocument = {
        languageId: 'typescriptreact',
        getWordRangeAtPosition: jest.fn(() => ({ start: { line: 0, character: 8 }, end: { line: 0, character: 15 } })),
        getText: jest.fn(() => 'variant'),
        lineAt: jest.fn(() => ({ text: '<Button variant="primary">' })),
        fileName: 'test.tsx'
      } as any;

      const mockPosition = { line: 0, character: 12 } as any;

      // Mock API response
      jest.spyOn(apiClient, 'getComponent').mockResolvedValue({
        name: 'Button',
        framework: 'react',
        props: [
          { 
            name: 'variant', 
            type: 'string', 
            required: false, 
            deprecated: false,
            description: 'The visual style variant of the button',
            enum: ['primary', 'secondary', 'success', 'warning', 'danger'],
            default: 'primary'
          }
        ]
      } as any);

      const hover = await hoverProvider.provideHover(mockDocument, mockPosition, {} as any);

      expect(hover).toBeDefined();
      expect(apiClient.getComponent).toHaveBeenCalledWith('Button');
    });
  });

  describe('DiagnosticsProvider', () => {
    let diagnosticsProvider: DiagnosticsProvider;
    let mockDiagnosticsCollection: any;

    beforeEach(() => {
      mockDiagnosticsCollection = {
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn(),
        forEach: jest.fn()
      };

      diagnosticsProvider = new DiagnosticsProvider(apiClient, configManager, mockDiagnosticsCollection);
    });

    it('should validate document and create diagnostics', async () => {
      const mockDocument = {
        languageId: 'typescriptreact',
        getText: jest.fn(() => '<Button variant="invalid" />'),
        fileName: 'test.tsx',
        uri: { toString: () => 'file:///test.tsx' },
        version: 1
      } as any;

      // Mock API response
      jest.spyOn(apiClient, 'validateCode').mockResolvedValue({
        success: false,
        errors: [
          {
            line: 1,
            column: 17,
            severity: 'error' as const,
            message: 'Invalid prop value for variant',
            rule: 'invalid-prop-value',
            fixable: true
          }
        ],
        warnings: [
          {
            line: 1,
            column: 1,
            severity: 'warning' as const,
            message: 'Consider adding accessibility attributes',
            rule: 'accessibility-warning',
            fixable: false
          }
        ],
        suggestions: []
      });

      await diagnosticsProvider.validateDocument(mockDocument);

      expect(apiClient.validateCode).toHaveBeenCalledWith('<Button variant="invalid" />', 'test.tsx', 'react');
      expect(mockDiagnosticsCollection.set).toHaveBeenCalled();
    });

    it('should skip validation for unsupported file types', async () => {
      const mockDocument = {
        languageId: 'python',
        getText: jest.fn(),
        fileName: 'test.py',
        uri: { toString: () => 'file:///test.py' },
        version: 1
      } as any;

      jest.spyOn(configManager, 'isRealTimeValidationEnabled').mockReturnValue(true);

      await diagnosticsProvider.validateDocument(mockDocument);

      expect(apiClient.validateCode).not.toHaveBeenCalled();
    });

    it('should skip validation when disabled in configuration', async () => {
      const mockDocument = {
        languageId: 'typescriptreact',
        getText: jest.fn(),
        fileName: 'test.tsx',
        uri: { toString: () => 'file:///test.tsx' },
        version: 1
      } as any;

      jest.spyOn(configManager, 'isRealTimeValidationEnabled').mockReturnValue(false);

      await diagnosticsProvider.validateDocument(mockDocument);

      expect(apiClient.validateCode).not.toHaveBeenCalled();
    });
  });

  describe('ConfigurationManager', () => {
    it('should get configuration values', () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'apiEndpoint': return 'http://localhost:4000/graphql';
            case 'framework': return 'react';
            case 'typescript': return true;
            default: return undefined;
          }
        }),
        has: jest.fn(),
        inspect: jest.fn(),
        update: jest.fn()
      };

      (mockVscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const config = new ConfigurationManager();

      expect(config.getApiEndpoint()).toBe('http://localhost:4000/graphql');
      expect(config.getFramework()).toBe('react');
      expect(config.isTypeScriptEnabled()).toBe(true);
    });

    it('should validate configuration', () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'apiEndpoint': return 'invalid-url';
            case 'framework': return 'invalid-framework';
            default: return undefined;
          }
        }),
        has: jest.fn(),
        inspect: jest.fn(),
        update: jest.fn()
      };

      (mockVscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const config = new ConfigurationManager();
      const validation = config.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('KPCApiClient', () => {
    it('should search components', async () => {
      // Mock GraphQL client
      const mockRequest = jest.fn().mockResolvedValue({
        search: [
          {
            content: 'Button component',
            score: 0.95,
            metadata: {
              componentName: 'Button',
              framework: 'react',
              sourceRef: { filePath: '/components/Button.tsx' },
              type: 'component'
            }
          }
        ]
      });

      // Replace the client's request method
      (apiClient as any).client = { request: mockRequest };

      const results = await apiClient.searchComponents('button', { framework: 'react' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Button');
      expect(results[0].framework).toBe('react');
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should get component details', async () => {
      const mockRequest = jest.fn().mockResolvedValue({
        componentByName: {
          id: 'button-1',
          name: 'Button',
          frameworks: [
            {
              framework: 'react',
              props: [
                { name: 'variant', type: 'string', required: false, deprecated: false }
              ],
              events: [],
              slots: [],
              examples: []
            }
          ],
          props: [],
          events: [],
          slots: [],
          category: 'form',
          description: 'A button component'
        }
      });

      (apiClient as any).client = { request: mockRequest };

      const component = await apiClient.getComponent('Button', 'react');

      expect(component).toBeDefined();
      expect(component!.name).toBe('Button');
      expect(component!.framework).toBe('react');
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should validate code', async () => {
      const mockRequest = jest.fn().mockResolvedValue({
        validateCode: {
          success: false,
          errors: [
            {
              line: 1,
              column: 1,
              severity: 'error',
              message: 'Test error',
              rule: 'test-rule',
              fixable: true
            }
          ],
          warnings: [],
          suggestions: []
        }
      });

      (apiClient as any).client = { request: mockRequest };

      const result = await apiClient.validateCode('<Button />', 'test.tsx', 'react');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Test error');
      expect(mockRequest).toHaveBeenCalled();
    });
  });
});