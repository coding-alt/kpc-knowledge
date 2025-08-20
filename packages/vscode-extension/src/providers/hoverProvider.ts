import * as vscode from 'vscode';
import { KPCApiClient } from '../services/apiClient';
import { ConfigurationManager } from '../services/configurationManager';
import { ComponentInfo } from '../types';

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private apiClient: KPCApiClient,
    private configManager: ConfigurationManager
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    if (!this.configManager.get('previewOnHover')) {
      return null;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;

    const word = document.getText(wordRange);
    const line = document.lineAt(position);
    const lineText = line.text;

    // Determine what we're hovering over
    const hoverType = this.getHoverType(word, lineText, position.character, document.languageId);
    
    switch (hoverType) {
      case 'component':
        return this.getComponentHover(word, document.languageId);
      case 'prop':
        return this.getPropHover(word, lineText, document.languageId);
      case 'event':
        return this.getEventHover(word, lineText, document.languageId);
      default:
        return null;
    }
  }

  private getHoverType(
    word: string, 
    lineText: string, 
    position: number, 
    languageId: string
  ): string {
    // Check if hovering over a component tag
    if (word.match(/^[A-Z][a-zA-Z0-9]*$/) && lineText.includes(`<${word}`)) {
      return 'component';
    }

    // Check if hovering over a prop
    if (lineText.match(new RegExp(`\\s+${word}\\s*=`))) {
      return 'prop';
    }

    // Check if hovering over an event (React)
    if (languageId.includes('react') && word.startsWith('on') && word.match(/^on[A-Z]/)) {
      return 'event';
    }

    // Check if hovering over an event (Vue)
    if (languageId === 'vue' && lineText.includes(`@${word}`)) {
      return 'event';
    }

    return 'unknown';
  }

  private async getComponentHover(
    componentName: string, 
    languageId: string
  ): Promise<vscode.Hover | null> {
    try {
      const component = await this.apiClient.getComponent(componentName);
      if (!component) return null;

      const markdown = this.generateComponentMarkdown(component);
      return new vscode.Hover(markdown);
    } catch (error) {
      console.error('Failed to get component hover:', error);
      return null;
    }
  }

  private async getPropHover(
    propName: string, 
    lineText: string, 
    languageId: string
  ): Promise<vscode.Hover | null> {
    // Extract component name from line
    const componentMatch = lineText.match(/<([A-Z][a-zA-Z0-9]*)/);
    if (!componentMatch) return null;

    const componentName = componentMatch[1];

    try {
      const component = await this.apiClient.getComponent(componentName);
      if (!component || !component.props) return null;

      const prop = component.props.find(p => p.name === propName);
      if (!prop) return null;

      const markdown = this.generatePropMarkdown(prop, componentName);
      return new vscode.Hover(markdown);
    } catch (error) {
      console.error('Failed to get prop hover:', error);
      return null;
    }
  }

  private async getEventHover(
    eventName: string, 
    lineText: string, 
    languageId: string
  ): Promise<vscode.Hover | null> {
    // Extract component name from line
    const componentMatch = lineText.match(/<([A-Z][a-zA-Z0-9]*)/);
    if (!componentMatch) return null;

    const componentName = componentMatch[1];

    // Normalize event name (remove 'on' prefix for React)
    const normalizedEventName = languageId.includes('react') && eventName.startsWith('on')
      ? eventName.substring(2).toLowerCase()
      : eventName;

    try {
      const component = await this.apiClient.getComponent(componentName);
      if (!component || !component.events) return null;

      const event = component.events.find(e => 
        e.name.toLowerCase() === normalizedEventName.toLowerCase()
      );
      if (!event) return null;

      const markdown = this.generateEventMarkdown(event, componentName);
      return new vscode.Hover(markdown);
    } catch (error) {
      console.error('Failed to get event hover:', error);
      return null;
    }
  }

  private generateComponentMarkdown(component: ComponentInfo): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    // Component header
    markdown.appendMarkdown(`### 🧩 ${component.name}\n\n`);
    
    if (component.description) {
      markdown.appendMarkdown(`${component.description}\n\n`);
    }

    // Framework and category info
    markdown.appendMarkdown(`**Framework:** \`${component.framework}\`  \n`);
    if (component.category) {
      markdown.appendMarkdown(`**Category:** \`${component.category}\`  \n`);
    }

    // Import information
    if (component.import) {
      markdown.appendMarkdown(`**Import:** \`import { ${component.name} } from '${component.import.module}'\`\n\n`);
    }

    // Props summary
    if (component.props && component.props.length > 0) {
      const requiredProps = component.props.filter(p => p.required);
      const optionalProps = component.props.filter(p => !p.required);
      
      markdown.appendMarkdown(`**Props:** ${component.props.length} total`);
      if (requiredProps.length > 0) {
        markdown.appendMarkdown(` (${requiredProps.length} required)`);
      }
      markdown.appendMarkdown(`\n\n`);

      // Show first few props
      const propsToShow = component.props.slice(0, 5);
      propsToShow.forEach(prop => {
        const required = prop.required ? ' *(required)*' : '';
        markdown.appendMarkdown(`- **${prop.name}**: \`${prop.type}\`${required}\n`);
      });

      if (component.props.length > 5) {
        markdown.appendMarkdown(`- *...and ${component.props.length - 5} more*\n`);
      }
      markdown.appendMarkdown(`\n`);
    }

    // Events summary
    if (component.events && component.events.length > 0) {
      markdown.appendMarkdown(`**Events:** ${component.events.length}\n`);
      component.events.slice(0, 3).forEach(event => {
        markdown.appendMarkdown(`- **${event.name}**\n`);
      });
      if (component.events.length > 3) {
        markdown.appendMarkdown(`- *...and ${component.events.length - 3} more*\n`);
      }
      markdown.appendMarkdown(`\n`);
    }

    // Usage example
    if (component.examples && component.examples.length > 0) {
      const example = component.examples[0];
      markdown.appendMarkdown(`**Example:**\n\n`);
      markdown.appendCodeblock(example.code, component.framework === 'vue' ? 'vue' : 'tsx');
    } else {
      // Generate basic usage example
      const basicExample = this.generateBasicExample(component);
      markdown.appendMarkdown(`**Basic Usage:**\n\n`);
      markdown.appendCodeblock(basicExample, component.framework === 'vue' ? 'vue' : 'tsx');
    }

    // Documentation link
    if (component.docs) {
      markdown.appendMarkdown(`\n[📚 View Documentation](${component.docs})`);
    }

    return markdown;
  }

  private generatePropMarkdown(prop: any, componentName: string): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    // Prop header
    markdown.appendMarkdown(`### ⚙️ ${componentName}.${prop.name}\n\n`);

    if (prop.description) {
      markdown.appendMarkdown(`${prop.description}\n\n`);
    }

    // Type information
    markdown.appendMarkdown(`**Type:** \`${prop.type}\`\n`);
    markdown.appendMarkdown(`**Required:** ${prop.required ? '✅ Yes' : '❌ No'}\n`);

    if (prop.default !== undefined) {
      markdown.appendMarkdown(`**Default:** \`${prop.default}\`\n`);
    }

    // Enum values
    if (prop.enum && prop.enum.length > 0) {
      markdown.appendMarkdown(`**Possible Values:** ${prop.enum.map(v => `\`${v}\``).join(', ')}\n`);
    }

    // Constraints
    if (prop.constraints && prop.constraints.length > 0) {
      markdown.appendMarkdown(`\n**Constraints:**\n`);
      prop.constraints.forEach((constraint: any) => {
        markdown.appendMarkdown(`- ${constraint.type}: ${constraint.value}\n`);
      });
    }

    // Usage example
    const example = this.generatePropExample(prop, componentName);
    markdown.appendMarkdown(`\n**Example:**\n\n`);
    markdown.appendCodeblock(example, 'tsx');

    return markdown;
  }

  private generateEventMarkdown(event: any, componentName: string): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    // Event header
    markdown.appendMarkdown(`### ⚡ ${componentName}.${event.name}\n\n`);

    if (event.description) {
      markdown.appendMarkdown(`${event.description}\n\n`);
    }

    // Event information
    if (event.type) {
      markdown.appendMarkdown(`**Type:** \`${event.type}\`\n`);
    }

    if (event.payload) {
      markdown.appendMarkdown(`**Payload:** \`${event.payload}\`\n`);
    }

    // Usage example
    const example = this.generateEventExample(event, componentName);
    markdown.appendMarkdown(`\n**Example:**\n\n`);
    markdown.appendCodeblock(example, 'tsx');

    return markdown;
  }

  private generateBasicExample(component: ComponentInfo): string {
    const requiredProps = component.props?.filter(p => p.required) || [];
    
    if (component.framework === 'vue') {
      let example = `<${component.name}`;
      
      if (requiredProps.length > 0) {
        requiredProps.forEach(prop => {
          const value = prop.type === 'string' ? `"${prop.default || 'value'}"` : `"${prop.default || 'true'}"`;
          example += `\n  ${prop.name}=${value}`;
        });
      }
      
      example += ` />`;
      return example;
    } else {
      // React
      let example = `<${component.name}`;
      
      if (requiredProps.length > 0) {
        requiredProps.forEach(prop => {
          const value = prop.type === 'string' 
            ? `"${prop.default || 'value'}"` 
            : `{${prop.default || 'true'}}`;
          example += `\n  ${prop.name}=${value}`;
        });
      }
      
      example += ` />`;
      return example;
    }
  }

  private generatePropExample(prop: any, componentName: string): string {
    const value = prop.enum && prop.enum.length > 0 
      ? prop.enum[0] 
      : prop.default || (prop.type === 'string' ? 'value' : 'true');
    
    const propValue = prop.type === 'string' ? `"${value}"` : `{${value}}`;
    
    return `<${componentName} ${prop.name}=${propValue} />`;
  }

  private generateEventExample(event: any, componentName: string): string {
    const handlerName = `handle${this.capitalize(event.name)}`;
    
    return `<${componentName} on${this.capitalize(event.name)}={${handlerName}} />

const ${handlerName} = (${event.payload ? 'event' : ''}) => {
  // Handle ${event.name} event
  console.log('${event.name} triggered');
};`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}