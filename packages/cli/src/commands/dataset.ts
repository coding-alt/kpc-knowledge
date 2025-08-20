import { Command, Flags } from '@oclif/core';
import { GoldenDatasetBuilder } from '@kpc/shared/golden-dataset/dataset-builder';
import { sampleEntries } from '@kpc/shared/golden-dataset/sample-entries';
import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

export default class Dataset extends Command {
  static description = 'Manage golden dataset for testing and validation';

  static examples = [
    '<%= config.bin %> <%= command.id %> init',
    '<%= config.bin %> <%= command.id %> add --file entry.json',
    '<%= config.bin %> <%= command.id %> validate',
    '<%= config.bin %> <%= command.id %> report',
    '<%= config.bin %> <%= command.id %> export --output dataset.json',
  ];

  static flags = {
    help: Flags.help({ char: 'h' }),
    path: Flags.string({
      char: 'p',
      description: 'Path to dataset directory',
      default: './golden-dataset',
    }),
    file: Flags.string({
      char: 'f',
      description: 'Path to entry file (for add command)',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path (for export command)',
    }),
    samples: Flags.boolean({
      char: 's',
      description: 'Include sample entries (for init command)',
      default: false,
    }),
    category: Flags.string({
      char: 'c',
      description: 'Filter by category',
    }),
    framework: Flags.string({
      description: 'Filter by framework',
    }),
    difficulty: Flags.string({
      char: 'd',
      description: 'Filter by difficulty range (e.g., "1-5")',
    }),
    count: Flags.integer({
      char: 'n',
      description: 'Number of entries to sample',
      default: 10,
    }),
  };

  static args = [
    {
      name: 'action',
      required: true,
      description: 'Action to perform',
      options: ['init', 'add', 'update', 'remove', 'list', 'validate', 'report', 'export', 'import', 'sample'],
    },
    {
      name: 'id',
      required: false,
      description: 'Entry ID (for update/remove actions)',
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Dataset);
    const { action, id } = args;
    const { path: datasetPath, file, output, samples, category, framework, difficulty, count } = flags;

    const builder = new GoldenDatasetBuilder(datasetPath);

    try {
      switch (action) {
        case 'init':
          await this.initDataset(builder, samples);
          break;
        case 'add':
          await this.addEntry(builder, file);
          break;
        case 'update':
          await this.updateEntry(builder, id, file);
          break;
        case 'remove':
          await this.removeEntry(builder, id);
          break;
        case 'list':
          await this.listEntries(builder, { category, framework, difficulty });
          break;
        case 'validate':
          await this.validateDataset(builder);
          break;
        case 'report':
          await this.generateReport(builder);
          break;
        case 'export':
          await this.exportDataset(builder, output);
          break;
        case 'import':
          await this.importDataset(builder, file);
          break;
        case 'sample':
          await this.sampleEntries(builder, count, { category, framework, difficulty });
          break;
        default:
          this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.error(`Failed to ${action}: ${error.message}`);
    }
  }

  private async initDataset(builder: GoldenDatasetBuilder, includeSamples: boolean): Promise<void> {
    this.log(chalk.blue('Initializing golden dataset...'));

    if (includeSamples) {
      this.log(chalk.yellow('Adding sample entries...'));
      for (const entry of sampleEntries) {
        try {
          builder.addEntry(entry);
          this.log(chalk.green(`✓ Added sample entry: ${entry.name}`));
        } catch (error) {
          this.log(chalk.red(`✗ Failed to add ${entry.name}: ${error.message}`));
        }
      }
    }

    const stats = builder.getStatistics();
    this.log(chalk.green(`\n✓ Dataset initialized with ${stats.totalEntries} entries`));
  }

  private async addEntry(builder: GoldenDatasetBuilder, filePath?: string): Promise<void> {
    if (!filePath) {
      this.error('File path is required for add command');
    }

    if (!existsSync(filePath)) {
      this.error(`File not found: ${filePath}`);
    }

    const entryData = require(join(process.cwd(), filePath));
    builder.addEntry(entryData);

    this.log(chalk.green(`✓ Added entry: ${entryData.name}`));
  }

  private async updateEntry(builder: GoldenDatasetBuilder, id?: string, filePath?: string): Promise<void> {
    if (!id) {
      this.error('Entry ID is required for update command');
    }

    if (!filePath) {
      this.error('File path is required for update command');
    }

    if (!existsSync(filePath)) {
      this.error(`File not found: ${filePath}`);
    }

    const updates = require(join(process.cwd(), filePath));
    builder.updateEntry(id, updates);

    this.log(chalk.green(`✓ Updated entry: ${id}`));
  }

  private async removeEntry(builder: GoldenDatasetBuilder, id?: string): Promise<void> {
    if (!id) {
      this.error('Entry ID is required for remove command');
    }

    builder.removeEntry(id);
    this.log(chalk.green(`✓ Removed entry: ${id}`));
  }

  private async listEntries(
    builder: GoldenDatasetBuilder,
    filters: { category?: string; framework?: string; difficulty?: string }
  ): Promise<void> {
    const stats = builder.getStatistics();
    let entries = builder['dataset'].entries;

    // Apply filters
    if (filters.category) {
      entries = entries.filter(e => e.category === filters.category);
    }

    if (filters.framework) {
      entries = entries.filter(e => e.framework === filters.framework || e.framework === 'multi-framework');
    }

    if (filters.difficulty) {
      const [min, max] = filters.difficulty.split('-').map(Number);
      entries = entries.filter(e => e.metadata.difficulty >= min && e.metadata.difficulty <= max);
    }

    this.log(chalk.blue(`\nDataset Entries (${entries.length} of ${stats.totalEntries} total):\n`));

    const table = entries.map(entry => ({
      ID: entry.id,
      Name: entry.name,
      Category: entry.category,
      Framework: entry.framework,
      Difficulty: entry.metadata.difficulty,
      'Success Rate': `${(entry.metadata.successRate * 100).toFixed(1)}%`,
      Status: entry.metadata.validationStatus,
    }));

    console.table(table);
  }

  private async validateDataset(builder: GoldenDatasetBuilder): Promise<void> {
    this.log(chalk.blue('Validating dataset...'));

    const validation = builder.validateDataset();

    if (validation.valid) {
      this.log(chalk.green('✓ Dataset validation passed'));
    } else {
      this.log(chalk.red('✗ Dataset validation failed:'));
      for (const error of validation.errors) {
        this.log(chalk.red(`  - ${error}`));
      }
    }

    const stats = builder.getStatistics();
    this.log(chalk.blue(`\nDataset Statistics:`));
    this.log(`Total Entries: ${stats.totalEntries}`);
    this.log(`Average Success Rate: ${(stats.averageSuccessRate * 100).toFixed(1)}%`);
    this.log(`Coverage: ${stats.coverageMetrics.componentTypes.length} component types`);
  }

  private async generateReport(builder: GoldenDatasetBuilder): Promise<void> {
    this.log(chalk.blue('Generating dataset report...'));

    const report = builder.generateReport();
    this.log(report);
  }

  private async exportDataset(builder: GoldenDatasetBuilder, outputPath?: string): Promise<void> {
    const exportPath = builder.exportToJSON(outputPath);
    this.log(chalk.green(`✓ Dataset exported to: ${exportPath}`));
  }

  private async importDataset(builder: GoldenDatasetBuilder, filePath?: string): Promise<void> {
    if (!filePath) {
      this.error('File path is required for import command');
    }

    if (!existsSync(filePath)) {
      this.error(`File not found: ${filePath}`);
    }

    builder.importFromJSON(filePath);
    this.log(chalk.green(`✓ Dataset imported from: ${filePath}`));
  }

  private async sampleEntries(
    builder: GoldenDatasetBuilder,
    count: number,
    filters: { category?: string; framework?: string; difficulty?: string }
  ): Promise<void> {
    let sampleFilters: any = {};

    if (filters.category) {
      sampleFilters.category = filters.category;
    }

    if (filters.framework) {
      sampleFilters.framework = filters.framework;
    }

    if (filters.difficulty) {
      const [min, max] = filters.difficulty.split('-').map(Number);
      sampleFilters.difficulty = { min, max };
    }

    const sample = builder.getRandomSample(count, sampleFilters);

    this.log(chalk.blue(`\nRandom Sample (${sample.length} entries):\n`));

    const table = sample.map(entry => ({
      ID: entry.id,
      Name: entry.name,
      Category: entry.category,
      Framework: entry.framework,
      Difficulty: entry.metadata.difficulty,
      'Success Rate': `${(entry.metadata.successRate * 100).toFixed(1)}%`,
    }));

    console.table(table);
  }
}