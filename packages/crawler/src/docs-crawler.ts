import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { DocumentSource, createLogger } from '@kpc/shared';
import { DocsCrawler, CodeExample, DocumentChange } from './interfaces/crawler';

const logger = createLogger('DocsCrawler');

export class PlaywrightDocsCrawler implements DocsCrawler {
  private browser: Browser | null = null;
  private lastSnapshot: Map<string, Date> = new Map();

  async fetchDocumentation(baseUrl: string): Promise<DocumentSource[]> {
    logger.info(`Fetching documentation from: ${baseUrl}`);
    
    try {
      await this.initBrowser();
      const documents: DocumentSource[] = [];
      
      // 获取文档站点的所有页面链接
      const pageUrls = await this.discoverPages(baseUrl);
      
      for (const url of pageUrls) {
        try {
          const doc = await this.fetchSinglePage(url);
          if (doc) {
            documents.push(doc);
          }
        } catch (error) {
          logger.warn(`Failed to fetch page ${url}: ${error}`);
        }
      }
      
      logger.info(`Fetched ${documents.length} documentation pages`);
      return documents;
      
    } catch (error) {
      logger.error(`Failed to fetch documentation: ${error}`);
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  async extractCodeExamples(html: string): Promise<CodeExample[]> {
    const $ = cheerio.load(html);
    const examples: CodeExample[] = [];
    
    // 查找代码块
    $('pre code, .highlight code, .code-block code').each((_, element) => {
      const $code = $(element);
      const code = $code.text().trim();
      
      if (!code) return;
      
      // 尝试从class属性中提取语言
      let language = 'javascript';
      const classAttr = $code.attr('class') || '';
      const langMatch = classAttr.match(/(?:language-|lang-)(\w+)/);
      if (langMatch) {
        language = langMatch[1];
      }
      
      // 查找标题和描述
      const $parent = $code.closest('pre').parent();
      const title = $parent.prevAll('h1, h2, h3, h4, h5, h6').first().text().trim();
      const description = $parent.prevAll('p').first().text().trim();
      
      examples.push({
        language,
        code,
        title: title || undefined,
        description: description || undefined,
      });
    });
    
    // 查找Vue单文件组件示例
    $('.vue-demo, .demo-block').each((_, element) => {
      const $demo = $(element);
      const code = $demo.find('code').text().trim();
      
      if (code) {
        examples.push({
          language: 'vue',
          code,
          title: $demo.find('.demo-title').text().trim() || undefined,
          description: $demo.find('.demo-description').text().trim() || undefined,
        });
      }
    });
    
    return examples;
  }

  async detectChanges(lastSnapshot: Date): Promise<DocumentChange[]> {
    // TODO: 实现变更检测逻辑
    // 这里需要比较当前页面的lastModified时间与上次快照时间
    return [];
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async discoverPages(baseUrl: string): Promise<string[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const page = await this.browser.newPage();
    const urls = new Set<string>();
    
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      
      // 查找导航链接
      const links = await page.$$eval('a[href]', (elements) =>
        elements
          .map((el) => el.getAttribute('href'))
          .filter((href): href is string => href !== null)
      );
      
      // 过滤和规范化URL
      for (const link of links) {
        const url = this.normalizeUrl(link, baseUrl);
        if (url && this.isDocumentationUrl(url, baseUrl)) {
          urls.add(url);
        }
      }
      
      // 添加基础URL
      urls.add(baseUrl);
      
    } catch (error) {
      logger.warn(`Failed to discover pages from ${baseUrl}: ${error}`);
      urls.add(baseUrl); // 至少返回基础URL
    } finally {
      await page.close();
    }
    
    return Array.from(urls);
  }

  private async fetchSinglePage(url: string): Promise<DocumentSource | null> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const page = await this.browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // 等待内容加载
      await page.waitForTimeout(1000);
      
      // 获取页面内容
      const content = await page.content();
      const title = await page.title();
      
      // 提取代码示例
      const codeBlocks = await this.extractCodeExamples(content);
      
      // 提取纯文本内容
      const textContent = await page.evaluate(() => {
        // 移除script和style标签
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // 获取主要内容区域
        const main = document.querySelector('main, .main-content, .content, article');
        return main ? main.textContent : document.body.textContent;
      });
      
      return {
        url,
        title,
        content: textContent?.trim() || '',
        codeBlocks,
        lastModified: new Date().toISOString(),
      };
      
    } catch (error) {
      logger.error(`Failed to fetch page ${url}: ${error}`);
      return null;
    } finally {
      await page.close();
    }
  }

  private normalizeUrl(href: string, baseUrl: string): string | null {
    try {
      // 处理相对URL
      if (href.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${href}`;
      }
      
      // 处理完整URL
      if (href.startsWith('http')) {
        return href;
      }
      
      // 处理相对路径
      if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        return new URL(href, baseUrl).toString();
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private isDocumentationUrl(url: string, baseUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseObj = new URL(baseUrl);
      
      // 必须是同一个域名
      if (urlObj.hostname !== baseObj.hostname) {
        return false;
      }
      
      // 排除非文档页面
      const excludePatterns = [
        /\.(jpg|jpeg|png|gif|svg|pdf|zip|tar|gz)$/i,
        /\/api\//,
        /\/download/,
        /\/login/,
        /\/register/,
        /\/admin/,
      ];
      
      for (const pattern of excludePatterns) {
        if (pattern.test(url)) {
          return false;
        }
      }
      
      // 包含文档相关路径
      const docPatterns = [
        /\/docs?\//,
        /\/guide/,
        /\/tutorial/,
        /\/components?/,
        /\/examples?/,
        /\/getting-started/,
      ];
      
      return docPatterns.some(pattern => pattern.test(url)) || url === baseUrl;
      
    } catch {
      return false;
    }
  }
}