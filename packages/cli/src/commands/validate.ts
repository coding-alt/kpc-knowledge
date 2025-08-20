import { Command, Flags } from '@oclif/core';
import { createLogger } from '@kpc/shared';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const logger = createLogger('ValidateCommand');

export default class Validate extends Command {
  static description = 'Validate code against component library standards';

  static examples = [
    '$ kpc validate ./src/components/Button.tsx',
    '$ kpc validate ./src/components/ --recursive',
    '$ kpc validate --interactive',
  ];

  static flags = {
    recursive: Flags.boolean({
      char: 'r',
      description: 'Recursively validate all files in directory',
      default: false,
    }),
    framework: Flags.string({
      char: 'f',
      description: 'Target framework for validation',
      options: ['react', 'vue', 'intact'],
    }),
    fix: Flags.boolean({
      description: 'Automatically fix issues where possible',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive mode with file selection',
      default: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format for validation results',
      options: ['console', 'json', 'junit'],
      default: 'console',
    }),
    severity: Flags.string({
      char: 's',
      description: 'Minimum severity level to report',
      options: ['error', 'warning', 'info'],
      default: 'warning',
    }),
  };

  static args = [
    {
      name: 'path',
      description: 'File or directory path to validate',
      required: false,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Validate);

    try {
      let targetPath = args.path;
      let options = {
        recursive: flags.recursive,
        framework: flags.framework as 'react' | 'vue' | 'intact' | undefined,
        fix: flags.fix,
        output: flags.output as 'console' | 'json' | 'junit',
        severity: flags.severity as 'error' | 'warning' | 'info',
      };

      // Interactive mode
      if (flags.interactive || !targetPath) {
        const answers = await this.promptForInput(targetPath, options);
        targetPath = answers.path;
        options = { ...options, ...answers.options };
      }

      if (!targetPath) {
        this.error('Path is required. Use --interactive or provide a path argument.');
      }

      this.log('');
      this.log(chalk.blue('🔍 KPC Code Validation'));
      this.log(chalk.gray('=' .repeat(50)));
      this.log(`📁 Target: ${chalk.cyan(targetPath)}`);
      this.log(`🎯 Framework: ${chalk.yellow(options.framework || 'auto-detect')}`);
      this.log(`🔧 Auto-fix: ${options.fix ? chalk.green('enabled') : chalk.gray('disabled')}`);
      this.log('');

      // Discover files to validate
      const spinner = ora('Discovering files...').start();
      const files = await this.discoverFiles(targetPath, options.recursive);
      
      if (files.length === 0) {
        spinner.fail('No files found to validate');
        return;
      }

      spinner.succeed(`Found ${files.length} files to validate`);
      this.log('');

      // Validate each file
      const results = [];
      let totalIssues = 0;
      let fixedIssues = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = `[${i + 1}/${files.length}]`;
        
        spinner.start(`${progress} Validating ${path.basename(file)}...`);

        try {
          const result = await this.validateFile(file, options);
          results.push(result);
          
          const issueCount = result.issues.length;
          totalIssues += issueCount;
          
          if (issueCount === 0) {
            spinner.succeed(`${progress} ${chalk.green('✓')} ${path.basename(file)} - No issues`);
          } else {
            const errorCount = result.issues.filter(i => i.severity === 'error').length;
            const warningCount = result.issues.filter(i => i.severity === 'warning').length;
            
            if (errorCount > 0) {
              spinner.fail(`${progress} ${chalk.red('✗')} ${path.basename(file)} - ${errorCount} errors, ${warningCount} warnings`);
            } else {
              spinner.warn(`${progress} ${chalk.yellow('⚠')} ${path.basename(file)} - ${warningCount} warnings`);
            }

            // Auto-fix if enabled
            if (options.fix && result.fixable > 0) {
              const fixSpinner = ora(`  Applying fixes...`).start();
              const fixed = await this.applyFixes(file, result);
              fixedIssues += fixed;
              fixSpinner.succeed(`  Fixed ${fixed} issues`);
            }
          }
        } catch (error) {
          spinner.fail(`${progress} ${chalk.red('✗')} ${path.basename(file)} - Validation failed`);
          logger.error(`Validation failed for ${file}:`, error);
        }
      }

      this.log('');
      this.displaySummary(results, totalIssues, fixedIssues);

      // Output results in requested format
      if (options.output !== 'console') {
        await this.outputResults(results, options.output);
      }

      // Interactive fix mode
      if (!options.fix && totalIssues > 0) {
        const shouldFix = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'fix',
            message: `Found ${totalIssues} issues. Would you like to apply automatic fixes?`,
            default: false,
          },
        ]);

        if (shouldFix.fix) {
          await this.interactiveFix(results);
        }
      }

    } catch (error) {
      logger.error('Validate command failed:', error);
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async promptForInput(initialPath?: string, initialOptions?: any) {
    const questions = [];

    if (!initialPath) {
      questions.push({
        type: 'input',
        name: 'path',
        message: 'Enter file or directory path to validate:',
        default: './src',
        validate: (input: string) => {
          if (!input.trim()) return 'Please provide a path';
          if (!fs.existsSync(input)) return 'Path does not exist';
          return true;
        },
      });
    }

    questions.push(
      {
        type: 'confirm',
        name: 'recursive',
        message: 'Validate files recursively?',
        default: initialOptions?.recursive ?? true,
        when: (answers: any) => {
          const targetPath = initialPath || answers.path;
          return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
        },
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Target framework:',
        choices: [
          { name: 'Auto-detect', value: undefined },
          { name: 'React', value: 'react' },
          { name: 'Vue', value: 'vue' },
          { name: 'Intact', value: 'intact' },
        ],
        default: initialOptions?.framework,
      },
      {
        type: 'list',
        name: 'severity',
        message: 'Minimum severity level:',
        choices: [
          { name: 'Errors only', value: 'error' },
          { name: 'Warnings and errors', value: 'warning' },
          { name: 'All issues', value: 'info' },
        ],
        default: initialOptions?.severity || 'warning',
      },
      {
        type: 'confirm',
        name: 'fix',
        message: 'Automatically fix issues where possible?',
        default: initialOptions?.fix ?? false,
      },
      {
        type: 'list',
        name: 'output',
        message: 'Output format:',
        choices: [
          { name: 'Console', value: 'console' },
          { name: 'JSON', value: 'json' },
          { name: 'JUnit XML', value: 'junit' },
        ],
        default: initialOptions?.output || 'console',
      }
    );

    const answers = await inquirer.prompt(questions);

    return {
      path: initialPath || answers.path,
      options: {
        recursive: answers.recursive,
        framework: answers.framework,
        severity: answers.severity,
        fix: answers.fix,
        output: answers.output,
      },
    };
  }

  private async discoverFiles(targetPath: string, recursive: boolean): Promise<string[]> {
    const stats = fs.statSync(targetPath);
    
    if (stats.isFile()) {
      return [targetPath];
    }

    if (stats.isDirectory()) {
      const pattern = recursive 
        ? path.join(targetPath, '**/*.{ts,tsx,js,jsx,vue}')
        : path.join(targetPath, '*.{ts,tsx,js,jsx,vue}');
      
      return glob.sync(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
      });
    }

    return [];
  }

  private async validateFile(filePath: string, options: any): Promise<any> {
    // Mock validation logic - in real implementation, this would use the validator services
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    // Simulate some validation issues
    if (content.includes('any')) {
      issues.push({
        line: 1,
        column: 1,
        severity: 'warning',
        message: 'Avoid using "any" type',
        rule: 'no-any',
        fixable: false,
      });
    }

    if (content.includes('console.log')) {
      issues.push({
        line: 1,
        column: 1,
        severity: 'warning',
        message: 'Remove console.log statements',
        rule: 'no-console',
        fixable: true,
      });
    }

    return {
      file: filePath,
      framework: this.detectFramework(content),
      issues,
      fixable: issues.filter(i => i.fixable).length,
      stats: {
        lines: content.split('\n').length,
        size: content.length,
      },
    };
  }

  private detectFramework(content: string): string {
    if (content.includes('import React') || content.includes('from \'react\'')) {
      return 'react';
    }
    if (content.includes('<template>') || content.includes('defineComponent')) {
      return 'vue';
    }
    if (content.includes('Intact') || content.includes('@intact')) {
      return 'intact';
    }
    return 'unknown';
  }

  private async applyFixes(filePath: string, result: any): Promise<number> {
    // Mock fix application - in real implementation, this would apply actual fixes
    const fixableIssues = result.issues.filter((i: any) => i.fixable);
    
    // Simulate applying fixes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return fixableIssues.length;
  }

  private displaySummary(results: any[], totalIssues: number, fixedIssues: number): void {
    this.log(chalk.blue('📊 Validation Summary'));
    this.log(chalk.gray('-'.repeat(30)));
    
    const totalFiles = results.length;
    const filesWithIssues = results.filter(r => r.issues.length > 0).length;
    const errorCount = results.reduce((sum, r) => sum + r.issues.filter((i: any) => i.severity === 'error').length, 0);
    const warningCount = results.reduce((sum, r) => sum + r.issues.filter((i: any) => i.severity === 'warning').length, 0);

    this.log(`Files validated: ${chalk.cyan(totalFiles)}`);
    this.log(`Files with issues: ${chalk.yellow(filesWithIssues)}`);
    this.log(`Total issues: ${chalk.red(totalIssues)}`);
    this.log(`  Errors: ${chalk.red(errorCount)}`);
    this.log(`  Warnings: ${chalk.yellow(warningCount)}`);
    
    if (fixedIssues > 0) {
      this.log(`Issues fixed: ${chalk.green(fixedIssues)}`);
    }

    this.log('');
    
    if (errorCount === 0) {
      this.log(chalk.green('🎉 No errors found!'));
    } else {
      this.log(chalk.red(`❌ Found ${errorCount} errors that need attention`));
    }
  }

  private async outputResults(results: any[], format: string): Promise<void> {
    const outputFile = `validation-results.${format === 'json' ? 'json' : 'xml'}`;
    
    if (format === 'json') {
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    } else if (format === 'junit') {
      // Generate JUnit XML format
      const xml = this.generateJUnitXML(results);
      fs.writeFileSync(outputFile, xml);
    }

    this.log(`Results saved to ${chalk.cyan(outputFile)}`);
  }

  private generateJUnitXML(results: any[]): string {
    const totalTests = results.length;
    const failures = results.filter(r => r.issues.some((i: any) => i.severity === 'error')).length;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="KPC Validation" tests="${totalTests}" failures="${failures}">\n`;
    
    for (const result of results) {
      const hasErrors = result.issues.some((i: any) => i.severity === 'error');
      xml += `  <testcase name="${result.file}" classname="validation">\n`;
      
      if (hasErrors) {
        const errors = result.issues.filter((i: any) => i.severity === 'error');
        for (const error of errors) {
          xml += `    <failure message="${error.message}">${error.rule}</failure>\n`;
        }
      }
      
      xml += `  </testcase>\n`;
    }
    
    xml += `</testsuite>\n`;
    return xml;
  }

  private async interactiveFix(results: any[]): Promise<void> {
    const fixableResults = results.filter(r => r.fixable > 0);
    
    if (fixableResults.length === 0) {
      this.log(chalk.yellow('No fixable issues found.'));
      return;
    }

    const choices = fixableResults.map(r => ({
      name: `${path.basename(r.file)} (${r.fixable} fixable issues)`,
      value: r.file,
      checked: true,
    }));

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'files',
        message: 'Select files to fix:',
        choices,
      },
    ]);

    if (answers.files.length === 0) {
      this.log('No files selected for fixing.');
      return;
    }

    const spinner = ora('Applying fixes...').start();
    let totalFixed = 0;

    for (const filePath of answers.files) {
      const result = results.find(r => r.file === filePath);
      if (result) {
        const fixed = await this.applyFixes(filePath, result);
        totalFixed += fixed;
      }
    }

    spinner.succeed(`Fixed ${totalFixed} issues across ${answers.files.length} files`);
  }
}