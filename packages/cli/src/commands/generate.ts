import { Command, Flags } from '@oclif/core';
import { createLogger } from '@kpc/shared';
import { GenerateService } from '../services/generate.service';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as ora from 'ora';

const logger = createLogger('GenerateCommand');

export default class Generate extends Command {
  static description = 'Generate code from natural language requirements';

  static examples = [
    '$ kpc generate "Create a responsive navigation bar"',
    '$ kpc generate --framework react --output ./src/components',
    '$ kpc generate --interactive',
  ];

  static flags = {
    framework: Flags.string({
      char: 'f',
      description: 'Target framework (react, vue, intact)',
      options: ['react', 'vue', 'intact'],
      default: 'react',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output directory for generated code',
      default: './src/components',
    }),
    typescript: Flags.boolean({
      char: 't',
      description: 'Generate TypeScript code',
      default: true,
    }),
    tests: Flags.boolean({
      description: 'Generate test files',
      default: false,
    }),
    stories: Flags.boolean({
      description: 'Generate Storybook stories',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive mode with prompts',
      default: false,
    }),
    preview: Flags.boolean({
      char: 'p',
      description: 'Preview generated code without writing files',
      default: false,
    }),
  };

  static args = [
    {
      name: 'requirement',
      description: 'Natural language description of what to generate',
      required: false,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Generate);

    try {
      const generateService = new GenerateService();
      
      let requirement = args.requirement;
      let options = {
        framework: flags.framework as 'react' | 'vue' | 'intact',
        output: flags.output,
        typescript: flags.typescript,
        tests: flags.tests,
        stories: flags.stories,
        preview: flags.preview,
      };

      // Interactive mode
      if (flags.interactive || !requirement) {
        const answers = await this.promptForInput(requirement, options);
        requirement = answers.requirement;
        options = { ...options, ...answers.options };
      }

      if (!requirement) {
        this.error('Requirement is required. Use --interactive or provide a requirement argument.');
      }

      this.log('');
      this.log(chalk.blue('🤖 KPC Code Generation'));
      this.log(chalk.gray('=' .repeat(50)));
      this.log(`📝 Requirement: ${chalk.cyan(requirement)}`);
      this.log(`🎯 Framework: ${chalk.yellow(options.framework)}`);
      this.log(`📁 Output: ${chalk.green(options.output)}`);
      this.log('');

      // Start generation process
      const spinner = ora('Analyzing requirement...').start();

      try {
        // Step 1: Parse requirement
        spinner.text = 'Parsing natural language requirement...';
        const parsedRequirement = await generateService.parseRequirement(requirement);
        
        spinner.succeed(`Identified ${parsedRequirement.components.length} components`);
        this.log(`   Components: ${chalk.cyan(parsedRequirement.components.join(', '))}`);
        this.log(`   Confidence: ${chalk.yellow((parsedRequirement.confidence * 100).toFixed(1) + '%')}`);
        this.log('');

        // Step 2: Generate UAST
        spinner.start('Generating UI Abstract Syntax Tree...');
        const uast = await generateService.generateUAST(parsedRequirement);
        
        spinner.succeed('UAST generated successfully');
        this.log(`   Nodes: ${chalk.cyan(this.countUASTNodes(uast))}`);
        this.log(`   Confidence: ${chalk.yellow((uast.metadata.confidence * 100).toFixed(1) + '%')}`);
        this.log('');

        // Step 3: Generate code
        spinner.start(`Generating ${options.framework} code...`);
        const generatedCode = await generateService.generateCode(uast, options);
        
        spinner.succeed('Code generated successfully');
        this.log(`   Component: ${chalk.cyan(generatedCode.metadata.componentName)}`);
        this.log(`   Lines: ${chalk.yellow(generatedCode.component.split('\n').length)}`);
        this.log('');

        // Step 4: Validate code
        spinner.start('Validating generated code...');
        const validation = await generateService.validateCode(generatedCode.component, options.framework);
        
        if (validation.success) {
          spinner.succeed('Code validation passed');
        } else {
          spinner.warn(`Code validation found ${validation.errors?.length || 0} issues`);
          if (validation.errors) {
            for (const error of validation.errors.slice(0, 3)) {
              this.log(`   ${chalk.red('✗')} ${error.message}`);
            }
          }
        }
        this.log('');

        // Step 5: Output results
        if (options.preview) {
          this.log(chalk.blue('📄 Generated Code Preview:'));
          this.log(chalk.gray('-'.repeat(50)));
          this.log(generatedCode.component);
          this.log(chalk.gray('-'.repeat(50)));
        } else {
          spinner.start('Writing files...');
          const writtenFiles = await generateService.writeFiles(generatedCode, options);
          
          spinner.succeed(`Generated ${writtenFiles.length} files`);
          for (const file of writtenFiles) {
            this.log(`   ${chalk.green('✓')} ${file}`);
          }
        }

        this.log('');
        this.log(chalk.green('🎉 Code generation completed successfully!'));
        
        if (!options.preview) {
          this.log('');
          this.log(chalk.blue('Next steps:'));
          this.log(`   1. Review the generated code in ${chalk.cyan(options.output)}`);
          this.log(`   2. Run ${chalk.yellow('npm run build')} to compile`);
          this.log(`   3. Run ${chalk.yellow('npm test')} to verify functionality`);
        }

      } catch (error) {
        spinner.fail('Code generation failed');
        throw error;
      }

    } catch (error) {
      logger.error('Generate command failed:', error);
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async promptForInput(initialRequirement?: string, initialOptions?: any) {
    const questions = [];

    if (!initialRequirement) {
      questions.push({
        type: 'input',
        name: 'requirement',
        message: 'What would you like to generate?',
        validate: (input: string) => input.trim().length > 0 || 'Please provide a requirement',
      });
    }

    questions.push(
      {
        type: 'list',
        name: 'framework',
        message: 'Which framework would you like to use?',
        choices: [
          { name: 'React', value: 'react' },
          { name: 'Vue', value: 'vue' },
          { name: 'Intact', value: 'intact' },
        ],
        default: initialOptions?.framework || 'react',
      },
      {
        type: 'input',
        name: 'output',
        message: 'Output directory:',
        default: initialOptions?.output || './src/components',
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Generate TypeScript code?',
        default: initialOptions?.typescript ?? true,
      },
      {
        type: 'confirm',
        name: 'tests',
        message: 'Generate test files?',
        default: initialOptions?.tests ?? false,
      },
      {
        type: 'confirm',
        name: 'stories',
        message: 'Generate Storybook stories?',
        default: initialOptions?.stories ?? false,
      },
      {
        type: 'confirm',
        name: 'preview',
        message: 'Preview code without writing files?',
        default: initialOptions?.preview ?? false,
      }
    );

    const answers = await inquirer.prompt(questions);

    return {
      requirement: initialRequirement || answers.requirement,
      options: {
        framework: answers.framework,
        output: answers.output,
        typescript: answers.typescript,
        tests: answers.tests,
        stories: answers.stories,
        preview: answers.preview,
      },
    };
  }

  private countUASTNodes(uast: any): number {
    let count = 1;
    if (uast.children) {
      for (const child of uast.children) {
        count += this.countUASTNodes(child);
      }
    }
    return count;
  }
}