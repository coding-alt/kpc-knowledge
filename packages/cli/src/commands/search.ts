import { Command, Flags } from '@oclif/core';
import { createLogger } from '@kpc/shared';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as ora from 'ora';

const logger = createLogger('SearchCommand');

export default class Search extends Command {
  static description = 'Search components and documentation';

  static examples = [
    '$ kpc search "button component"',
    '$ kpc search --framework react --category form',
    '$ kpc search --interactive',
  ];

  static flags = {
    framework: Flags.string({
      char: 'f',
      description: 'Filter by framework',
      options: ['react', 'vue', 'intact'],
    }),
    category: Flags.string({
      char: 'c',
      description: 'Filter by component category',
    }),
    type: Flags.string({
      char: 't',
      description: 'Search type',
      options: ['components', 'props', 'events', 'examples', 'docs', 'all'],
      default: 'all',
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Maximum number of results',
      default: 10,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive search with filters',
      default: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format',
      options: ['table', 'json', 'detailed'],
      default: 'table',
    }),
    similarity: Flags.string({
      char: 's',
      description: 'Similarity threshold for semantic search',
      default: '0.7',
    }),
  };

  static args = [
    {
      name: 'query',
      description: 'Search query',
      required: false,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search);

    try {
      let query = args.query;
      let options = {
        framework: flags.framework as 'react' | 'vue' | 'intact' | undefined,
        category: flags.category,
        type: flags.type as 'components' | 'props' | 'events' | 'examples' | 'docs' | 'all',
        limit: flags.limit,
        output: flags.output as 'table' | 'json' | 'detailed',
        similarity: parseFloat(flags.similarity),
      };

      // Interactive mode
      if (flags.interactive || !query) {
        const answers = await this.promptForInput(query, options);
        query = answers.query;
        options = { ...options, ...answers.options };
      }

      if (!query) {
        this.error('Search query is required. Use --interactive or provide a query argument.');
      }

      this.log('');
      this.log(chalk.blue('🔍 KPC Component Search'));
      this.log(chalk.gray('=' .repeat(50)));
      this.log(`🔎 Query: ${chalk.cyan(query)}`);
      this.log(`🎯 Type: ${chalk.yellow(options.type)}`);
      this.log(`🎭 Framework: ${chalk.yellow(options.framework || 'all')}`);
      this.log(`📂 Category: ${chalk.yellow(options.category || 'all')}`);
      this.log('');

      // Perform search
      const spinner = ora('Searching...').start();
      const results = await this.performSearch(query, options);
      
      if (results.length === 0) {
        spinner.fail('No results found');
        this.suggestAlternatives(query);
        return;
      }

      spinner.succeed(`Found ${results.length} results`);
      this.log('');

      // Display results
      this.displayResults(results, options);

      // Interactive result exploration
      if (flags.interactive && results.length > 0) {
        await this.exploreResults(results);
      }

    } catch (error) {
      logger.error('Search command failed:', error);
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async promptForInput(initialQuery?: string, initialOptions?: any) {
    const questions = [];

    if (!initialQuery) {
      questions.push({
        type: 'input',
        name: 'query',
        message: 'What would you like to search for?',
        validate: (input: string) => input.trim().length > 0 || 'Please provide a search query',
      });
    }

    questions.push(
      {
        type: 'list',
        name: 'type',
        message: 'What type of search?',
        choices: [
          { name: 'Everything - Components, docs, examples', value: 'all' },
          { name: 'Components - Component definitions', value: 'components' },
          { name: 'Properties - Component props', value: 'props' },
          { name: 'Events - Component events', value: 'events' },
          { name: 'Examples - Code examples', value: 'examples' },
          { name: 'Documentation - Text documentation', value: 'docs' },
        ],
        default: initialOptions?.type || 'all',
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Filter by framework:',
        choices: [
          { name: 'All frameworks', value: undefined },
          { name: 'React', value: 'react' },
          { name: 'Vue', value: 'vue' },
          { name: 'Intact', value: 'intact' },
        ],
        default: initialOptions?.framework,
      },
      {
        type: 'input',
        name: 'category',
        message: 'Filter by category (optional):',
        default: initialOptions?.category || '',
      },
      {
        type: 'number',
        name: 'limit',
        message: 'Maximum number of results:',
        default: initialOptions?.limit || 10,
        validate: (input: number) => input > 0 && input <= 100 || 'Please enter a number between 1 and 100',
      },
      {
        type: 'list',
        name: 'output',
        message: 'Output format:',
        choices: [
          { name: 'Table - Compact table view', value: 'table' },
          { name: 'Detailed - Full information', value: 'detailed' },
          { name: 'JSON - Machine readable', value: 'json' },
        ],
        default: initialOptions?.output || 'table',
      },
      {
        type: 'slider',
        name: 'similarity',
        message: 'Similarity threshold (0.0 - 1.0):',
        min: 0.0,
        max: 1.0,
        step: 0.1,
        default: initialOptions?.similarity || 0.7,
      }
    );

    const answers = await inquirer.prompt(questions);

    return {
      query: initialQuery || answers.query,
      options: {
        type: answers.type,
        framework: answers.framework,
        category: answers.category || undefined,
        limit: answers.limit,
        output: answers.output,
        similarity: answers.similarity,
      },
    };
  }

  private async performSearch(query: string, options: any): Promise<any[]> {
    // Mock search implementation - in real implementation, this would call the API
    const mockResults = [
      {
        type: 'component',
        name: 'Button',
        framework: 'react',
        category: 'form',
        description: 'A versatile button component with multiple variants',
        score: 0.95,
        props: ['variant', 'size', 'disabled', 'onClick'],
        events: ['click', 'focus', 'blur'],
        examples: 2,
        documentation: 'Complete API documentation available',
        path: '@kpc/react/Button',
      },
      {
        type: 'component',
        name: 'IconButton',
        framework: 'react',
        category: 'form',
        description: 'Button component with icon support',
        score: 0.88,
        props: ['icon', 'variant', 'size', 'disabled'],
        events: ['click'],
        examples: 1,
        documentation: 'Basic usage documentation',
        path: '@kpc/react/IconButton',
      },
      {
        type: 'example',
        name: 'Login Form with Button',
        framework: 'react',
        category: 'form',
        description: 'Complete login form example using Button component',
        score: 0.82,
        code: 'const LoginForm = () => { ... }',
        components: ['Button', 'Input', 'Form'],
        path: 'examples/forms/LoginForm.tsx',
      },
      {
        type: 'prop',
        name: 'variant',
        component: 'Button',
        framework: 'vue',
        description: 'Button style variant (primary, secondary, danger)',
        score: 0.75,
        type: 'string',
        default: 'primary',
        required: false,
      },
    ];

    // Apply filters
    let filteredResults = mockResults;

    if (options.framework) {
      filteredResults = filteredResults.filter(r => r.framework === options.framework);
    }

    if (options.category) {
      filteredResults = filteredResults.filter(r => r.category === options.category);
    }

    if (options.type !== 'all') {
      filteredResults = filteredResults.filter(r => r.type === options.type);
    }

    // Apply similarity threshold
    filteredResults = filteredResults.filter(r => r.score >= options.similarity);

    // Sort by score and limit
    filteredResults.sort((a, b) => b.score - a.score);
    return filteredResults.slice(0, options.limit);
  }

  private displayResults(results: any[], options: any): void {
    if (options.output === 'json') {
      this.log(JSON.stringify(results, null, 2));
      return;
    }

    if (options.output === 'table') {
      this.displayTableResults(results);
    } else {
      this.displayDetailedResults(results);
    }
  }

  private displayTableResults(results: any[]): void {
    this.log(chalk.blue('📋 Search Results'));
    this.log(chalk.gray('-'.repeat(80)));
    
    const headers = ['Type', 'Name', 'Framework', 'Score', 'Description'];
    const rows = results.map(r => [
      this.getTypeIcon(r.type),
      chalk.cyan(r.name),
      chalk.yellow(r.framework),
      chalk.green((r.score * 100).toFixed(0) + '%'),
      r.description.substring(0, 40) + (r.description.length > 40 ? '...' : ''),
    ]);

    // Simple table display
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      this.log(`${i + 1}. ${row.join(' | ')}`);
    }
  }

  private displayDetailedResults(results: any[]): void {
    this.log(chalk.blue('📋 Detailed Search Results'));
    this.log(chalk.gray('=' .repeat(50)));

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      this.log('');
      this.log(`${chalk.cyan((i + 1) + '.')} ${this.getTypeIcon(result.type)} ${chalk.bold(result.name)}`);
      this.log(`   Framework: ${chalk.yellow(result.framework)}`);
      this.log(`   Category: ${chalk.yellow(result.category || 'N/A')}`);
      this.log(`   Score: ${chalk.green((result.score * 100).toFixed(1) + '%')}`);
      this.log(`   Description: ${result.description}`);

      if (result.type === 'component') {
        if (result.props?.length > 0) {
          this.log(`   Props: ${chalk.cyan(result.props.slice(0, 5).join(', '))}${result.props.length > 5 ? '...' : ''}`);
        }
        if (result.events?.length > 0) {
          this.log(`   Events: ${chalk.cyan(result.events.join(', '))}`);
        }
        if (result.examples > 0) {
          this.log(`   Examples: ${chalk.green(result.examples)} available`);
        }
      }

      if (result.type === 'prop') {
        this.log(`   Component: ${chalk.cyan(result.component)}`);
        this.log(`   Type: ${chalk.yellow(result.type)}`);
        this.log(`   Default: ${chalk.gray(result.default || 'none')}`);
        this.log(`   Required: ${result.required ? chalk.red('Yes') : chalk.green('No')}`);
      }

      if (result.type === 'example') {
        this.log(`   Components: ${chalk.cyan(result.components?.join(', ') || 'N/A')}`);
        if (result.code) {
          this.log(`   Code Preview: ${chalk.gray(result.code.substring(0, 50) + '...')}`);
        }
      }

      this.log(`   Path: ${chalk.gray(result.path)}`);
    }
  }

  private getTypeIcon(type: string): string {
    const icons = {
      component: '🧩',
      prop: '⚙️',
      event: '⚡',
      example: '📝',
      docs: '📚',
    };
    return icons[type as keyof typeof icons] || '📄';
  }

  private suggestAlternatives(query: string): void {
    this.log('');
    this.log(chalk.yellow('💡 Search Tips:'));
    this.log('   • Try different keywords or synonyms');
    this.log('   • Use broader terms (e.g., "form" instead of "login form")');
    this.log('   • Check spelling and try partial matches');
    this.log('   • Use --framework flag to search specific frameworks');
    this.log('   • Lower the similarity threshold with --similarity');
    this.log('');
    
    // Suggest similar terms
    const suggestions = this.generateSuggestions(query);
    if (suggestions.length > 0) {
      this.log(chalk.blue('🔍 Did you mean:'));
      for (const suggestion of suggestions) {
        this.log(`   • ${chalk.cyan(suggestion)}`);
      }
    }
  }

  private generateSuggestions(query: string): string[] {
    // Mock suggestion generation
    const commonTerms = [
      'button', 'input', 'form', 'modal', 'table', 'card', 'menu', 'dropdown',
      'navigation', 'layout', 'grid', 'list', 'dialog', 'tooltip', 'badge',
      'avatar', 'progress', 'loading', 'spinner', 'alert', 'notification',
    ];

    return commonTerms
      .filter(term => term.includes(query.toLowerCase()) || query.toLowerCase().includes(term))
      .slice(0, 3);
  }

  private async exploreResults(results: any[]): Promise<void> {
    const choices = results.map((r, i) => ({
      name: `${i + 1}. ${r.name} (${r.type}) - ${r.framework}`,
      value: i,
    }));

    choices.push({ name: 'Exit', value: -1 });

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: 'Select a result to explore:',
        choices,
      },
    ]);

    if (answer.selection === -1) {
      return;
    }

    const selected = results[answer.selection];
    await this.exploreResult(selected);

    // Ask if they want to explore more
    const continueAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Explore another result?',
        default: false,
      },
    ]);

    if (continueAnswer.continue) {
      await this.exploreResults(results);
    }
  }

  private async exploreResult(result: any): Promise<void> {
    this.log('');
    this.log(chalk.blue(`🔍 Exploring: ${result.name}`));
    this.log(chalk.gray('=' .repeat(40)));

    const actions = [
      { name: 'View detailed information', value: 'details' },
      { name: 'Show usage examples', value: 'examples' },
      { name: 'Copy import statement', value: 'import' },
    ];

    if (result.type === 'component') {
      actions.push(
        { name: 'List all properties', value: 'props' },
        { name: 'List all events', value: 'events' }
      );
    }

    actions.push({ name: 'Back to results', value: 'back' });

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: actions,
      },
    ]);

    switch (answer.action) {
      case 'details':
        this.showDetailedInfo(result);
        break;
      case 'examples':
        await this.showExamples(result);
        break;
      case 'import':
        this.showImportStatement(result);
        break;
      case 'props':
        this.showProperties(result);
        break;
      case 'events':
        this.showEvents(result);
        break;
      case 'back':
        return;
    }

    // Ask if they want to perform another action
    const continueAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Perform another action?',
        default: false,
      },
    ]);

    if (continueAnswer.continue) {
      await this.exploreResult(result);
    }
  }

  private showDetailedInfo(result: any): void {
    this.log('');
    this.log(chalk.blue('📄 Detailed Information'));
    this.log(chalk.gray('-'.repeat(30)));
    this.log(`Name: ${chalk.cyan(result.name)}`);
    this.log(`Type: ${chalk.yellow(result.type)}`);
    this.log(`Framework: ${chalk.yellow(result.framework)}`);
    this.log(`Category: ${chalk.yellow(result.category || 'N/A')}`);
    this.log(`Description: ${result.description}`);
    this.log(`Path: ${chalk.gray(result.path)}`);
    this.log(`Relevance Score: ${chalk.green((result.score * 100).toFixed(1) + '%')}`);
  }

  private async showExamples(result: any): Promise<void> {
    this.log('');
    this.log(chalk.blue('📝 Usage Examples'));
    this.log(chalk.gray('-'.repeat(30)));

    // Mock examples
    const examples = [
      {
        title: 'Basic Usage',
        code: `<${result.name} variant="primary">Click me</${result.name}>`,
      },
      {
        title: 'With Props',
        code: `<${result.name} variant="secondary" size="large" disabled>Disabled</${result.name}>`,
      },
    ];

    for (const example of examples) {
      this.log(`${chalk.cyan(example.title)}:`);
      this.log(chalk.gray(example.code));
      this.log('');
    }
  }

  private showImportStatement(result: any): void {
    this.log('');
    this.log(chalk.blue('📦 Import Statement'));
    this.log(chalk.gray('-'.repeat(30)));
    
    const importStatement = `import { ${result.name} } from '${result.path}';`;
    this.log(chalk.green(importStatement));
    
    this.log('');
    this.log(chalk.gray('💡 Copy the import statement above to use this component'));
  }

  private showProperties(result: any): void {
    this.log('');
    this.log(chalk.blue('⚙️ Component Properties'));
    this.log(chalk.gray('-'.repeat(30)));

    if (result.props && result.props.length > 0) {
      for (const prop of result.props) {
        this.log(`• ${chalk.cyan(prop)}`);
      }
    } else {
      this.log(chalk.gray('No properties available'));
    }
  }

  private showEvents(result: any): void {
    this.log('');
    this.log(chalk.blue('⚡ Component Events'));
    this.log(chalk.gray('-'.repeat(30)));

    if (result.events && result.events.length > 0) {
      for (const event of result.events) {
        this.log(`• ${chalk.cyan(event)}`);
      }
    } else {
      this.log(chalk.gray('No events available'));
    }
  }
}