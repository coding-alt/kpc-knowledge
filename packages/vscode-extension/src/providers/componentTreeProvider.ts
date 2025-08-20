import * as vscode from 'vscode';
import { KPCApiClient } from '../services/apiClient';
import { ConfigurationManager } from '../services/configurationManager';
import { ComponentInfo, ComponentTreeItem } from '../types';

export class ComponentTreeProvider implements vscode.TreeDataProvider<ComponentTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ComponentTreeItem | undefined | null | void> = new vscode.EventEmitter<ComponentTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ComponentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private components: ComponentInfo[] = [];
  private categories: Map<string, ComponentInfo[]> = new Map();

  constructor(
    private apiClient: KPCApiClient,
    private configManager: ConfigurationManager
  ) {
    this.loadComponents();
  }

  refresh(): void {
    this.loadComponents();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ComponentTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.name,
      element.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    treeItem.id = element.id;
    treeItem.description = element.description;
    treeItem.tooltip = this.createTooltip(element);
    treeItem.contextValue = element.children ? 'category' : 'component';

    // Set icons
    if (element.children) {
      treeItem.iconPath = new vscode.ThemeIcon('folder');
    } else {
      treeItem.iconPath = this.getComponentIcon(element.framework);
    }

    // Set command for components
    if (!element.children) {
      treeItem.command = {
        command: 'kpc.showComponentInfo',
        title: 'Show Component Info',
        arguments: [element]
      };
    }

    return treeItem;
  }

  getChildren(element?: ComponentTreeItem): Thenable<ComponentTreeItem[]> {
    if (!element) {
      // Root level - show categories
      return Promise.resolve(this.getRootItems());
    } else if (element.children) {
      // Category level - show components in category
      return Promise.resolve(element.children);
    } else {
      // Component level - no children
      return Promise.resolve([]);
    }
  }

  private async loadComponents(): Promise<void> {
    try {
      const framework = this.configManager.getFramework();
      this.components = await this.apiClient.searchComponents('', { 
        framework: framework === 'auto' ? undefined : framework,
        limit: 100 
      });

      this.organizeByCategory();
    } catch (error) {
      console.error('Failed to load components:', error);
      this.components = [];
      this.categories.clear();
    }
  }

  private organizeByCategory(): void {
    this.categories.clear();

    this.components.forEach(component => {
      const category = component.category || 'Other';
      
      if (!this.categories.has(category)) {
        this.categories.set(category, []);
      }
      
      this.categories.get(category)!.push(component);
    });

    // Sort components within each category
    this.categories.forEach(components => {
      components.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  private getRootItems(): ComponentTreeItem[] {
    const items: ComponentTreeItem[] = [];

    // Add framework filter if multiple frameworks are present
    const frameworks = new Set(this.components.map(c => c.framework));
    if (frameworks.size > 1) {
      frameworks.forEach(framework => {
        const frameworkComponents = this.components.filter(c => c.framework === framework);
        const frameworkCategories = this.getCategoriesForFramework(framework);

        items.push({
          id: `framework-${framework}`,
          name: this.capitalizeFramework(framework),
          framework: framework,
          description: `${frameworkComponents.length} components`,
          children: frameworkCategories,
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded
        });
      });
    } else {
      // Single framework - show categories directly
      items.push(...this.getCategoryItems());
    }

    return items;
  }

  private getCategoriesForFramework(framework: string): ComponentTreeItem[] {
    const frameworkComponents = this.components.filter(c => c.framework === framework);
    const frameworkCategories = new Map<string, ComponentInfo[]>();

    frameworkComponents.forEach(component => {
      const category = component.category || 'Other';
      if (!frameworkCategories.has(category)) {
        frameworkCategories.set(category, []);
      }
      frameworkCategories.get(category)!.push(component);
    });

    return Array.from(frameworkCategories.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, components]) => ({
        id: `${framework}-${category}`,
        name: category,
        framework: framework,
        description: `${components.length} components`,
        children: components.map(c => this.createComponentItem(c)),
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
      }));
  }

  private getCategoryItems(): ComponentTreeItem[] {
    return Array.from(this.categories.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, components]) => ({
        id: `category-${category}`,
        name: category,
        framework: 'mixed',
        description: `${components.length} components`,
        children: components.map(c => this.createComponentItem(c)),
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
      }));
  }

  private createComponentItem(component: ComponentInfo): ComponentTreeItem {
    return {
      id: `component-${component.name}-${component.framework}`,
      name: component.name,
      framework: component.framework,
      category: component.category,
      description: this.createComponentDescription(component),
      collapsibleState: vscode.TreeItemCollapsibleState.None
    };
  }

  private createComponentDescription(component: ComponentInfo): string {
    const parts: string[] = [];

    if (component.props && component.props.length > 0) {
      parts.push(`${component.props.length} props`);
    }

    if (component.events && component.events.length > 0) {
      parts.push(`${component.events.length} events`);
    }

    if (component.version?.deprecated) {
      parts.push('deprecated');
    }

    return parts.join(', ');
  }

  private createTooltip(element: ComponentTreeItem): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();

    if (element.children) {
      // Category tooltip
      tooltip.appendMarkdown(`**${element.name}**\n\n`);
      tooltip.appendMarkdown(`${element.description}\n\n`);
      
      if (element.framework !== 'mixed') {
        tooltip.appendMarkdown(`Framework: ${element.framework}\n`);
      }
    } else {
      // Component tooltip
      const component = this.components.find(c => 
        c.name === element.name && c.framework === element.framework
      );

      if (component) {
        tooltip.appendMarkdown(`**${component.name}**\n\n`);
        
        if (component.description) {
          tooltip.appendMarkdown(`${component.description}\n\n`);
        }

        tooltip.appendMarkdown(`**Framework:** ${component.framework}\n`);
        
        if (component.category) {
          tooltip.appendMarkdown(`**Category:** ${component.category}\n`);
        }

        if (component.props && component.props.length > 0) {
          tooltip.appendMarkdown(`**Props:** ${component.props.length}\n`);
        }

        if (component.events && component.events.length > 0) {
          tooltip.appendMarkdown(`**Events:** ${component.events.length}\n`);
        }

        if (component.version?.deprecated) {
          tooltip.appendMarkdown(`\n⚠️ **Deprecated**\n`);
        }

        tooltip.appendMarkdown(`\n*Click to view details*`);
      }
    }

    return tooltip;
  }

  private getComponentIcon(framework: string): vscode.ThemeIcon {
    switch (framework) {
      case 'react':
        return new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('charts.blue'));
      case 'vue':
        return new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('charts.green'));
      case 'intact':
        return new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('charts.purple'));
      default:
        return new vscode.ThemeIcon('symbol-class');
    }
  }

  private capitalizeFramework(framework: string): string {
    switch (framework) {
      case 'react':
        return 'React';
      case 'vue':
        return 'Vue';
      case 'intact':
        return 'Intact';
      default:
        return framework.charAt(0).toUpperCase() + framework.slice(1);
    }
  }

  // Search functionality
  async searchComponents(query: string): Promise<void> {
    try {
      const framework = this.configManager.getFramework();
      this.components = await this.apiClient.searchComponents(query, { 
        framework: framework === 'auto' ? undefined : framework,
        limit: 50 
      });

      this.organizeByCategory();
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Failed to search components:', error);
    }
  }

  // Filter by framework
  async filterByFramework(framework: string): Promise<void> {
    try {
      this.components = await this.apiClient.searchComponents('', { 
        framework: framework === 'all' ? undefined : framework,
        limit: 100 
      });

      this.organizeByCategory();
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Failed to filter components:', error);
    }
  }

  // Get component by tree item
  getComponentByTreeItem(item: ComponentTreeItem): ComponentInfo | undefined {
    return this.components.find(c => 
      c.name === item.name && c.framework === item.framework
    );
  }

  // Get statistics
  getStatistics(): { total: number; byFramework: Map<string, number>; byCategory: Map<string, number> } {
    const byFramework = new Map<string, number>();
    const byCategory = new Map<string, number>();

    this.components.forEach(component => {
      // Count by framework
      const framework = component.framework;
      byFramework.set(framework, (byFramework.get(framework) || 0) + 1);

      // Count by category
      const category = component.category || 'Other';
      byCategory.set(category, (byCategory.get(category) || 0) + 1);
    });

    return {
      total: this.components.length,
      byFramework,
      byCategory
    };
  }
}