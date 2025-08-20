import { Command } from '@oclif/core';
import Generate from '../commands/generate';
import Validate from '../commands/validate';
import Test from '../commands/test';
import Search from '../commands/search';
import Init from '../commands/init';
import Preview from '../commands/preview';
import * as fs from 'fs';
import * as path from 'path';

// Mock inquirer to simulate user input
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

// Mock ora spinner
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    text: '',
  }));
});

// Mock fs operations
jest.mock('fs');
jest.mock('glob');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockInquirer = require('inquirer');

describe('CLI Interactive Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('mock file content');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => '');
    mockFs.statSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1000,
    } as any);
  });

  describe('Generate Command Interactive Mode', () => {
    it('should prompt for requirement when not provided', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        requirement: 'Create a button component',
        framework: 'react',
        output: './src/components',
        typescript: true,
        tests: false,
        stories: false,
        preview: false,
      });

      const command = new Generate([], {} as any);
      
      // Mock the generate service methods
      const mockGenerateService = {
        parseRequirement: jest.fn().mockResolvedValue({
          components: ['Button'],
          confidence: 0.95,
        }),
        generateUAST: jest.fn().mockResolvedValue({
          metadata: { confidence: 0.9 },
        }),
        generateCode: jest.fn().mockResolvedValue({
          component: 'const Button = () => <button>Click me</button>;',
          metadata: { componentName: 'Button' },
        }),
        validateCode: jest.fn().mockResolvedValue({
          success: true,
          errors: [],
        }),
        writeFiles: jest.fn().mockResolvedValue(['Button.tsx']),
      };

      // Mock the service import
      jest.doMock('../services/generate.service', () => ({
        GenerateService: jest.fn(() => mockGenerateService),
      }));

      await expect(command.run()).resolves.not.toThrow();
      expect(mockInquirer.prompt).toHaveBeenCalled();
    });

    it('should handle interactive framework selection', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        requirement: 'Create a modal',
        framework: 'vue',
        output: './src/components',
        typescript: false,
        tests: true,
        stories: true,
        preview: true,
      });

      const command = new Generate(['--interactive'], {} as any);
      
      // Test that Vue framework is properly handled
      expect(mockInquirer.prompt).not.toHaveBeenCalled(); // Will be called during run
    });
  });

  describe('Validate Command Interactive Mode', () => {
    it('should prompt for path when not provided', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        path: './src/components',
        recursive: true,
        framework: 'react',
        severity: 'warning',
        fix: false,
        output: 'console',
      });

      const command = new Validate(['--interactive'], {} as any);
      
      // Mock glob to return some files
      const mockGlob = require('glob');
      mockGlob.sync = jest.fn().mockReturnValue([
        './src/components/Button.tsx',
        './src/components/Modal.tsx',
      ]);

      await expect(command.run()).resolves.not.toThrow();
    });

    it('should handle interactive fix mode', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({
          path: './src/components/Button.tsx',
          recursive: false,
          framework: 'react',
          severity: 'error',
          fix: false,
          output: 'console',
        })
        .mockResolvedValueOnce({
          fix: true,
        })
        .mockResolvedValueOnce({
          files: ['./src/components/Button.tsx'],
        });

      const command = new Validate(['--interactive'], {} as any);
      
      const mockGlob = require('glob');
      mockGlob.sync = jest.fn().mockReturnValue(['./src/components/Button.tsx']);

      await expect(command.run()).resolves.not.toThrow();
    });
  });

  describe('Test Command Interactive Mode', () => {
    it('should prompt for test configuration', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        path: './src',
        type: 'unit',
        framework: 'react',
        coverage: true,
        parallel: true,
        browser: 'chromium',
        watch: false,
      });

      const command = new Test(['--interactive'], {} as any);
      
      const mockGlob = require('glob');
      mockGlob.sync = jest.fn().mockReturnValue([
        './src/components/Button.test.tsx',
        './src/components/Modal.test.tsx',
      ]);

      await expect(command.run()).resolves.not.toThrow();
    });

    it('should handle different test types', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        path: './src',
        type: 'e2e',
        framework: 'vue',
        coverage: false,
        parallel: false,
        browser: 'firefox',
        watch: true,
      });

      const command = new Test(['--interactive'], {} as any);
      
      const mockGlob = require('glob');
      mockGlob.sync = jest.fn().mockReturnValue([
        './src/e2e/login.e2e.ts',
      ]);

      await expect(command.run()).resolves.not.toThrow();
    });
  });

  describe('Search Command Interactive Mode', () => {
    it('should prompt for search parameters', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        query: 'button component',
        type: 'components',
        framework: 'react',
        category: 'form',
        limit: 10,
        output: 'table',
        similarity: 0.7,
      });

      const command = new Search(['--interactive'], {} as any);
      
      await expect(command.run()).resolves.not.toThrow();
    });

    it('should handle result exploration', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({
          query: 'modal',
          type: 'all',
          framework: undefined,
          category: '',
          limit: 5,
          output: 'detailed',
          similarity: 0.8,
        })
        .mockResolvedValueOnce({
          selection: 0,
        })
        .mockResolvedValueOnce({
          action: 'details',
        })
        .mockResolvedValueOnce({
          continue: false,
        });

      const command = new Search(['--interactive'], {} as any);
      
      await expect(command.run()).resolves.not.toThrow();
    });
  });

  describe('Init Command Interactive Mode', () => {
    it('should prompt for project configuration', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        framework: 'react',
        typescript: true,
        testing: true,
        storybook: false,
        eslint: true,
        componentsDir: './src/components',
        outputDir: './src/generated',
        features: ['autoImports', 'docs'],
      });

      mockFs.existsSync.mockReturnValue(false); // No existing config

      const command = new Init(['--interactive'], {} as any);
      
      await expect(command.run()).resolves.not.toThrow();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle existing configuration', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({
          overwrite: true,
        })
        .mockResolvedValueOnce({
          framework: 'vue',
          typescript: false,
          testing: false,
          storybook: true,
          eslint: false,
          componentsDir: './components',
          outputDir: './generated',
          features: [],
        })
        .mockResolvedValueOnce({
          install: false,
        });

      mockFs.existsSync.mockReturnValue(true); // Existing config

      const command = new Init(['--force'], {} as any);
      
      await expect(command.run()).resolves.not.toThrow();
    });
  });

  describe('Preview Command Interactive Mode', () => {
    it('should prompt for component selection', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        component: './src/components/Button.tsx',
        framework: 'react',
        port: 3000,
        theme: 'light',
        hotReload: true,
        responsive: true,
        open: false,
      });

      const command = new Preview(['--interactive'], {} as any);
      
      // Mock HTTP server
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        close: jest.fn(),
        on: jest.fn(),
      };
      
      jest.doMock('http', () => ({
        createServer: jest.fn(() => mockServer),
      }));

      await expect(command.run()).resolves.not.toThrow();
    });

    it('should handle interactive debugging mode', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({
          component: './src/components/Modal.tsx',
          framework: 'vue',
          port: 3001,
          theme: 'dark',
          hotReload: false,
          responsive: false,
          open: true,
        })
        .mockResolvedValueOnce({
          action: 'inspect',
        })
        .mockResolvedValueOnce({
          action: 'stop',
        });

      const command = new Preview(['--interactive'], {} as any);
      
      const mockServer = {
        listen: jest.fn((port, host, callback) => callback()),
        close: jest.fn(),
        on: jest.fn(),
      };
      
      jest.doMock('http', () => ({
        createServer: jest.fn(() => mockServer),
      }));

      await expect(command.run()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const command = new Validate(['./nonexistent'], {} as any);
      
      await expect(command.run()).rejects.toThrow();
    });

    it('should handle network errors in search', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        query: 'button',
        type: 'all',
        framework: 'react',
        category: '',
        limit: 10,
        output: 'table',
        similarity: 0.7,
      });

      const command = new Search(['--interactive'], {} as any);
      
      // Mock network error
      jest.spyOn(command as any, 'performSearch').mockRejectedValue(new Error('Network error'));
      
      await expect(command.run()).rejects.toThrow('Network error');
    });

    it('should handle invalid configuration', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        framework: 'invalid-framework',
        typescript: 'not-boolean',
        testing: true,
        storybook: false,
        eslint: true,
      });

      const command = new Init(['--interactive'], {} as any);
      
      // Should handle invalid input gracefully
      await expect(command.run()).resolves.not.toThrow();
    });
  });

  describe('Progress and Feedback', () => {
    it('should show progress during long operations', async () => {
      const mockOra = require('ora');
      const mockSpinner = mockOra();

      mockInquirer.prompt.mockResolvedValueOnce({
        requirement: 'Complex component with many features',
        framework: 'react',
        output: './src/components',
        typescript: true,
        tests: true,
        stories: true,
        preview: false,
      });

      const command = new Generate(['--interactive'], {} as any);
      
      await expect(command.run()).resolves.not.toThrow();
      expect(mockSpinner.start).toHaveBeenCalled();
    });

    it('should provide helpful error messages', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        path: './nonexistent',
        recursive: false,
        framework: 'react',
        severity: 'error',
        fix: false,
        output: 'console',
      });

      mockFs.existsSync.mockReturnValue(false);

      const command = new Validate(['--interactive'], {} as any);
      
      await expect(command.run()).rejects.toThrow();
    });
  });
});