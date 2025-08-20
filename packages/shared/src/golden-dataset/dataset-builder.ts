import { 
  GoldenDataset, 
  GoldenDatasetEntry, 
  DatasetMetadata, 
  DatasetStatistics,
  CoverageMetrics 
} from '../types/golden-dataset';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Golden Dataset Builder
 * 
 * Manages the creation, validation, and maintenance of golden datasets
 * for testing and validation of the KPC Knowledge System
 */
export class GoldenDatasetBuilder {
  private dataset: GoldenDataset;
  private datasetPath: string;

  constructor(datasetPath: string = './golden-dataset') {
    this.datasetPath = datasetPath;
    this.dataset = this.loadOrCreateDataset();
  }

  /**
   * Add a new entry to the golden dataset
   */
  addEntry(entry: GoldenDatasetEntry): void {
    // Validate entry
    this.validateEntry(entry);

    // Check for duplicates
    const existingEntry = this.dataset.entries.find(e => e.id === entry.id);
    if (existingEntry) {
      throw new Error(`Entry with ID ${entry.id} already exists`);
    }

    // Add entry
    this.dataset.entries.push(entry);
    this.updateStatistics();
    this.save();
  }

  /**
   * Update an existing entry
   */
  updateEntry(id: string, updates: Partial<GoldenDatasetEntry>): void {
    const entryIndex = this.dataset.entries.findIndex(e => e.id === id);
    if (entryIndex === -1) {
      throw new Error(`Entry with ID ${id} not found`);
    }

    const updatedEntry = { 
      ...this.dataset.entries[entryIndex], 
      ...updates,
      updatedAt: new Date()
    };

    this.validateEntry(updatedEntry);
    this.dataset.entries[entryIndex] = updatedEntry;
    this.updateStatistics();
    this.save();
  }

  /**
   * Remove an entry from the dataset
   */
  removeEntry(id: string): void {
    const entryIndex = this.dataset.entries.findIndex(e => e.id === id);
    if (entryIndex === -1) {
      throw new Error(`Entry with ID ${id} not found`);
    }

    this.dataset.entries.splice(entryIndex, 1);
    this.updateStatistics();
    this.save();
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): GoldenDatasetEntry | undefined {
    return this.dataset.entries.find(e => e.id === id);
  }

  /**
   * Get entries by category
   */
  getEntriesByCategory(category: string): GoldenDatasetEntry[] {
    return this.dataset.entries.filter(e => e.category === category);
  }

  /**
   * Get entries by framework
   */
  getEntriesByFramework(framework: string): GoldenDatasetEntry[] {
    return this.dataset.entries.filter(e => e.framework === framework || e.framework === 'multi-framework');
  }

  /**
   * Get entries by difficulty range
   */
  getEntriesByDifficulty(minDifficulty: number, maxDifficulty: number): GoldenDatasetEntry[] {
    return this.dataset.entries.filter(e => 
      e.metadata.difficulty >= minDifficulty && e.metadata.difficulty <= maxDifficulty
    );
  }

  /**
   * Get random sample of entries
   */
  getRandomSample(count: number, filters?: {
    category?: string;
    framework?: string;
    difficulty?: { min: number; max: number };
  }): GoldenDatasetEntry[] {
    let entries = this.dataset.entries;

    if (filters) {
      if (filters.category) {
        entries = entries.filter(e => e.category === filters.category);
      }
      if (filters.framework) {
        entries = entries.filter(e => e.framework === filters.framework || e.framework === 'multi-framework');
      }
      if (filters.difficulty) {
        entries = entries.filter(e => 
          e.metadata.difficulty >= filters.difficulty!.min && 
          e.metadata.difficulty <= filters.difficulty!.max
        );
      }
    }

    // Shuffle and take sample
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Validate dataset integrity
   */
  validateDataset(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate IDs
    const ids = this.dataset.entries.map(e => e.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate entry IDs found: ${duplicateIds.join(', ')}`);
    }

    // Validate each entry
    for (const entry of this.dataset.entries) {
      try {
        this.validateEntry(entry);
      } catch (error) {
        errors.push(`Entry ${entry.id}: ${error.message}`);
      }
    }

    // Check coverage requirements
    const coverage = this.calculateCoverage();
    if (coverage.componentTypes.length < 10) {
      errors.push('Insufficient component type coverage (minimum 10 required)');
    }
    if (coverage.interactionPatterns.length < 5) {
      errors.push('Insufficient interaction pattern coverage (minimum 5 required)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate dataset report
   */
  generateReport(): string {
    const stats = this.dataset.statistics;
    const coverage = this.calculateCoverage();

    return `
# Golden Dataset Report

## Overview
- **Total Entries**: ${stats.totalEntries}
- **Average Success Rate**: ${(stats.averageSuccessRate * 100).toFixed(1)}%
- **Last Updated**: ${this.dataset.metadata.updatedAt.toISOString()}

## Distribution by Category
${Object.entries(stats.byCategory).map(([cat, count]) => `- ${cat}: ${count}`).join('\n')}

## Distribution by Framework
${Object.entries(stats.byFramework).map(([fw, count]) => `- ${fw}: ${count}`).join('\n')}

## Distribution by Difficulty
${Object.entries(stats.byDifficulty).map(([diff, count]) => `- Level ${diff}: ${count}`).join('\n')}

## Coverage Metrics
- **Component Types**: ${coverage.componentTypes.length} (${coverage.componentTypes.join(', ')})
- **Interaction Patterns**: ${coverage.interactionPatterns.length} (${coverage.interactionPatterns.join(', ')})
- **Layout Types**: ${coverage.layoutTypes.length} (${coverage.layoutTypes.join(', ')})
- **Accessibility Features**: ${coverage.accessibilityFeatures.length}
- **Performance Scenarios**: ${coverage.performanceScenarios.length}

## Quality Metrics
- **Entries with High Success Rate (>90%)**: ${this.dataset.entries.filter(e => e.metadata.successRate > 0.9).length}
- **Entries Needing Review**: ${this.dataset.entries.filter(e => e.metadata.validationStatus === 'needs-review').length}
- **Most Common Errors**: ${this.getMostCommonErrors().slice(0, 5).join(', ')}
`;
  }

  /**
   * Export dataset to JSON
   */
  exportToJSON(filePath?: string): string {
    const exportPath = filePath || join(this.datasetPath, `golden-dataset-${this.dataset.metadata.version}.json`);
    const jsonData = JSON.stringify(this.dataset, null, 2);
    writeFileSync(exportPath, jsonData, 'utf8');
    return exportPath;
  }

  /**
   * Import dataset from JSON
   */
  importFromJSON(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Dataset file not found: ${filePath}`);
    }

    const jsonData = readFileSync(filePath, 'utf8');
    const importedDataset = JSON.parse(jsonData) as GoldenDataset;

    // Validate imported dataset
    const validation = this.validateImportedDataset(importedDataset);
    if (!validation.valid) {
      throw new Error(`Invalid dataset: ${validation.errors.join(', ')}`);
    }

    this.dataset = importedDataset;
    this.save();
  }

  /**
   * Get dataset statistics
   */
  getStatistics(): DatasetStatistics {
    return this.dataset.statistics;
  }

  /**
   * Get dataset metadata
   */
  getMetadata(): DatasetMetadata {
    return this.dataset.metadata;
  }

  private loadOrCreateDataset(): GoldenDataset {
    const metadataPath = join(this.datasetPath, 'metadata.json');
    const entriesPath = join(this.datasetPath, 'entries.json');

    if (!existsSync(this.datasetPath)) {
      mkdirSync(this.datasetPath, { recursive: true });
    }

    if (existsSync(metadataPath) && existsSync(entriesPath)) {
      // Load existing dataset
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as DatasetMetadata;
      const entries = JSON.parse(readFileSync(entriesPath, 'utf8')) as GoldenDatasetEntry[];

      const dataset: GoldenDataset = {
        version: metadata.version,
        entries,
        metadata,
        statistics: this.calculateStatistics(entries)
      };

      return dataset;
    } else {
      // Create new dataset
      const metadata: DatasetMetadata = {
        name: 'KPC Knowledge System Golden Dataset',
        description: 'Comprehensive test dataset for validating code generation and validation accuracy',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        authors: ['KPC Team'],
        license: 'MIT',
        tags: ['testing', 'validation', 'golden-standard']
      };

      const dataset: GoldenDataset = {
        version: metadata.version,
        entries: [],
        metadata,
        statistics: this.calculateStatistics([])
      };

      return dataset;
    }
  }

  private validateEntry(entry: GoldenDatasetEntry): void {
    if (!entry.id || typeof entry.id !== 'string') {
      throw new Error('Entry must have a valid ID');
    }

    if (!entry.name || typeof entry.name !== 'string') {
      throw new Error('Entry must have a valid name');
    }

    if (!entry.requirement || !entry.requirement.naturalLanguage) {
      throw new Error('Entry must have a natural language requirement');
    }

    if (!entry.expectedUAST || !entry.expectedUAST.type) {
      throw new Error('Entry must have a valid expected UAST');
    }

    if (!entry.expectedCode || Object.keys(entry.expectedCode).length === 0) {
      throw new Error('Entry must have expected code for at least one framework');
    }

    if (!entry.testCases || entry.testCases.length === 0) {
      throw new Error('Entry must have at least one test case');
    }

    if (!entry.metadata || typeof entry.metadata.difficulty !== 'number') {
      throw new Error('Entry must have valid metadata with difficulty rating');
    }

    // Validate test cases
    for (const testCase of entry.testCases) {
      if (!testCase.steps || testCase.steps.length === 0) {
        throw new Error(`Test case ${testCase.id} must have at least one step`);
      }
      if (!testCase.assertions || testCase.assertions.length === 0) {
        throw new Error(`Test case ${testCase.id} must have at least one assertion`);
      }
    }
  }

  private validateImportedDataset(dataset: GoldenDataset): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dataset.metadata || !dataset.entries) {
      errors.push('Dataset must have metadata and entries');
    }

    if (!Array.isArray(dataset.entries)) {
      errors.push('Dataset entries must be an array');
    }

    // Validate each entry
    for (const entry of dataset.entries) {
      try {
        this.validateEntry(entry);
      } catch (error) {
        errors.push(`Entry ${entry.id}: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private updateStatistics(): void {
    this.dataset.statistics = this.calculateStatistics(this.dataset.entries);
    this.dataset.metadata.updatedAt = new Date();
  }

  private calculateStatistics(entries: GoldenDatasetEntry[]): DatasetStatistics {
    const byCategory: Record<string, number> = {};
    const byFramework: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};

    let totalSuccessRate = 0;

    for (const entry of entries) {
      // Count by category
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;

      // Count by framework
      byFramework[entry.framework] = (byFramework[entry.framework] || 0) + 1;

      // Count by difficulty
      const difficultyLevel = Math.floor(entry.metadata.difficulty);
      byDifficulty[difficultyLevel] = (byDifficulty[difficultyLevel] || 0) + 1;

      // Sum success rates
      totalSuccessRate += entry.metadata.successRate || 0;
    }

    return {
      totalEntries: entries.length,
      byCategory,
      byFramework,
      byDifficulty,
      averageSuccessRate: entries.length > 0 ? totalSuccessRate / entries.length : 0,
      coverageMetrics: this.calculateCoverage()
    };
  }

  private calculateCoverage(): CoverageMetrics {
    const componentTypes = new Set<string>();
    const interactionPatterns = new Set<string>();
    const layoutTypes = new Set<string>();
    const accessibilityFeatures = new Set<string>();
    const performanceScenarios = new Set<string>();

    for (const entry of this.dataset.entries) {
      // Extract component types from UAST
      this.extractComponentTypes(entry.expectedUAST, componentTypes);

      // Extract interaction patterns
      for (const interaction of entry.requirement.structuredRequirements.interactions || []) {
        interactionPatterns.add(interaction.type);
      }

      // Extract layout types
      if (entry.requirement.structuredRequirements.layout) {
        layoutTypes.add(entry.requirement.structuredRequirements.layout.type);
      }

      // Extract accessibility features
      if (entry.requirement.structuredRequirements.accessibility) {
        for (const feature of entry.requirement.structuredRequirements.accessibility.features || []) {
          accessibilityFeatures.add(feature.type);
        }
      }

      // Extract performance scenarios
      if (entry.requirement.structuredRequirements.performance) {
        if (entry.requirement.structuredRequirements.performance.lazyLoading) {
          performanceScenarios.add('lazy-loading');
        }
        if (entry.requirement.structuredRequirements.performance.caching) {
          performanceScenarios.add('caching');
        }
      }
    }

    return {
      componentTypes: Array.from(componentTypes),
      interactionPatterns: Array.from(interactionPatterns),
      layoutTypes: Array.from(layoutTypes),
      accessibilityFeatures: Array.from(accessibilityFeatures),
      performanceScenarios: Array.from(performanceScenarios)
    };
  }

  private extractComponentTypes(node: any, componentTypes: Set<string>): void {
    if (node.type === 'component' && node.name) {
      componentTypes.add(node.name);
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractComponentTypes(child, componentTypes);
      }
    }
  }

  private getMostCommonErrors(): string[] {
    const errorCounts: Record<string, number> = {};

    for (const entry of this.dataset.entries) {
      for (const error of entry.metadata.commonErrors || []) {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      }
    }

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([error]) => error);
  }

  private save(): void {
    const metadataPath = join(this.datasetPath, 'metadata.json');
    const entriesPath = join(this.datasetPath, 'entries.json');

    writeFileSync(metadataPath, JSON.stringify(this.dataset.metadata, null, 2), 'utf8');
    writeFileSync(entriesPath, JSON.stringify(this.dataset.entries, null, 2), 'utf8');
  }
}