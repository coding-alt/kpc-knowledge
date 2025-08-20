import { GraphQLClient } from 'graphql-request';
import { ConfigurationManager } from './configurationManager';
import { ComponentInfo, SearchOptions, ValidationResult } from '../types';

export class KPCApiClient {
  private client: GraphQLClient;
  private cache = new Map<string, any>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private configManager: ConfigurationManager) {
    this.client = new GraphQLClient(this.configManager.get('apiEndpoint'));
    this.updateConfiguration();
  }

  updateConfiguration(): void {
    const endpoint = this.configManager.get('apiEndpoint');
    const apiKey = this.configManager.get('apiKey');
    
    this.client = new GraphQLClient(endpoint, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    
    // Clear cache when configuration changes
    this.cache.clear();
  }

  async searchComponents(query: string, options: SearchOptions = {}): Promise<ComponentInfo[]> {
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const searchQuery = `
      query SearchComponents($query: String!, $filter: SearchFilter) {
        search(query: $query, filter: $filter) {
          content
          score
          metadata {
            componentName
            framework
            sourceRef {
              filePath
              url
            }
            type
          }
        }
      }
    `;

    try {
      const response = await this.client.request(searchQuery, {
        query,
        filter: {
          framework: options.framework,
          componentName: options.componentName,
          category: options.category,
          minScore: options.minScore || 0.5,
          limit: options.limit || 20,
        },
      });

      const components = this.transformSearchResults(response.search);
      this.setCache(cacheKey, components);
      return components;
    } catch (error) {
      console.error('Failed to search components:', error);
      return [];
    }
  }

  async getComponent(name: string, framework?: string): Promise<ComponentInfo | null> {
    const cacheKey = `component:${name}:${framework || 'any'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const componentQuery = `
      query GetComponent($name: String!, $framework: String) {
        componentByName(name: $name, framework: $framework) {
          id
          name
          alias
          import {
            module
            named
            default
          }
          category
          description
          frameworks {
            framework
            import {
              module
              named
              default
            }
            props {
              id
              name
              type
              required
              default
              enum
              constraints {
                type
                value
                message
              }
              deprecated
              docs
            }
            events {
              id
              name
              type
              payload
              docs
              deprecated
            }
            slots {
              id
              name
              type
              props {
                id
                name
                type
                required
                default
              }
              docs
              deprecated
            }
            examples {
              id
              title
              description
              code
              framework
              category
            }
          }
          props {
            id
            name
            type
            required
            default
            enum
            constraints {
              type
              value
              message
            }
            deprecated
            docs
          }
          events {
            id
            name
            type
            payload
            docs
            deprecated
          }
          slots {
            id
            name
            type
            props {
              id
              name
              type
              required
              default
            }
            docs
            deprecated
          }
          styleTokens {
            id
            name
            value
            category
            docs
          }
          composability {
            type
            target
            condition
            message
          }
          antiPatterns {
            id
            name
            description
            badExample
            goodExample
            reason
            severity
          }
          version {
            since
            deprecated
            breaking {
              version
              description
              migration
            }
          }
          sourceRefs {
            filePath
            startLine
            endLine
            url
            commit
          }
          createdAt
          updatedAt
        }
      }
    `;

    try {
      const response = await this.client.request(componentQuery, { name, framework });
      const component = this.transformComponent(response.componentByName);
      
      if (component) {
        this.setCache(cacheKey, component);
      }
      
      return component;
    } catch (error) {
      console.error('Failed to get component:', error);
      return null;
    }
  }

  async validateCode(code: string, filePath: string, framework?: string): Promise<ValidationResult> {
    const validateQuery = `
      mutation ValidateCode($code: String!, $filePath: String!, $framework: String) {
        validateCode(code: $code, filePath: $filePath, framework: $framework) {
          success
          errors {
            line
            column
            severity
            message
            rule
            fixable
          }
          warnings {
            line
            column
            severity
            message
            rule
            fixable
          }
          suggestions {
            line
            column
            message
            fix
          }
        }
      }
    `;

    try {
      const response = await this.client.request(validateQuery, {
        code,
        filePath,
        framework: framework || this.configManager.get('framework'),
      });

      return response.validateCode;
    } catch (error) {
      console.error('Failed to validate code:', error);
      return {
        success: false,
        errors: [{
          line: 1,
          column: 1,
          severity: 'error',
          message: 'Failed to validate code: ' + (error as Error).message,
          rule: 'validation-error',
          fixable: false,
        }],
        warnings: [],
        suggestions: [],
      };
    }
  }

  async generateCode(requirement: string, options: any = {}): Promise<any> {
    const generateQuery = `
      mutation GenerateCode($requirement: String!, $options: GenerationOptions) {
        generateCode(requirement: $requirement, options: $options) {
          component
          tests
          stories
          types
          metadata {
            componentName
            framework
            confidence
            generatedAt
          }
        }
      }
    `;

    try {
      const response = await this.client.request(generateQuery, {
        requirement,
        options: {
          framework: options.framework || this.configManager.get('framework'),
          typescript: options.typescript ?? this.configManager.get('typescript'),
          includeTests: options.includeTests ?? false,
          includeStories: options.includeStories ?? false,
          ...options,
        },
      });

      return response.generateCode;
    } catch (error) {
      console.error('Failed to generate code:', error);
      throw error;
    }
  }

  async getComponentSuggestions(partial: string, framework?: string): Promise<string[]> {
    const cacheKey = `suggestions:${partial}:${framework || 'any'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const suggestionsQuery = `
      query GetSuggestions($query: String!, $limit: Int) {
        searchSuggestions(query: $query, limit: $limit)
      }
    `;

    try {
      const response = await this.client.request(suggestionsQuery, {
        query: partial,
        limit: 10,
      });

      const suggestions = response.searchSuggestions || [];
      this.setCache(cacheKey, suggestions);
      return suggestions;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  async getComponentExamples(componentName: string, framework?: string): Promise<any[]> {
    const cacheKey = `examples:${componentName}:${framework || 'any'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const examplesQuery = `
      query GetComponentExamples($componentName: String!, $framework: String) {
        searchExamples(query: $componentName, framework: $framework) {
          content
          score
          metadata {
            componentName
            framework
            sourceRef {
              filePath
              url
            }
            type
          }
        }
      }
    `;

    try {
      const response = await this.client.request(examplesQuery, {
        componentName,
        framework,
      });

      const examples = response.searchExamples || [];
      this.setCache(cacheKey, examples);
      return examples;
    } catch (error) {
      console.error('Failed to get examples:', error);
      return [];
    }
  }

  private transformSearchResults(results: any[]): ComponentInfo[] {
    return results
      .filter(result => result.metadata.type === 'component')
      .map(result => ({
        name: result.metadata.componentName,
        framework: result.metadata.framework,
        description: result.content,
        score: result.score,
        sourceRef: result.metadata.sourceRef,
      }));
  }

  private transformComponent(component: any): ComponentInfo | null {
    if (!component) return null;

    // Get framework-specific binding or use default
    const framework = this.configManager.get('framework') || 'react';
    const frameworkBinding = component.frameworks.find((f: any) => f.framework === framework);
    
    return {
      id: component.id,
      name: component.name,
      alias: component.alias,
      framework: framework,
      category: component.category,
      description: component.description,
      import: frameworkBinding?.import || component.import,
      props: frameworkBinding?.props || component.props || [],
      events: frameworkBinding?.events || component.events || [],
      slots: frameworkBinding?.slots || component.slots || [],
      examples: frameworkBinding?.examples || [],
      styleTokens: component.styleTokens || [],
      composability: component.composability || [],
      antiPatterns: component.antiPatterns || [],
      version: component.version,
      sourceRefs: component.sourceRefs || [],
      docs: component.docs,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
    };
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}