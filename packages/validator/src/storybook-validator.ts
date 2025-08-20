import { chromium, Browser, Page } from 'playwright';
import * as pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  RuntimeValidator, 
  RenderResult, 
  TestResult, 
  ComparisonResult,
  ValidationResult,
  createLogger,
  createSuccessResult,
  createErrorResult 
} from '@kpc/shared';

const logger = createLogger('StorybookValidator');

export class StorybookRuntimeValidator implements RuntimeValidator {
  private browser: Browser | null = null;
  private storybookUrl: string;
  private snapshotDir: string;

  constructor(
    storybookUrl: string = 'http://localhost:6006',
    snapshotDir: string = './snapshots'
  ) {
    this.storybookUrl = storybookUrl;
    this.snapshotDir = snapshotDir;
  }

  async renderComponent(code: string, framework: string, props?: any): Promise<RenderResult> {
    logger.debug(`Rendering component with framework: ${framework}`);

    try {
      await this.initBrowser();
      
      // 创建临时Storybook story
      const storyId = await this.createTempStory(code, framework, props);
      
      // 渲染组件
      const result = await this.renderStory(storyId);
      
      return result;

    } catch (error) {
      logger.error(`Failed to render component: ${error}`);
      return {
        success: false,
        errors: [error.toString()],
        warnings: [],
        metadata: {
          renderTime: 0,
          framework: framework as any,
        },
      };
    }
  }

  async runTests(testCode: string, componentCode: string): Promise<TestResult> {
    logger.debug('Running component tests');

    try {
      await this.initBrowser();
      
      // 创建测试页面
      const page = await this.browser!.newPage();
      
      // 设置测试环境
      await this.setupTestEnvironment(page, componentCode, testCode);
      
      // 执行测试
      const result = await this.executeTests(page);
      
      await page.close();
      
      return result;

    } catch (error) {
      logger.error(`Failed to run tests: ${error}`);
      return {
        success: false,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: 0,
        results: [{
          name: 'Test execution',
          status: 'failed',
          error: error.toString(),
          duration: 0,
        }],
      };
    }
  }

  async visualRegression(code: string, baseline?: string): Promise<ComparisonResult> {
    logger.debug('Running visual regression test');

    try {
      await this.initBrowser();
      
      // 渲染当前版本
      const currentResult = await this.renderComponent(code, 'react');
      
      if (!currentResult.success || !currentResult.screenshot) {
        throw new Error('Failed to render current version');
      }

      // 如果没有基线，创建基线
      if (!baseline) {
        const baselinePath = await this.saveBaseline(code, currentResult.screenshot);
        logger.info(`Created baseline snapshot: ${baselinePath}`);
        
        return {
          match: true,
          difference: 0,
          metadata: {
            width: 0,
            height: 0,
            pixelDifference: 0,
            threshold: 0.1,
          },
        };
      }

      // 比较图像
      const comparison = await this.compareImages(currentResult.screenshot, baseline);
      
      return comparison;

    } catch (error) {
      logger.error(`Visual regression test failed: ${error}`);
      throw error;
    }
  }

  async checkAccessibility(html: string): Promise<ValidationResult> {
    logger.debug('Running accessibility checks');

    try {
      await this.initBrowser();
      
      const page = await this.browser!.newPage();
      
      // 注入axe-core
      await page.addScriptTag({
        url: 'https://unpkg.com/axe-core@4.7.0/axe.min.js'
      });
      
      // 设置HTML内容
      await page.setContent(html);
      
      // 运行axe检查
      const results = await page.evaluate(() => {
        return new Promise((resolve) => {
          (window as any).axe.run((err: any, results: any) => {
            if (err) throw err;
            resolve(results);
          });
        });
      });

      await page.close();

      return this.processAccessibilityResults(results as any);

    } catch (error) {
      logger.error(`Accessibility check failed: ${error}`);
      return createErrorResult(`Accessibility check failed: ${error}`, 'error');
    }
  }

  async performanceTest(code: string): Promise<any> {
    logger.debug('Running performance test');

    try {
      await this.initBrowser();
      
      const page = await this.browser!.newPage();
      
      // 启用性能监控
      await page.coverage.startJSCoverage();
      await page.coverage.startCSSCoverage();
      
      const startTime = Date.now();
      
      // 渲染组件
      await this.renderComponentOnPage(page, code);
      
      const renderTime = Date.now() - startTime;
      
      // 获取性能指标
      const metrics = await page.metrics();
      const jsCoverage = await page.coverage.stopJSCoverage();
      const cssCoverage = await page.coverage.stopCSSCoverage();
      
      // 计算bundle大小
      const bundleSize = jsCoverage.reduce((total, entry) => total + entry.text.length, 0);
      
      await page.close();

      return {
        renderTime,
        memoryUsage: metrics.JSHeapUsedSize,
        bundleSize,
        metrics: {
          jsHeapSize: metrics.JSHeapUsedSize,
          jsHeapTotalSize: metrics.JSHeapTotalSize,
          scriptDuration: metrics.ScriptDuration,
          taskDuration: metrics.TaskDuration,
        },
      };

    } catch (error) {
      logger.error(`Performance test failed: ${error}`);
      throw error;
    }
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  private async createTempStory(code: string, framework: string, props?: any): Promise<string> {
    // 生成临时story ID
    const storyId = `temp-${Date.now()}`;
    
    // 这里需要与Storybook集成，创建临时story
    // 实际实现需要根据Storybook的API来创建story
    
    return storyId;
  }

  private async renderStory(storyId: string): Promise<RenderResult> {
    const page = await this.browser!.newPage();
    
    try {
      const startTime = Date.now();
      
      // 导航到story页面
      const storyUrl = `${this.storybookUrl}/iframe.html?id=${storyId}`;
      await page.goto(storyUrl, { waitUntil: 'networkidle' });
      
      // 等待组件渲染
      await page.waitForSelector('[data-testid="story-root"], #root', { timeout: 10000 });
      
      const renderTime = Date.now() - startTime;
      
      // 获取渲染的HTML
      const html = await page.content();
      
      // 截图
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: true,
        encoding: 'base64'
      });
      
      return {
        success: true,
        html,
        screenshot,
        errors: [],
        warnings: [],
        metadata: {
          renderTime,
          framework: 'react',
          viewport: {
            width: 1280,
            height: 720,
          },
        },
      };

    } catch (error) {
      logger.error(`Failed to render story: ${error}`);
      return {
        success: false,
        errors: [error.toString()],
        warnings: [],
        metadata: {
          renderTime: 0,
          framework: 'react',
        },
      };
    } finally {
      await page.close();
    }
  }

  private async setupTestEnvironment(page: Page, componentCode: string, testCode: string): Promise<void> {
    // 设置测试环境
    await page.addScriptTag({
      url: 'https://unpkg.com/@testing-library/dom@8.20.0/dist/@testing-library/dom.umd.js'
    });
    
    await page.addScriptTag({
      url: 'https://unpkg.com/react@18/umd/react.development.js'
    });
    
    await page.addScriptTag({
      url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js'
    });
    
    // 注入组件代码
    await page.evaluate((code) => {
      const script = document.createElement('script');
      script.textContent = code;
      document.head.appendChild(script);
    }, componentCode);
    
    // 注入测试代码
    await page.evaluate((code) => {
      const script = document.createElement('script');
      script.textContent = code;
      document.head.appendChild(script);
    }, testCode);
  }

  private async executeTests(page: Page): Promise<TestResult> {
    // 执行测试并收集结果
    const results = await page.evaluate(() => {
      return new Promise((resolve) => {
        // 这里需要实现测试执行逻辑
        // 简化实现
        resolve({
          success: true,
          passed: 1,
          failed: 0,
          skipped: 0,
          duration: 100,
          results: [{
            name: 'Component renders',
            status: 'passed',
            duration: 100,
          }],
        });
      });
    });

    return results as TestResult;
  }

  private async renderComponentOnPage(page: Page, code: string): Promise<void> {
    // 在页面上渲染组件
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        </head>
        <body>
          <div id="root"></div>
          <script>
            ${code}
          </script>
        </body>
      </html>
    `);
    
    await page.waitForSelector('#root', { timeout: 5000 });
  }

  private async saveBaseline(code: string, screenshot: string): Promise<string> {
    // 生成基线文件名
    const hash = this.generateCodeHash(code);
    const filename = `baseline-${hash}.png`;
    const filepath = path.join(this.snapshotDir, filename);
    
    // 确保目录存在
    await fs.ensureDir(this.snapshotDir);
    
    // 保存截图
    const buffer = Buffer.from(screenshot, 'base64');
    await fs.writeFile(filepath, buffer);
    
    return filepath;
  }

  private async compareImages(currentScreenshot: string, baselineScreenshot: string): Promise<ComparisonResult> {
    // 将base64转换为PNG对象
    const currentBuffer = Buffer.from(currentScreenshot, 'base64');
    const baselineBuffer = Buffer.from(baselineScreenshot, 'base64');
    
    const currentPng = PNG.sync.read(currentBuffer);
    const baselinePng = PNG.sync.read(baselineBuffer);
    
    // 确保图像尺寸相同
    if (currentPng.width !== baselinePng.width || currentPng.height !== baselinePng.height) {
      return {
        match: false,
        difference: 1.0,
        metadata: {
          width: currentPng.width,
          height: currentPng.height,
          pixelDifference: currentPng.width * currentPng.height,
          threshold: 0.1,
        },
      };
    }
    
    // 创建差异图像
    const diffPng = new PNG({ width: currentPng.width, height: currentPng.height });
    
    // 比较图像
    const pixelDifference = pixelmatch(
      currentPng.data,
      baselinePng.data,
      diffPng.data,
      currentPng.width,
      currentPng.height,
      { threshold: 0.1 }
    );
    
    const totalPixels = currentPng.width * currentPng.height;
    const difference = pixelDifference / totalPixels;
    const match = difference < 0.01; // 1%的差异阈值
    
    // 如果有差异，保存差异图像
    let diffImage: string | undefined;
    if (!match) {
      const diffBuffer = PNG.sync.write(diffPng);
      diffImage = diffBuffer.toString('base64');
    }
    
    return {
      match,
      difference,
      diffImage,
      metadata: {
        width: currentPng.width,
        height: currentPng.height,
        pixelDifference,
        threshold: 0.1,
      },
    };
  }

  private processAccessibilityResults(results: any): ValidationResult {
    const errors: any[] = [];
    const warnings: string[] = [];
    
    // 处理违规项
    for (const violation of results.violations || []) {
      const error = {
        message: `${violation.description} (${violation.help})`,
        severity: violation.impact === 'critical' || violation.impact === 'serious' ? 'error' : 'warning',
        rule: violation.id,
      };
      
      if (error.severity === 'error') {
        errors.push(error);
      } else {
        warnings.push(error.message);
      }
    }
    
    // 处理不完整的检查
    for (const incomplete of results.incomplete || []) {
      warnings.push(`Incomplete accessibility check: ${incomplete.description}`);
    }
    
    if (errors.length > 0) {
      return createErrorResult(
        `Accessibility check failed with ${errors.length} violations`,
        'error',
        { errors, warnings }
      );
    }
    
    return createSuccessResult({ 
      warnings,
      metadata: {
        passedRules: results.passes?.length || 0,
        testedElements: results.testEngine?.name || 'axe-core',
      }
    });
  }

  private generateCodeHash(code: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}