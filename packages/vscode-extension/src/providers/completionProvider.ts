import * as vscode from 'vscode';
import { KPCApiClient } from '../services/apiClient';
import { ConfigurationManager } from '../services/configurationManager';
import { ComponentInfo, PropInfo, EventInfo } from '../types';

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private apiClient: KPCApiClient,
    private configManager: ConfigurationManager
  ) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    if (!this.configManager.get('autoCompletion')) {
      return [];
    }

    const line = document.lineAt(position);
    const lineText = line.text;
    const beforeCursor = lineText.substring(0, position.character);
    const afterCursor = lineText.substring(position.character);

    // Determine completion type based on context
    const completionType = this.getCompletionType(beforeCursor, afterCursor, document.languageId);
    
    switch (completionType) {
      case 'component':
        return this.getComponentCompletions(beforeCursor, document.languageId);
      case 'prop':
        return this.getPropCompletions(beforeCursor, document.languageId);
      case 'event':
        return this.getEventCompletions(beforeCursor, document.languageId);
      case 'value':
        return this.getValueCompletions(beforeCursor, document.languageId);
      case 'import':
        return this.getImportCompletions(beforeCursor, document.languageId);
      default:
        return [];
    }
  }

  private getCompletionType(
    beforeCursor: string, 
    afterCursor: string, 
    languageId: string
  ): string {
    // Check for component tag completion
    if (beforeCursor.match(/<[A-Z]\w*$/)) {
      return 'component';
    }

    // Check for prop completion
    if (beforeCursor.match(/<[A-Z]\w+\s+\w*$/)) {
      return 'prop';
    }

    // Check for event completion (React)
    if (languageId.includes('react') && beforeCursor.match(/\s+on[A-Z]\w*$/)) {
      return 'event';
    }

    // Check for event completion (Vue)
    if (languageId === 'vue' && beforeCursor.match(/\s+@\w*$/)) {
      return 'event';
    }

    // Check for prop value completion
    if (beforeCursor.match(/\w+="[^"]*$/)) {
      return 'value';
    }

    // Check for import completion
    if (beforeCursor.match(/import\s+.*from\s+["'][^"']*$/)) {
      return 'import';
    }

    return 'unknown';
  }

  private async getComponentCompletions(
    beforeCursor: string, 
    languageId: string
  ): Promise<vscode.CompletionItem[]> {
    try {
      const framework = this.getFrameworkFromLanguage(languageId);
      const components = await this.apiClient.searchComponents('', { framework });
      
      return components.map(component => {
        const item = new vscode.CompletionItem(
          component.name,
          vscode.CompletionItemKind.Class
        );
        
        item.detail = `${component.framework} component`;
        item.documentation = new vscode.MarkdownString(
          `**${component.name}**\n\n${component.description}\n\n` +
          `**Props:** ${component.props?.length || 0}\n` +
          `**Events:** ${component.events?.length || 0}`
        );
        
        // Generate snippet with common props
        const snippet = this.generateComponentSnippet(component, languageId);
        item.insertText = new vscode.SnippetString(snippet);
        
        item.sortText = `0${component.name}`; // Prioritize components
        item.filterText = component.name;
        
        // Add import statement if needed
        item.additionalTextEdits = this.generateImportEdit(component, languageId);
        
        return item;
      });
    } catch (error) {
      console.error('Failed to get component completions:', error);
      return [];
    }
  }

  private async getPropCompletions(
    beforeCursor: string, 
    languageId: string
  ): Promise<vscode.CompletionItem[]> {
    const componentMatch = beforeCursor.match(/<([A-Z]\w+)/);
    if (!componentMatch) return [];

    const componentName = componentMatch[1];
    
    try {
      const component = await this.apiClient.getComponent(componentName);
      if (!component || !component.props) return [];

      return component.props.map(prop => {
        const item = new vscode.CompletionItem(
          prop.name,
          vscode.CompletionItemKind.Property
        );
        
        item.detail = `${prop.type}${prop.required ? ' (required)' : ''}`;
        item.documentation = new vscode.MarkdownString(
          `**${prop.name}**: \`${prop.type}\`\n\n` +
          `${prop.description || 'No description available'}\n\n` +
          `${prop.required ? '**Required**' : '**Optional**'}` +
          (prop.default ? `\n\n**Default:** \`${prop.default}\`` : '')
        );
        
        // Generate prop snippet with appropriate value
        const snippet = this.generatePropSnippet(prop, languageId);
        item.insertText = new vscode.SnippetString(snippet);
        
        item.sortText = prop.required ? `0${prop.name}` : `1${prop.name}`;
        
        return item;
      });
    } catch (error) {
      console.error('Failed to get prop completions:', error);
      return [];
    }
  }

  private async getEventCompletions(
    beforeCursor: string, 
    languageId: string
  ): Promise<vscode.CompletionItem[]> {
    const componentMatch = beforeCursor.match(/<([A-Z]\w+)/);
    if (!componentMatch) return [];

    const componentName = componentMatch[1];
    
    try {
      const component = await this.apiClient.getComponent(componentName);
      if (!component || !component.events) return [];

      return component.events.map(event => {
        const item = new vscode.CompletionItem(
          event.name,
          vscode.CompletionItemKind.Event
        );
        
        item.detail = `Event: ${event.type || 'void'}`;
        item.documentation = new vscode.MarkdownString(
          `**${event.name}**\n\n${event.description || 'No description available'}\n\n` +
          (event.payload ? `**Payload:** \`${event.payload}\`` : '')
        );
        
        // Generate event handler snippet
        const snippet = this.generateEventSnippet(event, languageId);
        item.insertText = new vscode.SnippetString(snippet);
        
        item.sortText = `0${event.name}`;
        
        return item;
      });
    } catch (error) {
      console.error('Failed to get event completions:', error);
      return [];
    }
  }

  private async getValueCompletions(
    beforeCursor: string, 
    languageId: string
  ): Promise<vscode.CompletionItem[]> {
    // Extract prop name and component
    const propMatch = beforeCursor.match(/(\w+)="[^"]*$/);
    const componentMatch = beforeCursor.match(/<([A-Z]\w+)/);
    
    if (!propMatch || !componentMatch) return [];

    const propName = propMatch[1];
    const componentName = componentMatch[1];
    
    try {
      const component = await this.apiClient.getComponent(componentName);
      if (!component || !component.props) return [];

      const prop = component.props.find(p => p.name === propName);
      if (!prop) return [];

      // Generate value completions based on prop type
      return this.generateValueCompletions(prop);
    } catch (error) {
      console.error('Failed to get value completions:', error);
      return [];
    }
  }

  private async getImportCompletions(
    beforeCursor: string, 
    languageId: string
  ): Promise<vscode.CompletionItem[]> {
    const framework = this.getFrameworkFromLanguage(languageId);
    
    try {
      const components = await this.apiClient.searchComponents('', { framework });
      
      return components.map(component => {
        const item = new vscode.CompletionItem(
          component.import?.module || '@kpc/components',
          vscode.CompletionItemKind.Module
        );
        
        item.detail = `Import ${component.name}`;
        item.documentation = new vscode.MarkdownString(
          `Import ${component.name} component from ${component.import?.module}`
        );
        
        item.insertText = component.import?.module || '@kpc/components';
        item.sortText = `0${component.import?.module}`;
        
        return item;
      });
    } catch (error) {
      console.error('Failed to get import completions:', error);
      return [];
    }
  }

  private generateComponentSnippet(component: ComponentInfo, languageId: string): string {
    const requiredProps = component.props?.filter(p => p.required) || [];
    
    if (languageId === 'vue') {
      let snippet = `${component.name}`;
      
      if (requiredProps.length > 0) {
        requiredProps.forEach((prop, index) => {
          snippet += `\n  ${prop.name}="\${${index + 1}:${prop.default || ''}}"`;
        });
      }
      
      if (component.slots && component.slots.length > 0) {
        snippet += `>\n  \${${requiredProps.length + 1}:content}\n</${component.name}`;
      } else {
        snippet += ` />`;
      }
      
      return snippet;
    } else {
      // React
      let snippet = `${component.name}`;
      
      if (requiredProps.length > 0) {
        requiredProps.forEach((prop, index) => {
          const value = prop.type === 'string' 
            ? `"\${${index + 1}:${prop.default || ''}}"` 
            : `{\${${index + 1}:${prop.default || ''}}}`;
          snippet += `\n  ${prop.name}=${value}`;
        });
      }
      
      snippet += requiredProps.length > 0 ? `\n/>` : ` />`;
      
      return snippet;
    }
  }

  private generatePropSnippet(prop: PropInfo, languageId: string): string {
    if (languageId === 'vue') {
      if (prop.type === 'boolean') {
        return prop.name;
      } else if (prop.type === 'string') {
        return `${prop.name}="\${1:${prop.default || ''}}"`;
      } else {
        return `${prop.name}="$1"`;
      }
    } else {
      // React
      if (prop.type === 'boolean') {
        return `${prop.name}={$1}`;
      } else if (prop.type === 'string') {
        return `${prop.name}="\${1:${prop.default || ''}}"`;
      } else {
        return `${prop.name}={$1}`;
      }
    }
  }

  private generateEventSnippet(event: EventInfo, languageId: string): string {
    if (languageId === 'vue') {
      return `@${event.name}="\${1:handle${this.capitalize(event.name)}}"`;
    } else {
      // React
      return `on${this.capitalize(event.name)}={\${1:handle${this.capitalize(event.name)}}}`;
    }
  }

  private generateValueCompletions(prop: PropInfo): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];
    
    // Handle enum values
    if (prop.enum && prop.enum.length > 0) {
      prop.enum.forEach(value => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember);
        item.detail = `Enum value for ${prop.name}`;
        item.insertText = value;
        completions.push(item);
      });
    }
    
    // Handle boolean values
    if (prop.type === 'boolean') {
      ['true', 'false'].forEach(value => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
        item.detail = `Boolean value`;
        item.insertText = value;
        completions.push(item);
      });
    }
    
    // Handle common string patterns
    if (prop.type === 'string') {
      const commonValues = this.getCommonStringValues(prop.name);
      commonValues.forEach(value => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
        item.detail = `Common value for ${prop.name}`;
        item.insertText = value;
        completions.push(item);
      });
    }
    
    return completions;
  }

  private getCommonStringValues(propName: string): string[] {
    const commonValues: { [key: string]: string[] } = {
      size: ['small', 'medium', 'large'],
      variant: ['primary', 'secondary', 'success', 'warning', 'danger'],
      type: ['button', 'submit', 'reset'],
      align: ['left', 'center', 'right'],
      position: ['top', 'bottom', 'left', 'right'],
      theme: ['light', 'dark'],
      status: ['success', 'warning', 'error', 'info'],
    };
    
    return commonValues[propName.toLowerCase()] || [];
  }

  private generateImportEdit(component: ComponentInfo, languageId: string): vscode.TextEdit[] {
    if (!component.import) return [];
    
    // This would need to check if import already exists and add it if not
    // For now, return empty array
    return [];
  }

  private getFrameworkFromLanguage(languageId: string): string {
    if (languageId.includes('react')) return 'react';
    if (languageId === 'vue') return 'vue';
    return this.configManager.get('framework') || 'react';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}