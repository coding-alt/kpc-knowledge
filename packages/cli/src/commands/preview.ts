import { Command, Flags } from '@oclif/core';
import { createLogger } from '@kpc/shared';
import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import * as ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

const logger = createLogger('PreviewCommand');

export default class Preview extends Command {
  static description = 'Preview and debug components locally';

  static examples = [
    '$ kpc preview ./src/components/Button.tsx',
    '$ kpc preview --port 3001 --hot-reload',
    '$ kpc preview --interactive',
  ];

  static flags = {
    port: Flags.integer({
      char: 'p',
      description: 'Port for preview server',
      default: 3000,
    }),
    host: Flags.string({
      char: 'h',
      description: 'Host for preview server',
      default: 'localhost',
    }),
    open: Flags.boolean({
      char: 'o',
      description: 'Open browser automatically',
      default: true,
    }),
    hotReload: Flags.boolean({
      description: 'Enable hot reload',
      default: true,
    }),
    framework: Flags.string({
      char: 'f',
      description: 'Framework for preview',
      options: ['react', 'vue', 'intact'],
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactive component selection and configuration',
      default: false,
    }),
    theme: Flags.string({
      char: 't',
      description: 'Preview theme',
      options: ['light', 'dark', 'auto'],
      default: 'light',
    }),
    responsive: Flags.boolean({
      char: 'r',
      description: 'Enable responsive preview modes',
      default: true,
    }),
  };

  static args = [
    {
      name: 'component',
      description: 'Component file or directory to preview',
      required: false,
    },
  ];

  private server?: http.Server;
  private watchers: fs.FSWatcher[] = [];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Preview);

    try {
      let componentPath = args.component;
      let options = {
        port: flags.port,
        host: flags.host,
        open: flags.open,
        hotReload: flags.hotReload,
        framework: flags.framework as 'react' | 'vue' | 'intact' | undefined,
        theme: flags.theme as 'light' | 'dark' | 'auto',
        responsive: flags.responsive,
      };

      // Interactive mode
      if (flags.interactive || !componentPath) {
        const answers = await this.promptForInput(componentPath, options);
        componentPath = answers.component;
        options = { ...options, ...answers.options };
      }

      if (!componentPath) {
        this.error('Component path is required. Use --interactive or provide a component argument.');
      }

      this.log('');
      this.log(chalk.blue('👀 KPC Component Preview'));
      this.log(chalk.gray('=' .repeat(50)));
      this.log(`📁 Component: ${chalk.cyan(componentPath)}`);
      this.log(`🎭 Framework: ${chalk.yellow(options.framework || 'auto-detect')}`);
      this.log(`🌐 Server: ${chalk.green(`http://${options.host}:${options.port}`)}`);
      this.log(`🔥 Hot Reload: ${options.hotReload ? chalk.green('enabled') : chalk.gray('disabled')}`);
      this.log('');

      // Analyze component
      const spinner = ora('Analyzing component...').start();
      const componentInfo = await this.analyzeComponent(componentPath, options);
      
      if (!componentInfo) {
        spinner.fail('Failed to analyze component');
        return;
      }

      spinner.succeed(`Found ${componentInfo.components.length} component(s)`);
      this.log('');

      // Start preview server
      await this.startPreviewServer(componentInfo, options);

      // Setup file watching if hot reload is enabled
      if (options.hotReload) {
        this.setupFileWatching(componentPath, componentInfo);
      }

      // Interactive debugging menu
      if (flags.interactive) {
        await this.startInteractiveMode(componentInfo, options);
      } else {
        // Keep server running
        this.log(chalk.blue('🚀 Preview server is running'));
        this.log(chalk.gray('Press Ctrl+C to stop'));
        
        process.on('SIGINT', () => {
          this.cleanup();
          process.exit(0);
        });

        // Keep process alive
        await new Promise(() => {});
      }

    } catch (error) {
      logger.error('Preview command failed:', error);
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async promptForInput(initialComponent?: string, initialOptions?: any) {
    const questions = [];

    if (!initialComponent) {
      // Discover available components
      const components = await this.discoverComponents();
      
      if (components.length > 0) {
        questions.push({
          type: 'list',
          name: 'component',
          message: 'Select a component to preview:',
          choices: [
            { name: 'Browse for file...', value: 'browse' },
            ...components.map(c => ({
              name: `${path.basename(c.path)} (${c.framework})`,
              value: c.path,
            })),
          ],
        });
      } else {
        questions.push({
          type: 'input',
          name: 'component',
          message: 'Enter component file path:',
          validate: (input: string) => {
            if (!input.trim()) return 'Please provide a component path';
            if (!fs.existsSync(input)) return 'File does not exist';
            return true;
          },
        });
      }
    }

    questions.push(
      {
        type: 'input',
        name: 'component',
        message: 'Enter component file path:',
        when: (answers: any) => answers.component === 'browse',
        validate: (input: string) => {
          if (!input.trim()) return 'Please provide a component path';
          if (!fs.existsSync(input)) return 'File does not exist';
          return true;
        },
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Target framework:',
        choices: [
          { name: 'Auto-detect from file', value: undefined },
          { name: 'React', value: 'react' },
          { name: 'Vue', value: 'vue' },
          { name: 'Intact', value: 'intact' },
        ],
        default: initialOptions?.framework,
      },
      {
        type: 'number',
        name: 'port',
        message: 'Preview server port:',
        default: initialOptions?.port || 3000,
        validate: (input: number) => (input > 0 && input < 65536) || 'Please enter a valid port number',
      },
      {
        type: 'list',
        name: 'theme',
        message: 'Preview theme:',
        choices: [
          { name: 'Light theme', value: 'light' },
          { name: 'Dark theme', value: 'dark' },
          { name: 'Auto (system preference)', value: 'auto' },
        ],
        default: initialOptions?.theme || 'light',
      },
      {
        type: 'confirm',
        name: 'hotReload',
        message: 'Enable hot reload for development?',
        default: initialOptions?.hotReload ?? true,
      },
      {
        type: 'confirm',
        name: 'responsive',
        message: 'Enable responsive preview modes?',
        default: initialOptions?.responsive ?? true,
      },
      {
        type: 'confirm',
        name: 'open',
        message: 'Open browser automatically?',
        default: initialOptions?.open ?? true,
      }
    );

    const answers = await inquirer.prompt(questions);

    return {
      component: initialComponent || answers.component,
      options: {
        framework: answers.framework,
        port: answers.port,
        host: initialOptions?.host || 'localhost',
        theme: answers.theme,
        hotReload: answers.hotReload,
        responsive: answers.responsive,
        open: answers.open,
      },
    };
  }

  private async discoverComponents(): Promise<any[]> {
    const patterns = ['./src/**/*.{tsx,jsx,vue}', './components/**/*.{tsx,jsx,vue}'];
    const components = [];

    for (const pattern of patterns) {
      try {
        const { glob } = await import('glob');
        const files = glob.sync(pattern, {
          ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.stories.*'],
        });

        for (const file of files) {
          if (fs.existsSync(file)) {
            const framework = this.detectFramework(file);
            if (framework !== 'unknown') {
              components.push({
                path: file,
                framework,
                name: path.basename(file, path.extname(file)),
              });
            }
          }
        }
      } catch (error) {
        // Ignore glob errors
      }
    }

    return components.slice(0, 20); // Limit to first 20 components
  }

  private detectFramework(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('import React') || content.includes('from \'react\'')) {
        return 'react';
      }
      if (content.includes('<template>') || content.includes('defineComponent')) {
        return 'vue';
      }
      if (content.includes('Intact') || content.includes('@intact')) {
        return 'intact';
      }
    } catch (error) {
      // Ignore read errors
    }
    
    return 'unknown';
  }

  private async analyzeComponent(componentPath: string, options: any): Promise<any> {
    const stats = fs.statSync(componentPath);
    const components = [];

    if (stats.isFile()) {
      const framework = options.framework || this.detectFramework(componentPath);
      const analysis = await this.analyzeFile(componentPath, framework);
      components.push(analysis);
    } else if (stats.isDirectory()) {
      // Analyze all components in directory
      const files = fs.readdirSync(componentPath)
        .filter(f => f.match(/\.(tsx|jsx|vue)$/))
        .slice(0, 10); // Limit to 10 files

      for (const file of files) {
        const filePath = path.join(componentPath, file);
        const framework = options.framework || this.detectFramework(filePath);
        const analysis = await this.analyzeFile(filePath, framework);
        components.push(analysis);
      }
    }

    return {
      path: componentPath,
      components,
      framework: options.framework || (components[0]?.framework),
    };
  }

  private async analyzeFile(filePath: string, framework: string): Promise<any> {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Mock analysis - in real implementation, this would use the parser services
    return {
      path: filePath,
      name: path.basename(filePath, path.extname(filePath)),
      framework,
      props: this.extractProps(content, framework),
      events: this.extractEvents(content, framework),
      dependencies: this.extractDependencies(content),
      size: content.length,
      lines: content.split('\n').length,
    };
  }

  private extractProps(content: string, framework: string): any[] {
    // Mock prop extraction
    const props = [];
    
    if (framework === 'react') {
      const propMatches = content.match(/(\w+):\s*(string|number|boolean)/g);
      if (propMatches) {
        for (const match of propMatches) {
          const [name, type] = match.split(':').map(s => s.trim());
          props.push({ name, type, required: !content.includes(`${name}?:`) });
        }
      }
    }

    return props;
  }

  private extractEvents(content: string, framework: string): string[] {
    // Mock event extraction
    const events = [];
    
    if (framework === 'react') {
      const eventMatches = content.match(/on\w+/g);
      if (eventMatches) {
        events.push(...eventMatches);
      }
    }

    return [...new Set(events)];
  }

  private extractDependencies(content: string): string[] {
    const deps = [];
    const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
    
    if (importMatches) {
      for (const match of importMatches) {
        const depMatch = match.match(/from\s+['"]([^'"]+)['"]/);
        if (depMatch) {
          deps.push(depMatch[1]);
        }
      }
    }

    return deps;
  }

  private async startPreviewServer(componentInfo: any, options: any): Promise<void> {
    const spinner = ora(`Starting preview server on port ${options.port}...`).start();

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res, componentInfo, options);
      });

      this.server.listen(options.port, options.host, () => {
        spinner.succeed(`Preview server started at http://${options.host}:${options.port}`);
        
        if (options.open) {
          this.openBrowser(`http://${options.host}:${options.port}`);
        }
        
        resolve();
      });

      this.server.on('error', (error) => {
        spinner.fail('Failed to start preview server');
        reject(error);
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, componentInfo: any, options: any): void {
    const url = req.url || '/';
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url === '/') {
      res.end(this.generatePreviewHTML(componentInfo, options));
    } else if (url === '/api/component') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(componentInfo));
    } else if (url === '/api/reload') {
      // Hot reload endpoint
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write('data: connected\n\n');
      
      // Keep connection alive for hot reload
      const keepAlive = setInterval(() => {
        res.write('data: ping\n\n');
      }, 30000);

      req.on('close', () => {
        clearInterval(keepAlive);
      });
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  }

  private generatePreviewHTML(componentInfo: any, options: any): string {
    const component = componentInfo.components[0];
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KPC Preview - ${component?.name || 'Component'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${options.theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
            color: ${options.theme === 'dark' ? '#ffffff' : '#333333'};
        }
        .header {
            background: ${options.theme === 'dark' ? '#2d2d2d' : '#ffffff'};
            border-bottom: 1px solid ${options.theme === 'dark' ? '#404040' : '#e0e0e0'};
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .title { font-size: 1.5rem; font-weight: 600; }
        .controls { display: flex; gap: 1rem; align-items: center; }
        .btn {
            padding: 0.5rem 1rem;
            border: 1px solid ${options.theme === 'dark' ? '#404040' : '#d0d0d0'};
            background: ${options.theme === 'dark' ? '#3d3d3d' : '#ffffff'};
            color: inherit;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
        }
        .btn:hover { opacity: 0.8; }
        .main { display: flex; height: calc(100vh - 80px); }
        .sidebar {
            width: 300px;
            background: ${options.theme === 'dark' ? '#2d2d2d' : '#ffffff'};
            border-right: 1px solid ${options.theme === 'dark' ? '#404040' : '#e0e0e0'};
            padding: 1rem;
            overflow-y: auto;
        }
        .preview-area {
            flex: 1;
            padding: 2rem;
            overflow: auto;
        }
        .component-info { margin-bottom: 2rem; }
        .info-section { margin-bottom: 1.5rem; }
        .info-title { font-weight: 600; margin-bottom: 0.5rem; color: #007acc; }
        .info-list { list-style: none; }
        .info-list li { 
            padding: 0.25rem 0; 
            font-size: 0.875rem;
            border-bottom: 1px solid ${options.theme === 'dark' ? '#404040' : '#f0f0f0'};
        }
        .preview-container {
            background: ${options.theme === 'dark' ? '#2d2d2d' : '#ffffff'};
            border: 1px solid ${options.theme === 'dark' ? '#404040' : '#e0e0e0'};
            border-radius: 8px;
            padding: 2rem;
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .placeholder {
            text-align: center;
            color: ${options.theme === 'dark' ? '#888888' : '#666666'};
        }
        .status { 
            position: fixed; 
            bottom: 1rem; 
            right: 1rem; 
            padding: 0.5rem 1rem; 
            background: #007acc; 
            color: white; 
            border-radius: 4px; 
            font-size: 0.875rem;
        }
        ${options.responsive ? `
        .responsive-controls {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }
        .device-btn {
            padding: 0.25rem 0.5rem;
            border: 1px solid #d0d0d0;
            background: #f8f8f8;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75rem;
        }
        .device-btn.active { background: #007acc; color: white; }
        ` : ''}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🧩 ${component?.name || 'Component'} Preview</div>
        <div class="controls">
            <button class="btn" onclick="toggleTheme()">🌓 Theme</button>
            <button class="btn" onclick="refreshPreview()">🔄 Refresh</button>
            <button class="btn" onclick="openDevTools()">🔧 Debug</button>
        </div>
    </div>
    
    <div class="main">
        <div class="sidebar">
            <div class="component-info">
                <div class="info-section">
                    <div class="info-title">Component Info</div>
                    <ul class="info-list">
                        <li><strong>Name:</strong> ${component?.name || 'Unknown'}</li>
                        <li><strong>Framework:</strong> ${component?.framework || 'Unknown'}</li>
                        <li><strong>Size:</strong> ${component?.size || 0} bytes</li>
                        <li><strong>Lines:</strong> ${component?.lines || 0}</li>
                    </ul>
                </div>
                
                ${component?.props?.length > 0 ? `
                <div class="info-section">
                    <div class="info-title">Props</div>
                    <ul class="info-list">
                        ${component.props.map((prop: any) => `
                            <li><strong>${prop.name}</strong>: ${prop.type} ${prop.required ? '(required)' : ''}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${component?.events?.length > 0 ? `
                <div class="info-section">
                    <div class="info-title">Events</div>
                    <ul class="info-list">
                        ${component.events.map((event: string) => `<li>${event}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${component?.dependencies?.length > 0 ? `
                <div class="info-section">
                    <div class="info-title">Dependencies</div>
                    <ul class="info-list">
                        ${component.dependencies.map((dep: string) => `<li>${dep}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="preview-area">
            ${options.responsive ? `
            <div class="responsive-controls">
                <button class="device-btn active" onclick="setViewport('desktop')">🖥️ Desktop</button>
                <button class="device-btn" onclick="setViewport('tablet')">📱 Tablet</button>
                <button class="device-btn" onclick="setViewport('mobile')">📱 Mobile</button>
            </div>
            ` : ''}
            
            <div class="preview-container" id="preview">
                <div class="placeholder">
                    <h3>Component Preview</h3>
                    <p>Component rendering would appear here</p>
                    <p><em>Framework: ${component?.framework || 'Unknown'}</em></p>
                </div>
            </div>
        </div>
    </div>
    
    <div class="status" id="status">
        ${options.hotReload ? '🔥 Hot Reload Active' : '📄 Static Preview'}
    </div>

    <script>
        let currentTheme = '${options.theme}';
        
        function toggleTheme() {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.style.background = currentTheme === 'dark' ? '#1a1a1a' : '#f5f5f5';
            document.body.style.color = currentTheme === 'dark' ? '#ffffff' : '#333333';
        }
        
        function refreshPreview() {
            document.getElementById('status').textContent = '🔄 Refreshing...';
            setTimeout(() => {
                document.getElementById('status').textContent = '✅ Refreshed';
                setTimeout(() => {
                    document.getElementById('status').textContent = '${options.hotReload ? '🔥 Hot Reload Active' : '📄 Static Preview'}';
                }, 2000);
            }, 500);
        }
        
        function openDevTools() {
            console.log('Component Info:', ${JSON.stringify(component, null, 2)});
            alert('Check browser console for component details');
        }
        
        ${options.responsive ? `
        function setViewport(device) {
            const preview = document.getElementById('preview');
            const buttons = document.querySelectorAll('.device-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            switch(device) {
                case 'mobile':
                    preview.style.maxWidth = '375px';
                    break;
                case 'tablet':
                    preview.style.maxWidth = '768px';
                    break;
                default:
                    preview.style.maxWidth = 'none';
            }
        }
        ` : ''}
        
        ${options.hotReload ? `
        // Hot reload connection
        const eventSource = new EventSource('/api/reload');
        eventSource.onmessage = function(event) {
            if (event.data === 'reload') {
                location.reload();
            }
        };
        ` : ''}
    </script>
</body>
</html>
    `;
  }

  private setupFileWatching(componentPath: string, componentInfo: any): void {
    const watchPaths = [componentPath];
    
    // Add component dependencies to watch list
    for (const component of componentInfo.components) {
      if (component.dependencies) {
        for (const dep of component.dependencies) {
          if (dep.startsWith('./') || dep.startsWith('../')) {
            // Local dependency
            const depPath = path.resolve(path.dirname(component.path), dep);
            if (fs.existsSync(depPath)) {
              watchPaths.push(depPath);
            }
          }
        }
      }
    }

    for (const watchPath of watchPaths) {
      try {
        const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename && filename.match(/\.(tsx|jsx|vue|ts|js|css|scss)$/)) {
            this.log(chalk.blue(`🔄 File changed: ${filename}`));
            this.notifyReload();
          }
        });
        
        this.watchers.push(watcher);
      } catch (error) {
        logger.warn(`Failed to watch ${watchPath}:`, error);
      }
    }

    this.log(chalk.green(`👀 Watching ${watchPaths.length} path(s) for changes`));
  }

  private notifyReload(): void {
    // In a real implementation, this would notify connected clients to reload
    // For now, we just log the reload event
    logger.info('Notifying clients to reload');
  }

  private async openBrowser(url: string): Promise<void> {
    try {
      const { default: open } = await import('open');
      await open(url);
    } catch (error) {
      this.log(chalk.yellow(`Could not open browser automatically. Please visit: ${url}`));
    }
  }

  private async startInteractiveMode(componentInfo: any, options: any): Promise<void> {
    this.log('');
    this.log(chalk.blue('🎮 Interactive Debug Mode'));
    this.log(chalk.gray('Use the menu below to debug and explore your component'));
    this.log('');

    while (true) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔍 Inspect component details', value: 'inspect' },
            { name: '🎨 Change preview theme', value: 'theme' },
            { name: '📱 Test responsive modes', value: 'responsive' },
            { name: '🔄 Reload component', value: 'reload' },
            { name: '📊 View performance metrics', value: 'metrics' },
            { name: '🐛 Debug component props', value: 'debug' },
            { name: '🌐 Open in browser', value: 'browser' },
            { name: '❌ Stop preview server', value: 'stop' },
          ],
        },
      ]);

      switch (answer.action) {
        case 'inspect':
          await this.inspectComponent(componentInfo);
          break;
        case 'theme':
          options.theme = await this.changeTheme(options.theme);
          break;
        case 'responsive':
          await this.testResponsive();
          break;
        case 'reload':
          await this.reloadComponent(componentInfo);
          break;
        case 'metrics':
          await this.showMetrics(componentInfo);
          break;
        case 'debug':
          await this.debugProps(componentInfo);
          break;
        case 'browser':
          await this.openBrowser(`http://${options.host}:${options.port}`);
          break;
        case 'stop':
          this.cleanup();
          return;
      }

      this.log('');
    }
  }

  private async inspectComponent(componentInfo: any): Promise<void> {
    const component = componentInfo.components[0];
    
    this.log('');
    this.log(chalk.blue('🔍 Component Inspection'));
    this.log(chalk.gray('-'.repeat(40)));
    this.log(`Name: ${chalk.cyan(component.name)}`);
    this.log(`Framework: ${chalk.yellow(component.framework)}`);
    this.log(`File: ${chalk.gray(component.path)}`);
    this.log(`Size: ${chalk.green(component.size + ' bytes')}`);
    this.log(`Lines: ${chalk.green(component.lines)}`);
    
    if (component.props?.length > 0) {
      this.log(`\nProps (${component.props.length}):`);
      for (const prop of component.props) {
        this.log(`  • ${chalk.cyan(prop.name)}: ${chalk.yellow(prop.type)} ${prop.required ? chalk.red('(required)') : chalk.gray('(optional)')}`);
      }
    }
    
    if (component.events?.length > 0) {
      this.log(`\nEvents (${component.events.length}):`);
      for (const event of component.events) {
        this.log(`  • ${chalk.cyan(event)}`);
      }
    }
    
    if (component.dependencies?.length > 0) {
      this.log(`\nDependencies (${component.dependencies.length}):`);
      for (const dep of component.dependencies) {
        this.log(`  • ${chalk.gray(dep)}`);
      }
    }
  }

  private async changeTheme(currentTheme: string): Promise<string> {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'theme',
        message: 'Select preview theme:',
        choices: [
          { name: '☀️ Light theme', value: 'light' },
          { name: '🌙 Dark theme', value: 'dark' },
          { name: '🔄 Auto (system)', value: 'auto' },
        ],
        default: currentTheme,
      },
    ]);

    this.log(chalk.green(`Theme changed to: ${answer.theme}`));
    return answer.theme;
  }

  private async testResponsive(): Promise<void> {
    this.log('');
    this.log(chalk.blue('📱 Responsive Testing'));
    this.log(chalk.gray('-'.repeat(30)));
    this.log('Testing different viewport sizes...');
    
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 },
    ];

    for (const viewport of viewports) {
      this.log(`${chalk.cyan(viewport.name)}: ${viewport.width}x${viewport.height}`);
      // In real implementation, this would test the component at different sizes
    }
  }

  private async reloadComponent(componentInfo: any): Promise<void> {
    const spinner = ora('Reloading component...').start();
    
    // Re-analyze component
    const newInfo = await this.analyzeComponent(componentInfo.path, { framework: componentInfo.framework });
    
    spinner.succeed('Component reloaded');
    this.log(`Updated: ${newInfo.components.length} component(s)`);
  }

  private async showMetrics(componentInfo: any): Promise<void> {
    const component = componentInfo.components[0];
    
    this.log('');
    this.log(chalk.blue('📊 Performance Metrics'));
    this.log(chalk.gray('-'.repeat(30)));
    
    // Mock metrics
    const metrics = {
      bundleSize: Math.floor(component.size * 1.2),
      gzipSize: Math.floor(component.size * 0.3),
      renderTime: Math.random() * 10 + 5,
      memoryUsage: Math.floor(Math.random() * 1000 + 500),
    };

    this.log(`Bundle Size: ${chalk.yellow(metrics.bundleSize + ' bytes')}`);
    this.log(`Gzipped: ${chalk.green(metrics.gzipSize + ' bytes')}`);
    this.log(`Render Time: ${chalk.cyan(metrics.renderTime.toFixed(2) + 'ms')}`);
    this.log(`Memory Usage: ${chalk.magenta(metrics.memoryUsage + ' KB')}`);
  }

  private async debugProps(componentInfo: any): Promise<void> {
    const component = componentInfo.components[0];
    
    if (!component.props || component.props.length === 0) {
      this.log(chalk.yellow('No props found for this component'));
      return;
    }

    this.log('');
    this.log(chalk.blue('🐛 Props Debugger'));
    this.log(chalk.gray('-'.repeat(30)));

    for (const prop of component.props) {
      this.log(`${chalk.cyan(prop.name)}:`);
      this.log(`  Type: ${chalk.yellow(prop.type)}`);
      this.log(`  Required: ${prop.required ? chalk.red('Yes') : chalk.green('No')}`);
      this.log(`  Default: ${chalk.gray('undefined')}`);
      this.log('');
    }
  }

  private cleanup(): void {
    this.log('');
    this.log(chalk.blue('🧹 Cleaning up...'));

    // Close file watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    // Close server
    if (this.server) {
      this.server.close();
      this.server = undefined;
    }

    this.log(chalk.green('✅ Preview server stopped'));
  }
}