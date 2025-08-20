import { 
  AIProvider, 
  CompletionOptions, 
  ChatOptions, 
  ChatMessage,
  createLogger 
} from '@kpc/shared';

const logger = createLogger('AIProvider');

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    apiKey: string = process.env.OPENAI_API_KEY || '',
    baseUrl: string = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: string = process.env.OPENAI_MODEL || 'gpt-4'
  ) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    logger.debug(`Generating completion for prompt: ${prompt.substring(0, 100)}...`);

    try {
      const response = await fetch(`${this.baseUrl}/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo-instruct',
          prompt,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 1,
          stop: options.stop,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No completion choices returned');
      }

      const completion = data.choices[0].text.trim();
      logger.debug(`Generated completion: ${completion.substring(0, 100)}...`);
      
      return completion;

    } catch (error) {
      logger.error(`Failed to generate completion: ${error}`);
      throw error;
    }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    logger.debug(`Generating chat response for ${messages.length} messages`);

    try {
      const chatMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 添加系统消息
      if (options.systemMessage) {
        chatMessages.unshift({
          role: 'system',
          content: options.systemMessage,
        });
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: chatMessages,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 1,
          stop: options.stop,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No chat choices returned');
      }

      const reply = data.choices[0].message.content.trim();
      logger.debug(`Generated chat response: ${reply.substring(0, 100)}...`);
      
      return reply;

    } catch (error) {
      logger.error(`Failed to generate chat response: ${error}`);
      throw error;
    }
  }

  async generateCode(prompt: string, language: string): Promise<string> {
    logger.debug(`Generating ${language} code for prompt: ${prompt.substring(0, 100)}...`);

    const codePrompt = `
Generate ${language} code based on the following requirements:

${prompt}

Please provide only the code without explanations or markdown formatting.
Ensure the code is production-ready, follows best practices, and includes proper error handling.
`;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are an expert ${language} developer. Generate clean, efficient, and well-structured code.`,
        },
        {
          role: 'user',
          content: codePrompt,
        },
      ];

      const code = await this.chat(messages, {
        temperature: 0.3, // Lower temperature for more consistent code generation
        maxTokens: 2000,
      });

      logger.debug(`Generated ${language} code: ${code.substring(0, 100)}...`);
      return code;

    } catch (error) {
      logger.error(`Failed to generate ${language} code: ${error}`);
      throw error;
    }
  }

  async parseStructured<T>(prompt: string, schema: any): Promise<T> {
    logger.debug(`Parsing structured data with schema: ${JSON.stringify(schema).substring(0, 100)}...`);

    const structuredPrompt = `
${prompt}

Please respond with valid JSON that matches the following schema:
${JSON.stringify(schema, null, 2)}

Respond only with the JSON object, no additional text or formatting.
`;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Always respond with valid JSON that matches the requested schema.',
        },
        {
          role: 'user',
          content: structuredPrompt,
        },
      ];

      const response = await this.chat(messages, {
        temperature: 0.1, // Very low temperature for consistent structured output
        maxTokens: 1500,
      });

      // 尝试解析JSON
      try {
        const parsed = JSON.parse(response);
        logger.debug(`Successfully parsed structured data`);
        return parsed as T;
      } catch (parseError) {
        // 如果直接解析失败，尝试提取JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          logger.debug(`Successfully extracted and parsed structured data`);
          return parsed as T;
        }
        
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }

    } catch (error) {
      logger.error(`Failed to parse structured data: ${error}`);
      throw error;
    }
  }
}

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    apiKey: string = process.env.ANTHROPIC_API_KEY || '',
    baseUrl: string = 'https://api.anthropic.com/v1',
    defaultModel: string = 'claude-3-sonnet-20240229'
  ) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    // Anthropic使用messages API，转换为chat调用
    const messages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    return this.chat(messages, options);
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    logger.debug(`Generating Anthropic chat response for ${messages.length} messages`);

    try {
      const anthropicMessages = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        }));

      const systemMessage = messages.find(msg => msg.role === 'system')?.content || 
                           options.systemMessage;

      const requestBody: any = {
        model: this.defaultModel,
        messages: anthropicMessages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
      };

      if (systemMessage) {
        requestBody.system = systemMessage;
      }

      if (options.stop) {
        requestBody.stop_sequences = options.stop;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content || data.content.length === 0) {
        throw new Error('No content returned from Anthropic');
      }

      const reply = data.content[0].text.trim();
      logger.debug(`Generated Anthropic response: ${reply.substring(0, 100)}...`);
      
      return reply;

    } catch (error) {
      logger.error(`Failed to generate Anthropic response: ${error}`);
      throw error;
    }
  }

  async generateCode(prompt: string, language: string): Promise<string> {
    const codePrompt = `
Generate ${language} code based on the following requirements:

${prompt}

Please provide only the code without explanations or markdown formatting.
Ensure the code is production-ready, follows best practices, and includes proper error handling.
`;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: codePrompt,
      },
    ];

    return this.chat(messages, {
      systemMessage: `You are an expert ${language} developer. Generate clean, efficient, and well-structured code.`,
      temperature: 0.3,
      maxTokens: 2000,
    });
  }

  async parseStructured<T>(prompt: string, schema: any): Promise<T> {
    const structuredPrompt = `
${prompt}

Please respond with valid JSON that matches the following schema:
${JSON.stringify(schema, null, 2)}

Respond only with the JSON object, no additional text or formatting.
`;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: structuredPrompt,
      },
    ];

    const response = await this.chat(messages, {
      systemMessage: 'You are a data extraction assistant. Always respond with valid JSON that matches the requested schema.',
      temperature: 0.1,
      maxTokens: 1500,
    });

    try {
      const parsed = JSON.parse(response);
      return parsed as T;
    } catch (parseError) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed as T;
      }
      
      throw new Error(`Failed to parse JSON response: ${parseError}`);
    }
  }
}

export class MockAIProvider implements AIProvider {
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    logger.debug('Using mock AI provider for completion');
    return `Mock completion for: ${prompt.substring(0, 50)}...`;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    logger.debug('Using mock AI provider for chat');
    const lastMessage = messages[messages.length - 1];
    return `Mock response to: ${lastMessage.content.substring(0, 50)}...`;
  }

  async generateCode(prompt: string, language: string): Promise<string> {
    logger.debug(`Using mock AI provider for ${language} code generation`);
    
    // 返回基础的模板代码
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'tsx':
        return `
// Generated ${language} code
export interface Props {
  // Add your props here
}

export const Component: React.FC<Props> = (props) => {
  return (
    <div>
      {/* Generated component */}
    </div>
  );
};
`;
      
      case 'javascript':
      case 'jsx':
        return `
// Generated ${language} code
export const Component = (props) => {
  return (
    <div>
      {/* Generated component */}
    </div>
  );
};
`;
      
      default:
        return `// Generated ${language} code\n// TODO: Implement functionality`;
    }
  }

  async parseStructured<T>(prompt: string, schema: any): Promise<T> {
    logger.debug('Using mock AI provider for structured parsing');
    
    // 返回符合schema的基础结构
    const mockData: any = {};
    
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties as any)) {
        switch (propSchema.type) {
          case 'string':
            mockData[key] = `mock_${key}`;
            break;
          case 'number':
            mockData[key] = 0.8;
            break;
          case 'boolean':
            mockData[key] = true;
            break;
          case 'array':
            mockData[key] = [];
            break;
          case 'object':
            mockData[key] = {};
            break;
          default:
            mockData[key] = null;
        }
      }
    }
    
    return mockData as T;
  }
}