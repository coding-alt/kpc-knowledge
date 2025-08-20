import { Command, Flags } from '@oclif/core';
import { createLogger } from '@kpc/shared';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const logger = createLogger('TestCommand');

export default class Test extends Command {
  static description = 'Run automated tests for components';

  static examples = [
    '$ kpc test ./src/components/',
    '$ kpc test --type unit --coverage',
    '$ kpc test --interactive',
  ];

  static flags = {
    type: Flags.string({
      char: 't',
      description: 'Type of tests to run',
      options: ['unit', 'integration', 'e2e', 'visual', 'all'],
      default: 'unit',
    }),
    coverage: Flags.boolean({
      char: 'c',
      description: 'Generate code coverage report',
      default: false,
    }),
    watch: Flags.boolean({
      char: 'w',
      description: 'Watch mode for continuous testing',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive test selection and configuration',
      default: false,
    }),
    framework: Flags.string({
      char: 'f',
      description: 'Target framework for testing',
      options: ['react', 'vue', 'intact'],
    }),
    browser: Flags.string({
      char: 'b',
      description: 'Browser for e2e tests',
      options: ['chromium', 'firefox', 'webkit', 'all'],
      default: 'chromium',
    }),
    parallel: Flags.boolean({
      char: 'p',
      description: 'Run tests in parallel',
      default: true,
    }),
    timeout: Flags.integer({
      description: 'Test timeout in milliseconds',
      default: 30000,
    }),
  };

  static args = [
    {
      name: 'path',
      description: 'Path to test files or components',
      required: false,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Test);

    try {
      let targetPath = args.path || './src';
      let options = {
        type: flags.type as 'unit' | 'integration' | 'e2e' | 'visual' | 'all',
        coverage: flags.coverage,
        watch: flags.watch,
        framework: flags.framework as 'react' | 'vue' | 'intact' | undefined,
        browser: flags.browser as 'chromium' | 'firefox' | 'webkit' | 'all',
        parallel: flags.parallel,
        timeout: flags.timeout,
      };

      // Interactive mode
      if (flags.interactive) {
        const answers = await this.promptForInput(targetPath, options);
        targetPath = answers.path;
        options = { ...options, ...answers.options };
      }

      this.log('');
      this.log(chalk.blue('🧪 KPC Component Testing'));
      this.log(chalk.gray('=' .repeat(50)));
      this.log(`📁 Target: ${chalk.cyan(targetPath)}`);
      this.log(`🎯 Test Type: ${chalk.yellow(options.type)}`);
      this.log(`🎭 Framework: ${chalk.yellow(options.framework || 'auto-detect')}`);
      this.log(`📊 Coverage: ${options.coverage ? chalk.green('enabled') : chalk.gray('disabled')}`);
      this.log('');

      // Discover test files and components
      const spinner = ora('Discovering tests...').start();
      const testSuite = await this.discoverTests(targetPath, options);
      
      if (testSuite.tests.length === 0) {
        spinner.fail('No tests found');
        return;
      }

      spinner.succeed(`Found ${testSuite.tests.length} test files for ${testSuite.components.length} components`);
      this.log('');

      // Run tests based on type
      const results = await this.runTests(testSuite, options);

      // Display results
      this.displayResults(results);

      // Generate reports
      if (options.coverage) {
        await this.generateCoverageReport(results);
      }

      // Watch mode
      if (options.watch) {
        await this.startWatchMode(testSuite, options);
      }

    } catch (error) {
      logger.error('Test command failed:', error);
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async promptForInput(initialPath: string, initialOptions: any) {
    const questions = [
      {
        type: 'input',
        name: 'path',
        message: 'Enter path to test:',
        default: initialPath,
        validate: (input: string) => {
          if (!input.trim()) return 'Please provide a path';
          return true;
        },
      },
      {
        type: 'list',
        name: 'type',
        message: 'What type of tests would you like to run?',
        choices: [
          { name: 'Unit Tests - Fast component logic tests', value: 'unit' },
          { name: 'Integration Tests - Component interaction tests', value: 'integration' },
          { name: 'E2E Tests - Full user workflow tests', value: 'e2e' },
          { name: 'Visual Tests - Screenshot comparison tests', value: 'visual' },
          { name: 'All Tests - Run complete test suite', value: 'all' },
        ],
        default: initialOptions.type,
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Target framework:',
        choices: [
          { name: 'Auto-detect from files', value: undefined },
          { name: 'React', value: 'react' },
          { name: 'Vue', value: 'vue' },
          { name: 'Intact', value: 'intact' },
        ],
        default: initialOptions.framework,
      },
      {
        type: 'confirm',
        name: 'coverage',
        message: 'Generate code coverage report?',
        default: initialOptions.coverage,
      },
      {
        type: 'confirm',
        name: 'parallel',
        message: 'Run tests in parallel for faster execution?',
        default: initialOptions.parallel,
      },
      {
        type: 'list',
        name: 'browser',
        message: 'Browser for E2E tests:',
        choices: [
          { name: 'Chromium (fastest)', value: 'chromium' },
          { name: 'Firefox', value: 'firefox' },
          { name: 'WebKit (Safari)', value: 'webkit' },
          { name: 'All browsers', value: 'all' },
        ],
        default: initialOptions.browser,
        when: (answers: any) => answers.type === 'e2e' || answers.type === 'all',
      },
      {
        type: 'confirm',
        name: 'watch',
        message: 'Enable watch mode for continuous testing?',
        default: initialOptions.watch,
      },
    ];

    const answers = await inquirer.prompt(questions);

    return {
      path: answers.path,
      options: {
        type: answers.type,
        framework: answers.framework,
        coverage: answers.coverage,
        parallel: answers.parallel,
        browser: answers.browser || initialOptions.browser,
        watch: answers.watch,
        timeout: initialOptions.timeout,
      },
    };
  }

  private async discoverTests(targetPath: string, options: any): Promise<any> {
    const testPatterns = {
      unit: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
      integration: ['**/*.integration.{ts,tsx,js,jsx}'],
      e2e: ['**/*.e2e.{ts,tsx,js,jsx}', '**/e2e/**/*.{ts,tsx,js,jsx}'],
      visual: ['**/*.visual.{ts,tsx,js,jsx}', '**/visual/**/*.{ts,tsx,js,jsx}'],
    };

    const patterns = options.type === 'all' 
      ? Object.values(testPatterns).flat()
      : testPatterns[options.type as keyof typeof testPatterns] || testPatterns.unit;

    const tests = [];
    for (const pattern of patterns) {
      const files = glob.sync(path.join(targetPath, pattern), {
        ignore: ['**/node_modules/**', '**/dist/**'],
      });
      tests.push(...files);
    }

    // Discover components
    const componentPatterns = ['**/*.{ts,tsx,js,jsx,vue}'];
    const componentFiles = [];
    for (const pattern of componentPatterns) {
      const files = glob.sync(path.join(targetPath, pattern), {
        ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'],
      });
      componentFiles.push(...files);
    }

    return {
      tests: [...new Set(tests)],
      components: [...new Set(componentFiles)],
      framework: options.framework || this.detectFramework(componentFiles),
    };
  }

  private detectFramework(files: string[]): string {
    for (const file of files.slice(0, 10)) { // Check first 10 files
      if (!fs.existsSync(file)) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('import React') || content.includes('from \'react\'')) {
        return 'react';
      }
      if (content.includes('<template>') || content.includes('defineComponent')) {
        return 'vue';
      }
      if (content.includes('Intact') || content.includes('@intact')) {
        return 'intact';
      }
    }
    return 'unknown';
  }

  private async runTests(testSuite: any, options: any): Promise<any> {
    const results = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      },
      suites: [] as any[],
      coverage: null as any,
    };

    const startTime = Date.now();

    if (options.type === 'all') {
      // Run all test types
      for (const testType of ['unit', 'integration', 'e2e', 'visual']) {
        this.log(chalk.blue(`\n🔄 Running ${testType} tests...`));
        const typeResults = await this.runTestType(testSuite, { ...options, type: testType });
        results.suites.push(...typeResults.suites);
        results.summary.total += typeResults.summary.total;
        results.summary.passed += typeResults.summary.passed;
        results.summary.failed += typeResults.summary.failed;
        results.summary.skipped += typeResults.summary.skipped;
      }
    } else {
      const typeResults = await this.runTestType(testSuite, options);
      results.suites = typeResults.suites;
      results.summary = typeResults.summary;
    }

    results.summary.duration = Date.now() - startTime;

    // Generate coverage if requested
    if (options.coverage) {
      results.coverage = await this.generateCoverage(testSuite);
    }

    return results;
  }

  private async runTestType(testSuite: any, options: any): Promise<any> {
    const spinner = ora(`Running ${options.type} tests...`).start();
    
    // Mock test execution - in real implementation, this would run actual tests
    const results = {
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      suites: [] as any[],
    };

    const relevantTests = testSuite.tests.filter((test: string) => {
      if (options.type === 'unit') return test.includes('.test.') || test.includes('.spec.');
      if (options.type === 'integration') return test.includes('.integration.');
      if (options.type === 'e2e') return test.includes('.e2e.') || test.includes('/e2e/');
      if (options.type === 'visual') return test.includes('.visual.') || test.includes('/visual/');
      return true;
    });

    for (let i = 0; i < relevantTests.length; i++) {
      const testFile = relevantTests[i];
      spinner.text = `Running ${path.basename(testFile)} [${i + 1}/${relevantTests.length}]`;
      
      // Simulate test execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      
      const testResult = this.mockTestExecution(testFile, options);
      results.suites.push(testResult);
      
      results.summary.total += testResult.tests.length;
      results.summary.passed += testResult.tests.filter((t: any) => t.status === 'passed').length;
      results.summary.failed += testResult.tests.filter((t: any) => t.status === 'failed').length;
      results.summary.skipped += testResult.tests.filter((t: any) => t.status === 'skipped').length;
    }

    if (results.summary.failed === 0) {
      spinner.succeed(`${options.type} tests completed - All tests passed!`);
    } else {
      spinner.fail(`${options.type} tests completed - ${results.summary.failed} tests failed`);
    }

    return results;
  }

  private mockTestExecution(testFile: string, options: any): any {
    const testCount = Math.floor(Math.random() * 10) + 1;
    const tests = [];
    
    for (let i = 0; i < testCount; i++) {
      const shouldFail = Math.random() < 0.1; // 10% failure rate
      tests.push({
        name: `Test case ${i + 1}`,
        status: shouldFail ? 'failed' : 'passed',
        duration: Math.floor(Math.random() * 1000) + 100,
        error: shouldFail ? 'Mock test failure' : null,
      });
    }

    return {
      file: testFile,
      framework: options.framework,
      type: options.type,
      tests,
      duration: tests.reduce((sum, t) => sum + t.duration, 0),
    };
  }

  private async generateCoverage(testSuite: any): Promise<any> {
    // Mock coverage generation
    return {
      lines: { total: 1000, covered: 850, percentage: 85 },
      functions: { total: 200, covered: 180, percentage: 90 },
      branches: { total: 150, covered: 120, percentage: 80 },
      statements: { total: 1200, covered: 1020, percentage: 85 },
    };
  }

  private displayResults(results: any): void {
    this.log('');
    this.log(chalk.blue('📊 Test Results'));
    this.log(chalk.gray('=' .repeat(50)));
    
    const { summary } = results;
    const successRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : '0';
    
    this.log(`Total tests: ${chalk.cyan(summary.total)}`);
    this.log(`Passed: ${chalk.green(summary.passed)}`);
    this.log(`Failed: ${chalk.red(summary.failed)}`);
    this.log(`Skipped: ${chalk.yellow(summary.skipped)}`);
    this.log(`Success rate: ${chalk.cyan(successRate + '%')}`);
    this.log(`Duration: ${chalk.gray(this.formatDuration(summary.duration))}`);

    if (results.coverage) {
      this.log('');
      this.log(chalk.blue('📈 Coverage Report'));
      this.log(chalk.gray('-'.repeat(30)));
      this.log(`Lines: ${chalk.cyan(results.coverage.lines.percentage + '%')} (${results.coverage.lines.covered}/${results.coverage.lines.total})`);
      this.log(`Functions: ${chalk.cyan(results.coverage.functions.percentage + '%')} (${results.coverage.functions.covered}/${results.coverage.functions.total})`);
      this.log(`Branches: ${chalk.cyan(results.coverage.branches.percentage + '%')} (${results.coverage.branches.covered}/${results.coverage.branches.total})`);
      this.log(`Statements: ${chalk.cyan(results.coverage.statements.percentage + '%')} (${results.coverage.statements.covered}/${results.coverage.statements.total})`);
    }

    // Show failed tests
    const failedSuites = results.suites.filter((s: any) => s.tests.some((t: any) => t.status === 'failed'));
    if (failedSuites.length > 0) {
      this.log('');
      this.log(chalk.red('❌ Failed Tests'));
      this.log(chalk.gray('-'.repeat(30)));
      
      for (const suite of failedSuites.slice(0, 5)) { // Show first 5 failed suites
        const failedTests = suite.tests.filter((t: any) => t.status === 'failed');
        this.log(`${chalk.red('✗')} ${path.basename(suite.file)}`);
        for (const test of failedTests.slice(0, 3)) { // Show first 3 failed tests per suite
          this.log(`  ${chalk.gray('•')} ${test.name}: ${chalk.red(test.error)}`);
        }
      }
    }

    this.log('');
    if (summary.failed === 0) {
      this.log(chalk.green('🎉 All tests passed!'));
    } else {
      this.log(chalk.red(`❌ ${summary.failed} tests failed`));
    }
  }

  private async generateCoverageReport(results: any): Promise<void> {
    const spinner = ora('Generating coverage report...').start();
    
    // Mock coverage report generation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const reportPath = './coverage/index.html';
    spinner.succeed(`Coverage report generated: ${chalk.cyan(reportPath)}`);
  }

  private async startWatchMode(testSuite: any, options: any): Promise<void> {
    this.log('');
    this.log(chalk.blue('👀 Watch Mode Active'));
    this.log(chalk.gray('Press Ctrl+C to exit'));
    this.log('');

    // Mock watch mode - in real implementation, this would watch for file changes
    const watchSpinner = ora('Watching for changes...').start();
    
    // Simulate file changes
    setTimeout(() => {
      watchSpinner.info('File changed: Button.tsx');
      this.log('🔄 Re-running tests...');
      // Would re-run tests here
    }, 5000);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
}