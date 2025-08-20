import { RepoSnapshot, ComponentSource, DocumentSource } from '@kpc/shared';

export interface ChangeHandler {
  (changes: FileChange[]): Promise<void>;
}

export interface FileChange {
  type: 'added' | 'modified' | 'deleted';
  filePath: string;
  content?: string;
}

export interface SourceCrawler {
  /**
   * 从远程仓库获取代码快照
   */
  fetchRepository(repoUrl: string, branch?: string): Promise<RepoSnapshot>;
  
  /**
   * 监听仓库变更
   */
  watchChanges(repoUrl: string, callback: ChangeHandler): void;
  
  /**
   * 停止监听变更
   */
  stopWatching(repoUrl: string): void;
  
  /**
   * 从本地路径提取组件
   */
  extractComponents(repoPath: string): Promise<ComponentSource[]>;
  
  /**
   * 检查仓库是否有更新
   */
  checkForUpdates(repoUrl: string, lastCommit: string): Promise<boolean>;
}

export interface DocsCrawler {
  /**
   * 抓取文档站点
   */
  fetchDocumentation(baseUrl: string): Promise<DocumentSource[]>;
  
  /**
   * 从HTML中提取代码示例
   */
  extractCodeExamples(html: string): CodeExample[];
  
  /**
   * 检测文档变更
   */
  detectChanges(lastSnapshot: Date): Promise<DocumentChange[]>;
}

export interface CodeExample {
  language: string;
  code: string;
  title?: string;
  description?: string;
}

export interface DocumentChange {
  url: string;
  type: 'added' | 'modified' | 'deleted';
  lastModified: Date;
}