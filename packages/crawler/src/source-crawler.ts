import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';
import { watch, FSWatcher } from 'chokidar';
import { RepoSnapshot, ComponentSource, Framework, createLogger } from '@kpc/shared';
import { SourceCrawler, ChangeHandler, FileChange } from './interfaces/crawler';

const logger = createLogger('SourceCrawler');

export class GitSourceCrawler implements SourceCrawler {
  private git: SimpleGit;
  private watchers: Map<string, FSWatcher> = new Map();
  private tempDir: string;

  constructor(tempDir: string = './temp/repos') {
    this.tempDir = tempDir;
    this.git = simpleGit();
    fs.ensureDirSync(this.tempDir);
  }

  async fetchRepository(repoUrl: string, branch: string = 'main'): Promise<RepoSnapshot> {
    logger.info(`Fetching repository: ${repoUrl}`);
    
    const repoName = this.getRepoName(repoUrl);
    const localPath = path.join(this.tempDir, repoName);
    
    try {
      // 清理已存在的目录
      if (await fs.pathExists(localPath)) {
        await fs.remove(localPath);
      }
      
      // 克隆仓库
      await this.git.clone(repoUrl, localPath, ['--depth', '1', '--branch', branch]);
      
      const repoGit = simpleGit(localPath);
      const log = await repoGit.log(['-1']);
      const latestCommit = log.latest;
      
      if (!latestCommit) {
        throw new Error('No commits found in repository');
      }
      
      // 提取组件和文档
      const components = await this.extractComponents(localPath);
      const docs = await this.extractDocuments(localPath);
      
      const snapshot: RepoSnapshot = {
        commit: latestCommit.hash,
        timestamp: new Date().toISOString(),
        components,
        docs,
        metadata: {
          branch,
          author: latestCommit.author_name,
          message: latestCommit.message,
        },
      };
      
      logger.info(`Repository snapshot created: ${components.length} components, ${docs.length} docs`);
      return snapshot;
      
    } catch (error) {
      logger.error(`Failed to fetch repository: ${error}`);
      throw error;
    }
  }

  async extractComponents(repoPath: string): Promise<ComponentSource[]> {
    logger.info(`Extracting components from: ${repoPath}`);
    
    const components: ComponentSource[] = [];
    const componentPatterns = [
      '**/*.tsx',
      '**/*.jsx', 
      '**/*.vue',
      '**/*.ts',
      '**/*.js'
    ];
    
    // 排除的目录
    const excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/test/**',
      '**/tests/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*'
    ];
    
    try {
      const glob = await import('glob');
      
      for (const pattern of componentPatterns) {
        const files = await glob.glob(pattern, {
          cwd: repoPath,
          ignore: excludePatterns,
          absolute: true,
        });
        
        for (const filePath of files) {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);
            const relativePath = path.relative(repoPath, filePath);
            
            const framework = this.inferFramework(filePath, content);
            if (framework) {
              components.push({
                filePath: relativePath,
                framework,
                content,
                lastModified: stats.mtime.toISOString(),
                dependencies: this.extractDependencies(content),
                exports: this.extractExports(content),
              });
            }
          } catch (error) {
            logger.warn(`Failed to process file ${filePath}: ${error}`);
          }
        }
      }
      
      logger.info(`Extracted ${components.length} component files`);
      return components;
      
    } catch (error) {
      logger.error(`Failed to extract components: ${error}`);
      throw error;
    }
  }

  watchChanges(repoUrl: string, callback: ChangeHandler): void {
    const repoName = this.getRepoName(repoUrl);
    const localPath = path.join(this.tempDir, repoName);
    
    if (this.watchers.has(repoUrl)) {
      logger.warn(`Already watching repository: ${repoUrl}`);
      return;
    }
    
    logger.info(`Starting to watch changes in: ${repoUrl}`);
    
    const watcher = watch(localPath, {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
      ],
      persistent: true,
      ignoreInitial: true,
    });
    
    const handleChange = async (eventType: 'add' | 'change' | 'unlink', filePath: string) => {
      try {
        const relativePath = path.relative(localPath, filePath);
        const changes: FileChange[] = [];
        
        if (eventType === 'unlink') {
          changes.push({
            type: 'deleted',
            filePath: relativePath,
          });
        } else {
          const content = await fs.readFile(filePath, 'utf-8');
          changes.push({
            type: eventType === 'add' ? 'added' : 'modified',
            filePath: relativePath,
            content,
          });
        }
        
        await callback(changes);
      } catch (error) {
        logger.error(`Error handling file change: ${error}`);
      }
    };
    
    watcher
      .on('add', (filePath) => handleChange('add', filePath))
      .on('change', (filePath) => handleChange('change', filePath))
      .on('unlink', (filePath) => handleChange('unlink', filePath));
    
    this.watchers.set(repoUrl, watcher);
  }

  stopWatching(repoUrl: string): void {
    const watcher = this.watchers.get(repoUrl);
    if (watcher) {
      watcher.close();
      this.watchers.delete(repoUrl);
      logger.info(`Stopped watching repository: ${repoUrl}`);
    }
  }

  async checkForUpdates(repoUrl: string, lastCommit: string): Promise<boolean> {
    try {
      const repoName = this.getRepoName(repoUrl);
      const localPath = path.join(this.tempDir, repoName);
      
      if (!await fs.pathExists(localPath)) {
        return true; // 本地不存在，需要更新
      }
      
      const repoGit = simpleGit(localPath);
      await repoGit.fetch();
      
      const log = await repoGit.log(['-1']);
      const latestCommit = log.latest;
      
      return latestCommit?.hash !== lastCommit;
    } catch (error) {
      logger.error(`Failed to check for updates: ${error}`);
      return false;
    }
  }

  private async extractDocuments(repoPath: string): Promise<any[]> {
    // TODO: 实现文档提取逻辑
    return [];
  }

  private getRepoName(repoUrl: string): string {
    const match = repoUrl.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : 'unknown-repo';
  }

  private inferFramework(filePath: string, content: string): Framework | null {
    const ext = path.extname(filePath);
    
    if (ext === '.vue') {
      return 'vue';
    }
    
    if (['.tsx', '.jsx'].includes(ext)) {
      return 'react';
    }
    
    if (['.ts', '.js'].includes(ext)) {
      // 通过内容分析判断框架
      if (content.includes('from \'react\'') || content.includes('from "react"')) {
        return 'react';
      }
      if (content.includes('from \'vue\'') || content.includes('from "vue"')) {
        return 'vue';
      }
      if (content.includes('from \'intact\'') || content.includes('from "intact"')) {
        return 'intact';
      }
    }
    
    return null;
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // 匹配 export default
    if (content.includes('export default')) {
      exports.push('default');
    }
    
    // 匹配 export const/function/class
    const namedExportRegex = /export\s+(?:const|function|class)\s+(\w+)/g;
    let match;
    
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }
}