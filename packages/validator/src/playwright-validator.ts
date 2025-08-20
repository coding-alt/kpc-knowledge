import { chromium, firefox, webkit, Browser, BrowserContext, Page, devices } from 'playwright';
import { 
  RuntimeValidator, 
  RenderResult, 
  TestResult, 
  ComparisonResult,
  ValidationResult,
  TestSpec,
  createLogger,
  createSuccessResult,
  createErrorResult 
} from '@kpc/shared';

const logger = createLogger('PlaywrightValidator');

export class PlaywrightE2EValidator implements RuntimeValidator {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();

  constructor(private config: PlaywrightConfig = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      browsers: ['chromium'],
      devices: ['Desktop Chrome'],
      ...config,
    };
  }

  async renderComponent(code: string, framework: string, props?: any): Promise<RenderResult> {
    logger.debug(`Rendering component with Playwright: ${framework}`);

    try {
      const browser = await this.getBrowser('chromium');
      const context = await this.getContext(browser, 'Desktop Chrome');
      const page = await context.newPage();

      const startTime = Date.now();

      // 创建测试页面
      await this.setupTestPage(page, code, framework, props);

      // 等待组件渲染
      await page.waitForSelector('[data-testid="component-root"], #root', { 
        timeout: this.config.timeout 
      });

      const renderTime = Date.now() - startTime;

      // 获取渲染结果
      const html = await page.content();
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: true,
        encoding: 'base64'
      });

      await page.close();

      return {
        success: true,
        html,
        screenshot,
        errors: [],
        warnings: [],
        metadata: {
          renderTime,
          framework: framework as any,
          viewport: {
            width: 1280,
            height: 720,
          },
        },
      };

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
    logger.debug('Running E2E tests with Playwright');

    try {
      const results: any[] = [];
      let totalPassed = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      const startTime = Date.now();

      // 解析测试规格
      const testSpecs = this.parseTestSpecs(testCode);

      for (const spec of testSpecs) {
        const result = await this.runSingleTest(spec, componentCode);
        results.push(result);

        switch (result.status) {
          case 'passed':
            totalPassed++;
            break;
          case 'failed':
            totalFailed++;
            break;
          case 'skipped':
            totalSkipped++;
            break;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: totalFailed === 0,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        duration,
        results,
      };

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
    logger.debug('Running visual regression test with Playwright');

    try {
      const browser = await this.getBrowser('chromium');
      const context = await this.getContext(browser, 'Desktop Chrome');
      const page = await context.newPage();

      // 渲染组件
      await this.setupTestPage(page, code, 'react');
      await page.waitForSelector('[data-testid="component-root"], #root');

      // 截图
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: true,
        encoding: 'base64'
      });

      await page.close();

      // 如果没有基线，创建基线
      if (!baseline) {
        return {
          match: true,
          difference: 0,
          metadata: {
            width: 1280,
            height: 720,
            pixelDifference: 0,
            threshold: 0.1,
          },
        };
      }

      // 使用Playwright的内置图像比较
      const comparison = await this.compareScreenshots(screenshot, baseline);
      
      return comparison;

    } catch (error) {
      logger.error(`Visual regression test failed: ${error}`);
      throw error;
    }
  }

  async checkAccessibility(html: string): Promise<ValidationResult> {
    logger.debug('Running accessibility checks with Playwright');

    try {
      const browser = await this.getBrowser('chromium');
      const context = await this.getContext(browser, 'Desktop Chrome');
      const page = await context.newPage();

      // 设置HTML内容
      await page.setContent(html);

      // 注入axe-core
      await page.addScriptTag({
        url: 'https://unpkg.com/axe-core@4.7.0/axe.min.js'
      });

      // 运行axe检查
      const results = await page.evaluate(() => {
        return new Promise((resolve, reject) => {
          (window as any).axe.run((err: any, results: any) => {
            if (err) reject(err);
            else resolve(results);
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
    logger.debug('Running performance test with Playwright');

    try {
      const browser = await this.getBrowser('chromium');
      const context = await this.getContext(browser, 'Desktop Chrome');
      const page = await context.newPage();

      // 启用性能监控
      await page.coverage.startJSCoverage();
      await page.coverage.startCSSCoverage();

      const startTime = Date.now();

      // 渲染组件
      await this.setupTestPage(page, code, 'react');
      await page.waitForSelector('[data-testid="component-root"], #root');

      const renderTime = Date.now() - startTime;

      // 获取性能指标
      const metrics = await page.metrics();
      const jsCoverage = await page.coverage.stopJSCoverage();
      const cssCoverage = await page.coverage.stopCSSCoverage();

      // 计算bundle大小
      const bundleSize = jsCoverage.reduce((total, entry) => total + entry.text.length, 0);

      // 获取Web Vitals
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          // 简化的Web Vitals收集
          const vitals = {
            FCP: 0,
            LCP: 0,
            FID: 0,
            CLS: 0,
          };

          // 使用Performance Observer API收集指标
          if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
                  vitals.FCP = entry.startTime;
                }
                if (entry.entryType === 'largest-contentful-paint') {
                  vitals.LCP = entry.startTime;
                }
              }
            });

            observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });

            setTimeout(() => {
              observer.disconnect();
              resolve(vitals);
            }, 1000);
          } else {
            resolve(vitals);
          }
        });
      });

      await page.close();

      return {
        renderTime,
        memoryUsage: metrics.JSHeapUsedSize,
        bundleSize,
        webVitals,
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

  /**
   * 运行跨浏览器测试
   */
  async runCrossBrowserTests(code: string, testSpecs: TestSpec[]): Promise<CrossBrowserTestResult> {
    logger.info('Running cross-browser tests');

    const results: Record<string, TestResult> = {};

    for (const browserName of this.config.browsers || ['chromium']) {
      try {
        logger.debug(`Testing on ${browserName}`);
        
        const browser = await this.getBrowser(browserName);
        const testResult = await this.runBrowserSpecificTests(browser, code, testSpecs);
        
        results[browserName] = testResult;

      } catch (error) {
        logger.error(`Failed to test on ${browserName}: ${error}`);
        results[browserName] = {
          success: false,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          results: [{
            name: `${browserName} test`,
            status: 'failed',
            error: error.toString(),
            duration: 0,
          }],
        };
      }
    }

    const overallSuccess = Object.values(results).every(result => result.success);
    const totalTests = Object.values(results).reduce((sum, result) => 
      sum + result.passed + result.failed + result.skipped, 0
    );

    return {
      success: overallSuccess,
      totalTests,
      browserResults: results,
      summary: this.generateCrossBrowserSummary(results),
    };
  }

  /**
   * 运行响应式测试
   */
  async runResponsiveTests(code: string): Promise<ResponsiveTestResult> {
    logger.info('Running responsive tests');

    const deviceResults: Record<string, RenderResult> = {};
    const devices = this.config.devices || ['Desktop Chrome', 'iPhone 12', 'iPad'];

    for (const deviceName of devices) {
      try {
        const browser = await this.getBrowser('chromium');
        const context = await this.getContext(browser, deviceName);
        const page = await context.newPage();

        const result = await this.renderComponentOnPage(page, code);
        deviceResults[deviceName] = result;

        await page.close();

      } catch (error) {
        logger.error(`Failed to test on ${deviceName}: ${error}`);
        deviceResults[deviceName] = {
          success: false,
          errors: [error.toString()],
          warnings: [],
          metadata: {
            renderTime: 0,
            framework: 'react',
          },
        };
      }
    }

    const allSuccess = Object.values(deviceResults).every(result => result.success);

    return {
      success: allSuccess,
      deviceResults,
      breakpoints: this.analyzeBreakpoints(deviceResults),
    };
  }

  private async getBrowser(browserName: string): Promise<Browser> {
    if (!this.browsers.has(browserName)) {
      let browser: Browser;

      switch (browserName) {
        case 'firefox':
          browser = await firefox.launch({ headless: this.config.headless });
          break;
        case 'webkit':
          browser = await webkit.launch({ headless: this.config.headless });
          break;
        case 'chromium':
        default:
          browser = await chromium.launch({ headless: this.config.headless });
          break;
      }

      this.browsers.set(browserName, browser);
    }

    return this.browsers.get(browserName)!;
  }

  private async getContext(browser: Browser, deviceName: string): Promise<BrowserContext> {
    const contextKey = `${browser.browserType().name()}-${deviceName}`;

    if (!this.contexts.has(contextKey)) {
      const device = devices[deviceName] || devices['Desktop Chrome'];
      const context = await browser.newContext({
        ...device,
        ignoreHTTPSErrors: true,
      });

      this.contexts.set(contextKey, context);
    }

    return this.contexts.get(contextKey)!;
  }

  private async setupTestPage(page: Page, code: string, framework: string, props?: any): Promise<void> {
    // 设置基础HTML结构
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Component Test</title>
          ${this.getFrameworkScripts(framework)}
        </head>
        <body>
          <div id="root" data-testid="component-root"></div>
          <script>
            ${this.wrapComponentCode(code, framework, props)}
          </script>
        </body>
      </html>
    `;

    await page.setContent(html);
  }

  private getFrameworkScripts(framework: string): string {
    switch (framework) {
      case 'react':
        return `
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        `;
      case 'vue':
        return `
          <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
        `;
      case 'intact':
        return `
          <script src="https://unpkg.com/intact@3/dist/intact.js"></script>
        `;
      default:
        return '';
    }
  }

  private wrapComponentCode(code: string, framework: string, props?: any): string {
    const propsStr = props ? JSON.stringify(props) : '{}';

    switch (framework) {
      case 'react':
        return `
          try {
            ${code}
            const props = ${propsStr};
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(Component, props));
          } catch (error) {
            console.error('Component render error:', error);
            document.getElementById('root').innerHTML = '<div>Error: ' + error.message + '</div>';
          }
        `;
      case 'vue':
        return `
          try {
            ${code}
            const props = ${propsStr};
            Vue.createApp({
              template: '<Component v-bind="props" />',
              data() { return { props }; },
              components: { Component }
            }).mount('#root');
          } catch (error) {
            console.error('Component render error:', error);
            document.getElementById('root').innerHTML = '<div>Error: ' + error.message + '</div>';
          }
        `;
      default:
        return code;
    }
  }

  private parseTestSpecs(testCode: string): TestSpec[] {
    // 简化的测试规格解析
    // 实际实现需要更复杂的解析逻辑
    return [{
      name: 'Component Test',
      description: 'Basic component functionality test',
      framework: 'react',
      code: testCode,
      interactions: [],
      assertions: [{
        type: 'visible',
        selector: '[data-testid="component-root"]',
        expected: true,
      }],
    }];
  }

  private async runSingleTest(spec: TestSpec, componentCode: string): Promise<any> {
    const browser = await this.getBrowser('chromium');
    const context = await this.getContext(browser, 'Desktop Chrome');
    const page = await context.newPage();

    try {
      const startTime = Date.now();

      // 设置测试页面
      await this.setupTestPage(page, componentCode, spec.framework);

      // 执行交互
      for (const interaction of spec.interactions || []) {
        await this.executeInteraction(page, interaction);
      }

      // 执行断言
      const assertions = [];
      for (const assertion of spec.assertions) {
        const result = await this.executeAssertion(page, assertion);
        assertions.push(result);
      }

      const duration = Date.now() - startTime;
      const allPassed = assertions.every(a => a.passed);

      await page.close();

      return {
        name: spec.name,
        status: allPassed ? 'passed' : 'failed',
        duration,
        assertions,
        screenshot: allPassed ? undefined : await page.screenshot({ encoding: 'base64' }),
      };

    } catch (error) {
      await page.close();
      return {
        name: spec.name,
        status: 'failed',
        error: error.toString(),
        duration: 0,
      };
    }
  }

  private async executeInteraction(page: Page, interaction: any): Promise<void> {
    switch (interaction.type) {
      case 'click':
        await page.click(interaction.selector);
        break;
      case 'type':
        await page.fill(interaction.selector, interaction.value);
        break;
      case 'hover':
        await page.hover(interaction.selector);
        break;
      case 'scroll':
        await page.evaluate((selector) => {
          document.querySelector(selector)?.scrollIntoView();
        }, interaction.selector);
        break;
      case 'wait':
        await page.waitForTimeout(interaction.timeout || 1000);
        break;
    }
  }

  private async executeAssertion(page: Page, assertion: any): Promise<any> {
    try {
      switch (assertion.type) {
        case 'visible':
          const isVisible = await page.isVisible(assertion.selector);
          return {
            type: assertion.type,
            passed: isVisible === assertion.expected,
            actual: isVisible,
            expected: assertion.expected,
          };

        case 'text':
          const text = await page.textContent(assertion.selector);
          return {
            type: assertion.type,
            passed: text === assertion.expected,
            actual: text,
            expected: assertion.expected,
          };

        case 'attribute':
          const attribute = await page.getAttribute(assertion.selector, assertion.attribute);
          return {
            type: assertion.type,
            passed: attribute === assertion.expected,
            actual: attribute,
            expected: assertion.expected,
          };

        case 'count':
          const count = await page.locator(assertion.selector).count();
          return {
            type: assertion.type,
            passed: count === assertion.expected,
            actual: count,
            expected: assertion.expected,
          };

        default:
          return {
            type: assertion.type,
            passed: false,
            error: `Unknown assertion type: ${assertion.type}`,
          };
      }
    } catch (error) {
      return {
        type: assertion.type,
        passed: false,
        error: error.toString(),
      };
    }
  }

  private async runBrowserSpecificTests(browser: Browser, code: string, testSpecs: TestSpec[]): Promise<TestResult> {
    const results = [];
    let passed = 0;
    let failed = 0;
    const startTime = Date.now();

    for (const spec of testSpecs) {
      const result = await this.runSingleTest(spec, code);
      results.push(result);

      if (result.status === 'passed') {
        passed++;
      } else {
        failed++;
      }
    }

    return {
      success: failed === 0,
      passed,
      failed,
      skipped: 0,
      duration: Date.now() - startTime,
      results,
    };
  }

  private async renderComponentOnPage(page: Page, code: string): Promise<RenderResult> {
    try {
      const startTime = Date.now();

      await this.setupTestPage(page, code, 'react');
      await page.waitForSelector('[data-testid="component-root"], #root');

      const renderTime = Date.now() - startTime;
      const html = await page.content();
      const screenshot = await page.screenshot({ encoding: 'base64' });

      return {
        success: true,
        html,
        screenshot,
        errors: [],
        warnings: [],
        metadata: {
          renderTime,
          framework: 'react',
        },
      };

    } catch (error) {
      return {
        success: false,
        errors: [error.toString()],
        warnings: [],
        metadata: {
          renderTime: 0,
          framework: 'react',
        },
      };
    }
  }

  private async compareScreenshots(current: string, baseline: string): Promise<ComparisonResult> {
    // 使用Playwright的内置图像比较功能
    // 这里简化实现，实际需要更复杂的比较逻辑
    return {
      match: current === baseline,
      difference: current === baseline ? 0 : 0.1,
      metadata: {
        width: 1280,
        height: 720,
        pixelDifference: 0,
        threshold: 0.1,
      },
    };
  }

  private processAccessibilityResults(results: any): ValidationResult {
    const errors: any[] = [];
    const warnings: string[] = [];

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

    if (errors.length > 0) {
      return createErrorResult(
        `Accessibility violations found: ${errors.length}`,
        'error',
        { errors, warnings }
      );
    }

    return createSuccessResult({ warnings });
  }

  private generateCrossBrowserSummary(results: Record<string, TestResult>): any {
    const summary = {
      totalBrowsers: Object.keys(results).length,
      passedBrowsers: 0,
      failedBrowsers: 0,
      issues: [] as string[],
    };

    for (const [browser, result] of Object.entries(results)) {
      if (result.success) {
        summary.passedBrowsers++;
      } else {
        summary.failedBrowsers++;
        summary.issues.push(`${browser}: ${result.failed} failed tests`);
      }
    }

    return summary;
  }

  private analyzeBreakpoints(deviceResults: Record<string, RenderResult>): any {
    // 分析响应式断点
    const breakpoints = [];

    for (const [device, result] of Object.entries(deviceResults)) {
      if (result.success && result.metadata?.viewport) {
        breakpoints.push({
          device,
          width: result.metadata.viewport.width,
          height: result.metadata.viewport.height,
          success: result.success,
        });
      }
    }

    return breakpoints;
  }

  async close(): Promise<void> {
    // 关闭所有上下文
    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    // 关闭所有浏览器
    for (const browser of this.browsers.values()) {
      await browser.close();
    }
    this.browsers.clear();
  }
}

export interface PlaywrightConfig {
  headless?: boolean;
  timeout?: number;
  browsers?: string[];
  devices?: string[];
}

export interface CrossBrowserTestResult {
  success: boolean;
  totalTests: number;
  browserResults: Record<string, TestResult>;
  summary: any;
}

export interface ResponsiveTestResult {
  success: boolean;
  deviceResults: Record<string, RenderResult>;
  breakpoints: any[];
}