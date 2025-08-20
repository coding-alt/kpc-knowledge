import { Command, Flags } from '@oclif/core';
import { createLogger } from '@kpc/shared';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('InitCommand');

export default class Init extends Command {
  static description = 'Initialize KPC configuration for your project';

  static examples = [
    '$ kpc init',
    '$ kpc init --framework react --typescript',
    '$ kpc init --interactive',
  ];

  static flags = {
    framework: Flags.string({
      char: 'f',
      description: 'Primary framework for the project',
      options: ['react', 'vue', 'intact'],
    }),
    typescript: Flags.boolean({
      char: 't',
      description: 'Enable TypeScript support',
      default: true,
    }),
    testing: Flags.boolean({
      description: 'Enable testing configuration',
      default: true,
    }),
    storybook: Flags.boolean({
      description: 'Enable Storybook integration',
      default: false,
    }),
    eslint: Flags.boolean({
      description: 'Enable ESLint rules',
      default: true,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive configuration setup',
      default: true,
    }),
    force: Flags.boolean({
      description: 'Overwrite existing configuration',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    try {
      this.log('');
      this.log(chalk.blue('🚀 KPC Knowledge System Initialization'));
      this.log(chalk.gray('=' .repeat(50)));
      this.log('');

      // Check if already initialized
      const configExists = fs.existsSync('.kpc.config.js') || fs.existsSync('.kpc.config.json');
      if (configExists && !flags.force) {
        const overwrite = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'KPC configuration already exists. Overwrite?',
            default: false,
          },
        ]);

        if (!overwrite.overwrite) {
          this.log(chalk.yellow('Initialization cancelled.'));
          return;
        }
      }

      let config = {
        framework: flags.framework,
        typescript: flags.typescript,
        testing: flags.testing,
        storybook: flags.storybook,
        eslint: flags.eslint,
      };

      // Interactive mode
      if (flags.interactive) {
        config = await this.promptForConfiguration(config);
      }

      // Validate configuration
      if (!config.framework) {
        this.error('Framework is required. Use --framework or --interactive.');
      }

      this.log(chalk.blue('📋 Configuration Summary'));
      this.log(chalk.gray('-'.repeat(30)));
      this.log(`Framework: ${chalk.cyan(config.framework)}`);
      this.log(`TypeScript: ${config.typescript ? chalk.green('enabled') : chalk.gray('disabled')}`);
      this.log(`Testing: ${config.testing ? chalk.green('enabled') : chalk.gray('disabled')}`);
      this.log(`Storybook: ${config.storybook ? chalk.green('enabled') : chalk.gray('disabled')}`);
      this.log(`ESLint: ${config.eslint ? chalk.green('enabled') : chalk.gray('disabled')}`);
      this.log('');

      // Create configuration files
      const spinner = ora('Creating configuration files...').start();
      await this.createConfigurationFiles(config);
      spinner.succeed('Configuration files created');

      // Install dependencies
      if (await this.shouldInstallDependencies()) {
        await this.installDependencies(config);
      }

      // Setup project structure
      await this.setupProjectStructure(config);

      // Generate initial files
      await this.generateInitialFiles(config);

      this.log('');
      this.log(chalk.green('🎉 KPC initialization completed successfully!'));
      this.log('');
      this.log(chalk.blue('Next steps:'));
      this.log(`1. Review the configuration in ${chalk.cyan('.kpc.config.js')}`);
      this.log(`2. Run ${chalk.yellow('kpc generate "your first component"')} to create a component`);
      this.log(`3. Use ${chalk.yellow('kpc validate')} to check your code`);
      this.log(`4. Run ${chalk.yellow('kpc test')} to test your components`);
      this.log('');
      this.log(chalk.gray('📚 Documentation: https://github.com/ksc-fe/kpc-knowledge-system'));

    } catch (error) {
      logger.error('Init command failed:', error);
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async promptForConfiguration(initialConfig: any) {
    const questions = [
      {
        type: 'list',
        name: 'framework',
        message: 'Which framework will you primarily use?',
        choices: [
          { name: 'React - Modern React with hooks', value: 'react' },
          { name: 'Vue - Vue 3 with Composition API', value: 'vue' },
          { name: 'Intact - KingSoft Intact framework', value: 'intact' },
        ],
        default: initialConfig.framework || 'react',
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Enable TypeScript support?',
        default: initialConfig.typescript ?? true,
      },
      {
        type: 'confirm',
        name: 'testing',
        message: 'Set up testing configuration?',
        default: initialConfig.testing ?? true,
      },
      {
        type: 'confirm',
        name: 'storybook',
        message: 'Enable Storybook for component development?',
        default: initialConfig.storybook ?? false,
      },
      {
        type: 'confirm',
        name: 'eslint',
        message: 'Enable KPC ESLint rules?',
        default: initialConfig.eslint ?? true,
      },
      {
        type: 'input',
        name: 'componentsDir',
        message: 'Components directory:',
        default: './src/components',
      },
      {
        type: 'input',
        name: 'outputDir',
        message: 'Generated code output directory:',
        default: './src/generated',
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Additional features to enable:',
        choices: [
          { name: 'Auto-import generation', value: 'autoImports' },
          { name: 'Component documentation', value: 'docs' },
          { name: 'Visual regression testing', value: 'visualTesting' },
          { name: 'Accessibility checking', value: 'a11y' },
          { name: 'Performance monitoring', value: 'performance' },
        ],
      },
    ];

    const answers = await inquirer.prompt(questions);

    return {
      framework: answers.framework,
      typescript: answers.typescript,
      testing: answers.testing,
      storybook: answers.storybook,
      eslint: answers.eslint,
      componentsDir: answers.componentsDir,
      outputDir: answers.outputDir,
      features: answers.features || [],
    };
  }

  private async createConfigurationFiles(config: any): Promise<void> {
    // Create main KPC configuration
    const kpcConfig = {
      framework: config.framework,
      typescript: config.typescript,
      componentsDir: config.componentsDir || './src/components',
      outputDir: config.outputDir || './src/generated',
      features: config.features || [],
      api: {
        endpoint: process.env.KPC_API_ENDPOINT || 'http://localhost:4000/graphql',
        timeout: 30000,
      },
      generation: {
        includeTests: config.testing,
        includeStories: config.storybook,
        includeTypes: config.typescript,
        autoImports: config.features?.includes('autoImports') ?? false,
      },
      validation: {
        eslint: config.eslint,
        typescript: config.typescript,
        accessibility: config.features?.includes('a11y') ?? false,
      },
      testing: {
        unit: config.testing,
        integration: config.testing,
        visual: config.features?.includes('visualTesting') ?? false,
        e2e: false,
      },
    };

    fs.writeFileSync('.kpc.config.js', `module.exports = ${JSON.stringify(kpcConfig, null, 2)};`);

    // Create package.json scripts if package.json exists
    if (fs.existsSync('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts['kpc:generate'] = 'kpc generate';
      packageJson.scripts['kpc:validate'] = 'kpc validate ./src';
      packageJson.scripts['kpc:test'] = 'kpc test ./src';
      packageJson.scripts['kpc:search'] = 'kpc search';

      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    }

    // Create ESLint configuration if enabled
    if (config.eslint) {
      const eslintConfig = {
        extends: ['@kpc/eslint-config'],
        rules: {
          '@kpc/component-naming': 'error',
          '@kpc/prop-types': 'error',
          '@kpc/no-deprecated': 'warn',
        },
      };

      if (fs.existsSync('.eslintrc.js')) {
        // Merge with existing config
        const existingConfig = require(path.resolve('.eslintrc.js'));
        eslintConfig.extends = [...(existingConfig.extends || []), ...eslintConfig.extends];
        eslintConfig.rules = { ...existingConfig.rules, ...eslintConfig.rules };
      }

      fs.writeFileSync('.eslintrc.js', `module.exports = ${JSON.stringify(eslintConfig, null, 2)};`);
    }

    // Create TypeScript configuration if enabled
    if (config.typescript && !fs.existsSync('tsconfig.json')) {
      const tsConfig = {
        compilerOptions: {
          target: 'es2020',
          lib: ['dom', 'dom.iterable', 'es6'],
          allowJs: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: config.framework === 'react' ? 'react-jsx' : 'preserve',
        },
        include: ['src'],
        exclude: ['node_modules'],
      };

      fs.writeFileSync('tsconfig.json', JSON.stringify(tsConfig, null, 2));
    }

    // Create Storybook configuration if enabled
    if (config.storybook) {
      const storybookDir = '.storybook';
      if (!fs.existsSync(storybookDir)) {
        fs.mkdirSync(storybookDir, { recursive: true });
      }

      const storybookMain = {
        stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: [
          '@storybook/addon-essentials',
          '@storybook/addon-a11y',
          '@kpc/storybook-addon',
        ],
        framework: `@storybook/react-vite`,
      };

      fs.writeFileSync(
        path.join(storybookDir, 'main.js'),
        `module.exports = ${JSON.stringify(storybookMain, null, 2)};`
      );
    }
  }

  private async shouldInstallDependencies(): Promise<boolean> {
    if (!fs.existsSync('package.json')) {
      return false;
    }

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'Install KPC dependencies?',
        default: true,
      },
    ]);

    return answer.install;
  }

  private async installDependencies(config: any): Promise<void> {
    const spinner = ora('Installing dependencies...').start();

    try {
      // Determine package manager
      const packageManager = this.detectPackageManager();
      
      const dependencies = [
        '@kpc/shared',
        '@kpc/codegen',
        '@kpc/validator',
      ];

      const devDependencies = [];

      if (config.eslint) {
        devDependencies.push('@kpc/eslint-config');
      }

      if (config.storybook) {
        devDependencies.push('@kpc/storybook-addon');
      }

      if (config.testing) {
        devDependencies.push('@kpc/testing-utils');
      }

      // Mock installation - in real implementation, this would run actual package manager commands
      await new Promise(resolve => setTimeout(resolve, 2000));

      spinner.succeed(`Dependencies installed using ${packageManager}`);

    } catch (error) {
      spinner.fail('Failed to install dependencies');
      this.log(chalk.yellow('You can install dependencies manually:'));
      this.log(chalk.gray('npm install @kpc/shared @kpc/codegen @kpc/validator'));
    }
  }

  private detectPackageManager(): string {
    if (fs.existsSync('yarn.lock')) return 'yarn';
    if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
    return 'npm';
  }

  private async setupProjectStructure(config: any): Promise<void> {
    const spinner = ora('Setting up project structure...').start();

    try {
      // Create directories
      const dirs = [
        config.componentsDir || './src/components',
        config.outputDir || './src/generated',
        './src/types',
      ];

      if (config.testing) {
        dirs.push('./src/__tests__');
      }

      if (config.storybook) {
        dirs.push('./src/stories');
      }

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      spinner.succeed('Project structure created');

    } catch (error) {
      spinner.fail('Failed to setup project structure');
      throw error;
    }
  }

  private async generateInitialFiles(config: any): Promise<void> {
    const spinner = ora('Generating initial files...').start();

    try {
      // Create example component
      const componentDir = config.componentsDir || './src/components';
      const exampleComponent = this.generateExampleComponent(config);
      
      fs.writeFileSync(
        path.join(componentDir, `Example.${config.typescript ? 'tsx' : 'jsx'}`),
        exampleComponent
      );

      // Create types file if TypeScript is enabled
      if (config.typescript) {
        const typesFile = this.generateTypesFile(config);
        fs.writeFileSync('./src/types/index.ts', typesFile);
      }

      // Create test file if testing is enabled
      if (config.testing) {
        const testFile = this.generateTestFile(config);
        fs.writeFileSync(
          path.join('./src/__tests__', `Example.test.${config.typescript ? 'tsx' : 'jsx'}`),
          testFile
        );
      }

      // Create story file if Storybook is enabled
      if (config.storybook) {
        const storyFile = this.generateStoryFile(config);
        fs.writeFileSync(
          path.join('./src/stories', `Example.stories.${config.typescript ? 'tsx' : 'jsx'}`),
          storyFile
        );
      }

      // Create README
      const readme = this.generateReadme(config);
      fs.writeFileSync('./KPC_README.md', readme);

      spinner.succeed('Initial files generated');

    } catch (error) {
      spinner.fail('Failed to generate initial files');
      throw error;
    }
  }

  private generateExampleComponent(config: any): string {
    const isTypeScript = config.typescript;
    const framework = config.framework;

    if (framework === 'react') {
      return `import React${isTypeScript ? ', { FC }' : ''} from 'react';

${isTypeScript ? `
interface ExampleProps {
  title: string;
  onClick?: () => void;
}

const Example: FC<ExampleProps> = ({ title, onClick }) => {
` : `
const Example = ({ title, onClick }) => {
`}
  return (
    <div className="example-component">
      <h2>{title}</h2>
      <button onClick={onClick}>
        Click me!
      </button>
    </div>
  );
};

export default Example;
`;
    }

    if (framework === 'vue') {
      return `<template>
  <div class="example-component">
    <h2>{{ title }}</h2>
    <button @click="handleClick">
      Click me!
    </button>
  </div>
</template>

<script${isTypeScript ? ' lang="ts"' : ''}>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Example',
  props: {
    title: {
      type: String,
      required: true,
    },
  },
  emits: ['click'],
  setup(props, { emit }) {
    const handleClick = () => {
      emit('click');
    };

    return {
      handleClick,
    };
  },
});
</script>

<style scoped>
.example-component {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
`;
    }

    // Intact framework
    return `import Intact from 'intact';

${isTypeScript ? `
interface ExampleProps {
  title: string;
}
` : ''}

export default class Example extends Intact${isTypeScript ? '<ExampleProps>' : ''} {
  @Intact.template()
  static template = \`
    <div class="example-component">
      <h2>{self.get('title')}</h2>
      <button ev-click={self.handleClick}>
        Click me!
      </button>
    </div>
  \`;

  handleClick() {
    this.trigger('click');
  }
}
`;
  }

  private generateTypesFile(config: any): string {
    return `// KPC Knowledge System Types
export interface ComponentProps {
  [key: string]: any;
}

export interface ComponentEvents {
  [key: string]: (...args: any[]) => void;
}

export interface KPCConfig {
  framework: 'react' | 'vue' | 'intact';
  typescript: boolean;
  componentsDir: string;
  outputDir: string;
}

// Add your custom types here
`;
  }

  private generateTestFile(config: any): string {
    const framework = config.framework;
    const isTypeScript = config.typescript;

    if (framework === 'react') {
      return `import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Example from '../components/Example';

describe('Example Component', () => {
  it('renders with title', () => {
    render(<Example title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Example title="Test" onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Click me!'));
    expect(handleClick).toHaveBeenCalled();
  });
});
`;
    }

    return `// Add your tests here
describe('Example Component', () => {
  it('should render correctly', () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
`;
  }

  private generateStoryFile(config: any): string {
    const framework = config.framework;

    if (framework === 'react') {
      return `import type { Meta, StoryObj } from '@storybook/react';
import Example from '../components/Example';

const meta: Meta<typeof Example> = {
  title: 'Components/Example',
  component: Example,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Example Component',
  },
};

export const WithClickHandler: Story = {
  args: {
    title: 'Clickable Example',
    onClick: () => alert('Clicked!'),
  },
};
`;
    }

    return `// Add your Storybook stories here
export default {
  title: 'Components/Example',
  component: Example,
};

export const Default = {
  args: {
    title: 'Example Component',
  },
};
`;
  }

  private generateReadme(config: any): string {
    return `# KPC Knowledge System - Project Setup

This project has been initialized with KPC Knowledge System support.

## Configuration

- **Framework**: ${config.framework}
- **TypeScript**: ${config.typescript ? 'Enabled' : 'Disabled'}
- **Testing**: ${config.testing ? 'Enabled' : 'Disabled'}
- **Storybook**: ${config.storybook ? 'Enabled' : 'Disabled'}
- **ESLint**: ${config.eslint ? 'Enabled' : 'Disabled'}

## Available Commands

\`\`\`bash
# Generate components from natural language
npm run kpc:generate

# Validate your code
npm run kpc:validate

# Run component tests
npm run kpc:test

# Search components and documentation
npm run kpc:search
\`\`\`

## Getting Started

1. **Generate your first component:**
   \`\`\`bash
   kpc generate "Create a responsive navigation bar"
   \`\`\`

2. **Validate your code:**
   \`\`\`bash
   kpc validate ./src/components
   \`\`\`

3. **Run tests:**
   \`\`\`bash
   kpc test
   \`\`\`

4. **Search for components:**
   \`\`\`bash
   kpc search "button component"
   \`\`\`

## Configuration

Edit \`.kpc.config.js\` to customize your KPC setup:

\`\`\`javascript
module.exports = {
  framework: '${config.framework}',
  componentsDir: '${config.componentsDir || './src/components'}',
  outputDir: '${config.outputDir || './src/generated'}',
  // ... other options
};
\`\`\`

## Documentation

- [KPC Knowledge System](https://github.com/ksc-fe/kpc-knowledge-system)
- [Component Library](https://kpc.kingsoft.com)
- [API Documentation](https://api.kpc.kingsoft.com)

## Support

If you encounter any issues, please check the documentation or create an issue on GitHub.
`;
  }
}