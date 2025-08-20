import * as vscode from 'vscode';

export class ConfigurationManager {
  private configuration: vscode.WorkspaceConfiguration;

  constructor() {
    this.configuration = vscode.workspace.getConfiguration('kpc');
  }

  reload(): void {
    this.configuration = vscode.workspace.getConfiguration('kpc');
  }

  get<T>(key: string): T {
    return this.configuration.get<T>(key) as T;
  }

  async set(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void> {
    await this.configuration.update(key, value, target || vscode.ConfigurationTarget.Workspace);
  }

  has(key: string): boolean {
    return this.configuration.has(key);
  }

  inspect(key: string) {
    return this.configuration.inspect(key);
  }

  // Convenience methods for common settings
  getApiEndpoint(): string {
    return this.get<string>('apiEndpoint') || 'http://localhost:4000/graphql';
  }

  getFramework(): string {
    const framework = this.get<string>('framework');
    if (framework === 'auto') {
      return this.detectFramework();
    }
    return framework || 'react';
  }

  isTypeScriptEnabled(): boolean {
    return this.get<boolean>('typescript') ?? true;
  }

  isAutoCompletionEnabled(): boolean {
    return this.get<boolean>('autoCompletion') ?? true;
  }

  isRealTimeValidationEnabled(): boolean {
    return this.get<boolean>('realTimeValidation') ?? true;
  }

  shouldShowInlineHints(): boolean {
    return this.get<boolean>('showInlineHints') ?? true;
  }

  shouldShowPreviewOnHover(): boolean {
    return this.get<boolean>('previewOnHover') ?? true;
  }

  private detectFramework(): string {
    // Try to detect framework from workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return 'react';

    for (const folder of workspaceFolders) {
      try {
        const packageJsonUri = vscode.Uri.joinPath(folder.uri, 'package.json');
        vscode.workspace.fs.readFile(packageJsonUri).then(content => {
          const packageJson = JSON.parse(content.toString());
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
          
          if (dependencies.react) return 'react';
          if (dependencies.vue) return 'vue';
          if (dependencies.intact) return 'intact';
        });
      } catch (error) {
        // Ignore errors reading package.json
      }
    }

    return 'react'; // Default fallback
  }

  // Get all configuration as object
  getAll(): { [key: string]: any } {
    return {
      apiEndpoint: this.getApiEndpoint(),
      framework: this.getFramework(),
      typescript: this.isTypeScriptEnabled(),
      autoCompletion: this.isAutoCompletionEnabled(),
      realTimeValidation: this.isRealTimeValidationEnabled(),
      showInlineHints: this.shouldShowInlineHints(),
      previewOnHover: this.shouldShowPreviewOnHover(),
    };
  }

  // Validate configuration
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const apiEndpoint = this.getApiEndpoint();
    if (!apiEndpoint || !this.isValidUrl(apiEndpoint)) {
      errors.push('Invalid API endpoint URL');
    }

    const framework = this.getFramework();
    if (!['react', 'vue', 'intact'].includes(framework)) {
      errors.push('Invalid framework selection');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Reset to defaults
  async resetToDefaults(): Promise<void> {
    const defaultSettings = {
      apiEndpoint: 'http://localhost:4000/graphql',
      framework: 'auto',
      typescript: true,
      autoCompletion: true,
      realTimeValidation: true,
      showInlineHints: true,
      previewOnHover: true,
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await this.set(key, value);
    }
  }
}