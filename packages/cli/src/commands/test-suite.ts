import { Command, Flags } from '@oclif/core';
import { TestSuiteRunner, TestSuiteConfig } from '@kpc/shared/testing/test-suite-runner';
import { TestReporter } from '@kpc/shared/testing/test-reporter';
import chalk from 'chalk';
import { existsSync } from 'fs';

export default class TestSuite extends Command {
  static description = 'Run comprehensive test suite for KPC Knowledge System';

  static examples = [
    '<%= config.bin %> <%= command.id %> --all',
    '<%= config.bin %> <%= command.id %> --accuracy --compilation',
    '<%= config.bin %> <%= command.id %> --config ./test-config.json',
    '<%= config.bin %> <%= command.id %> --performance --sample-size 20',
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    config: Flags.string({
      char: 'c',
      description: 'Path to test configuration file',
    }),
    dataset: Flags.string({
      char: 'd',
      description: 'Path to golden dataset directory',
      default: './golden-dataset',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output directory for test reports',
      default: './test-reports',
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Run all test types',
      default: false,
    }),
    accuracy: Flags.boolean({
      description: 'Run accuracy tests',
      default: false,
    }),
    compilation: Flags.boolean({
      description: 'Run compilation tests',
      default: false,
    }),
    visual: Flags.boolean({
      description: 'Run visual regression tests',
      default: false,
    }),
    performance: Flags.boolean({
      description: 'Run performance tests',
      default: false,
    }),
    'sample-size': Flags.integer({
      char: 's',
      description: 'Number of dataset entries to test per test type',
      default: 50,
    }),
    format: Flags.string({
      char: 'f',
      description: 'Report format(s)',
      options: ['json', 'html', 'junit'],
      multiple: true,
      default: ['html', 'json'],
    }),
    'accuracy-threshold': Flags.string({
      description: 'Accuracy thresholds (format: uast:0.98,code:0.95,component:0.98)',
      default: 'uast:0.98,code:0.95,component:0.98',
    }),
    'compilation-threshold': Flags.string({
      description: 'Compilation pass rate threshold',
      default: '0.99',
    }),
    'visual-threshold': Flags.string({
      description: 'Visual stability rate threshold',
      default: '0.95',
    }),
    'performance-thresholds': Flags.string({
      description: 'Performance thresholds (format: generation:5000,validation:1000,render:100)',
      default: 'generation:5000,validation:1000,render:100',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Verbose output',
      default: false,
    }),
    'fail-fast': Flags.boolean({
      description: 'Stop on first test failure',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TestSuite);

    try {
      // Load or create configuration
      const config = flags.config ? this.loadConfig(flags.config) : this.createConfig(flags);

      // Validate dataset exists
      if (!existsSync(config.datasetPath)) {
        this.error(`Dataset directory not found: ${config.datasetPath}`);
      }

      // Create test runner
      const runner = new TestSuiteRunner(config);
      const reporter = new TestReporter(config);

      // Set up event listeners
      this.setupEventListeners(runner, flags.verbose);

      this.log(chalk.blue('🚀 Starting KPC Knowledge System Test Suite\n'));

      // Run test suite
      const result = await runner.runTestSuite();

      // Generate reports
      this.log(chalk.blue('\n📊 Generating test reports...'));
      const reportPaths = await reporter.generateReports(result);

      // Display results
      this.displayResults(result);

      // Display report paths
      this.log(chalk.blue('\n📄 Reports generated:'));
      for (const path of reportPaths) {
        this.log(chalk.gray(`  ${path}`));
      }

      // Exit with appropriate code
      if (result.summary.overallPassRate < 1.0) {
        this.log(chalk.red('\n❌ Some tests failed'));
        process.exit(1);
      } else {
        this.log(chalk.green('\n✅ All tests passed'));
        process.exit(0);
      }

    } catch (error) {
      this.error(`Test suite execution failed: ${error.message}`);
    }
  }

  private loadConfig(configPath: string): TestSuiteConfig {
    if (!existsSync(configPath)) {
      this.error(`Configuration file not found: ${configPath}`);
    }

    try {
      return require(configPath);
    } catch (error) {
      this.error(`Failed to load configuration: ${error.message}`);
    }
  }

  private createConfig(flags: any): TestSuiteConfig {
    const accuracyThresholds = this.parseThresholds(flags['accuracy-threshold'], {
      uast: 0.98,
      code: 0.95,
      component: 0.98,
    });

    const performanceThresholds = this.parseThresholds(flags['performance-thresholds'], {
      generation: 5000,
      validation: 1000,
      render: 100,
    });

    return {
      datasetPath: flags.dataset,
      tests: {
        accuracy: {
          enabled: flags.all || flags.accuracy,
          sampleSize: flags['sample-size'],
          thresholds: {
            uastAccuracy: accuracyThresholds.uast,
            codeAccuracy: accuracyThresholds.code,
            componentInfoAccuracy: accuracyThresholds.component,
          },
        },
        compilation: {
          enabled: flags.all || flags.compilation,
          sampleSize: flags['sample-size'],
          thresholds: {
            passRate: parseFloat(flags['compilation-threshold']),
          },
        },
        visual: {
          enabled: flags.all || flags.visual,
          sampleSize: flags['sample-size'],
          thresholds: {
            stabilityRate: parseFloat(flags['visual-threshold']),
          },
        },
        performance: {
          enabled: flags.all || flags.performance,
          sampleSize: flags['sample-size'],
          thresholds: {
            maxGenerationTime: performanceThresholds.generation,
            maxValidationTime: performanceThresholds.validation,
            maxRenderTime: performanceThresholds.render,
          },
        },
      },
      reporting: {
        outputPath: flags.output,
        formats: flags.format,
      },
    };
  }

  private parseThresholds(thresholdString: string, defaults: Record<string, number>): Record<string, number> {
    const thresholds = { ...defaults };
    
    if (thresholdString) {
      const pairs = thresholdString.split(',');
      for (const pair of pairs) {
        const [key, value] = pair.split(':');
        if (key && value) {
          thresholds[key] = parseFloat(value);
        }
      }
    }

    return thresholds;
  }

  private setupEventListeners(runner: TestSuiteRunner, verbose: boolean): void {
    runner.on('suite:start', (data) => {
      this.log(chalk.blue(`Test suite started at ${data.timestamp.toLocaleTimeString()}`));
    });

    runner.on('test:start', (data) => {
      if (verbose) {
        this.log(chalk.yellow(`Starting ${data.type} tests...`));
      } else {
        process.stdout.write(chalk.yellow(`Running ${data.type} tests... `));
      }
    });

    runner.on('test:complete', (data) => {
      const status = data.result.passed ? '✅' : '❌';
      const statusText = data.result.passed ? 'PASSED' : 'FAILED';
      
      if (verbose) {
        this.log(chalk[data.result.passed ? 'green' : 'red'](`${status} ${data.type} tests ${statusText}`));
        if (data.result.errors && data.result.errors.length > 0) {
          for (const error of data.result.errors) {
            this.log(chalk.red(`  Error: ${error}`));
          }
        }
      } else {
        console.log(chalk[data.result.passed ? 'green' : 'red'](`${status} ${statusText}`));
      }
    });

    runner.on('suite:error', (data) => {
      this.log(chalk.red(`❌ Test suite error: ${data.error.message}`));
    });

    runner.on('suite:complete', (data) => {
      this.log(chalk.blue(`\nTest suite completed in ${(data.result.summary.executionTime / 1000).toFixed(1)}s`));
    });
  }

  private displayResults(result: any): void {
    this.log(chalk.blue('\n📋 Test Results Summary:'));
    this.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    const passRate = (result.summary.overallPassRate * 100).toFixed(1);
    const statusColor = result.summary.overallPassRate >= 0.9 ? 'green' : 
                       result.summary.overallPassRate >= 0.7 ? 'yellow' : 'red';

    this.log(`Overall Pass Rate: ${chalk[statusColor](passRate + '%')} (${result.summary.passedTests}/${result.summary.totalTests})`);
    this.log(`Execution Time: ${(result.summary.executionTime / 1000).toFixed(1)}s`);

    if (result.results.accuracy) {
      this.displayTestResult('Accuracy', result.results.accuracy);
    }

    if (result.results.compilation) {
      this.displayTestResult('Compilation', result.results.compilation);
    }

    if (result.results.visual) {
      this.displayTestResult('Visual Regression', result.results.visual);
    }

    if (result.results.performance) {
      this.displayTestResult('Performance', result.results.performance);
    }

    if (result.errors.length > 0) {
      this.log(chalk.red('\n🚨 System Errors:'));
      for (const error of result.errors) {
        this.log(chalk.red(`  • ${error}`));
      }
    }
  }

  private displayTestResult(name: string, result: any): void {
    const status = result.passed ? '✅' : '❌';
    const statusText = result.passed ? 'PASSED' : 'FAILED';
    const color = result.passed ? 'green' : 'red';

    this.log(`\n${name} Tests: ${chalk[color](status + ' ' + statusText)}`);

    // Display key metrics based on test type
    if (result.type === 'accuracy') {
      this.log(`  UAST Accuracy: ${(result.metrics.uastAccuracy * 100).toFixed(1)}%`);
      this.log(`  Code Accuracy: ${(result.metrics.codeAccuracy * 100).toFixed(1)}%`);
      this.log(`  Component Info Accuracy: ${(result.metrics.componentInfoAccuracy * 100).toFixed(1)}%`);
    } else if (result.type === 'compilation') {
      this.log(`  Pass Rate: ${(result.metrics.passRate * 100).toFixed(1)}%`);
      this.log(`  Tests: ${result.metrics.passedTests}/${result.metrics.totalTests}`);
    } else if (result.type === 'visual') {
      this.log(`  Stability Rate: ${(result.metrics.stabilityRate * 100).toFixed(1)}%`);
      this.log(`  Snapshots: ${result.metrics.stableSnapshots}/${result.metrics.totalSnapshots} stable`);
    } else if (result.type === 'performance') {
      this.log(`  Avg Generation Time: ${result.metrics.averageGenerationTime.toFixed(0)}ms`);
      this.log(`  Avg Validation Time: ${result.metrics.averageValidationTime.toFixed(0)}ms`);
      this.log(`  Avg Render Time: ${result.metrics.averageRenderTime.toFixed(0)}ms`);
      this.log(`  Throughput: ${result.metrics.throughput.toFixed(2)} entries/sec`);
    }

    if (result.errors.length > 0) {
      this.log(chalk.red(`  Errors: ${result.errors.length}`));
    }
  }
}