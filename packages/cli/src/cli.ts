#!/usr/bin/env node

import { Command } from '@oclif/core';
import { createLogger } from '@kpc/shared';
import * as chalk from 'chalk';

const logger = createLogger('CLI');

export class KPCCli extends Command {
  static description = 'KPC Knowledge System CLI - Intelligent frontend code generation';

  static examples = [
    '$ kpc generate "Create a login form with email and password"',
    '$ kpc validate ./src/components/Button.tsx',
    '$ kpc test ./src/components/',
    '$ kpc search "button component"',
    '$ kpc preview ./src/components/Button.tsx',
    '$ kpc init --framework react',
  ];

  static flags = {
    version: Command.flags.version({ char: 'v' }),
    help: Command.flags.help({ char: 'h' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KPCCli);

    logger.info('🚀 Welcome to KPC Knowledge System CLI');
    
    this.log('');
    this.log(chalk.blue('🧩 KPC Knowledge System CLI'));
    this.log(chalk.gray('Intelligent frontend code generation and validation'));
    this.log('');
    this.log(chalk.yellow('📋 Available Commands:'));
    this.log('');
    this.log(chalk.cyan('  🎯 Core Commands:'));
    this.log('    generate   - Generate code from natural language requirements');
    this.log('    validate   - Validate code against component library standards');
    this.log('    test       - Run automated tests for components');
    this.log('    search     - Search components and documentation');
    this.log('');
    this.log(chalk.cyan('  🛠️  Development Tools:'));
    this.log('    preview    - Preview and debug components locally');
    this.log('    init       - Initialize KPC configuration for your project');
    this.log('');
    this.log(chalk.cyan('  🔧 Utility Commands:'));
    this.log('    fix        - Auto-fix code issues using AI (coming soon)');
    this.log('    config     - Manage KPC configuration (coming soon)');
    this.log('');
    this.log(chalk.green('💡 Quick Start:'));
    this.log(`    ${chalk.gray('1.')} ${chalk.yellow('kpc init')} - Initialize your project`);
    this.log(`    ${chalk.gray('2.')} ${chalk.yellow('kpc generate "create a button"')} - Generate your first component`);
    this.log(`    ${chalk.gray('3.')} ${chalk.yellow('kpc preview ./src/components/Button.tsx')} - Preview the component`);
    this.log('');
    this.log(chalk.blue('📚 Documentation:'));
    this.log('    https://github.com/ksc-fe/kpc-knowledge-system');
    this.log('');
    this.log(chalk.gray('💡 Use "kpc <command> --help" for detailed command information'));
    this.log(chalk.gray('💡 Use "kpc <command> --interactive" for guided setup'));
  }
}

export default KPCCli;