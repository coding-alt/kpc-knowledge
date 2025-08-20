import { TestSuiteResult, TestSuiteConfig } from './test-suite-runner';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Test Reporter
 * 
 * Generates comprehensive test reports in multiple formats
 */
export class TestReporter {
  private config: TestSuiteConfig;

  constructor(config: TestSuiteConfig) {
    this.config = config;
  }

  /**
   * Generate reports in all configured formats
   */
  async generateReports(result: TestSuiteResult): Promise<string[]> {
    const outputPaths: string[] = [];

    // Ensure output directory exists
    if (!existsSync(this.config.reporting.outputPath)) {
      mkdirSync(this.config.reporting.outputPath, { recursive: true });
    }

    for (const format of this.config.reporting.formats) {
      const outputPath = await this.generateReport(result, format);
      outputPaths.push(outputPath);
    }

    return outputPaths;
  }

  /**
   * Generate a single report in the specified format
   */
  private async generateReport(result: TestSuiteResult, format: 'json' | 'html' | 'junit'): Promise<string> {
    const timestamp = result.timestamp.toISOString().replace(/[:.]/g, '-');
    const filename = `test-report-${timestamp}.${format}`;
    const outputPath = join(this.config.reporting.outputPath, filename);

    switch (format) {
      case 'json':
        return this.generateJSONReport(result, outputPath);
      case 'html':
        return this.generateHTMLReport(result, outputPath);
      case 'junit':
        return this.generateJUnitReport(result, outputPath);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Generate JSON report
   */
  private generateJSONReport(result: TestSuiteResult, outputPath: string): string {
    const jsonReport = {
      metadata: {
        timestamp: result.timestamp,
        version: '1.0.0',
        generator: 'KPC Test Suite Runner',
      },
      config: result.config,
      summary: result.summary,
      results: result.results,
      errors: result.errors,
    };

    writeFileSync(outputPath, JSON.stringify(jsonReport, null, 2), 'utf8');
    return outputPath;
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(result: TestSuiteResult, outputPath: string): string {
    const html = this.generateHTMLContent(result);
    writeFileSync(outputPath, html, 'utf8');
    return outputPath;
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnitReport(result: TestSuiteResult, outputPath: string): string {
    const xml = this.generateJUnitXML(result);
    writeFileSync(outputPath, xml, 'utf8');
    return outputPath;
  }

  private generateHTMLContent(result: TestSuiteResult): string {
    const passRate = (result.summary.overallPassRate * 100).toFixed(1);
    const statusClass = result.summary.overallPassRate >= 0.9 ? 'success' : 
                       result.summary.overallPassRate >= 0.7 ? 'warning' : 'danger';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KPC Knowledge System Test Report</title>
    <style>
        ${this.getHTMLStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>KPC Knowledge System Test Report</h1>
            <div class="meta">
                <span>Generated: ${result.timestamp.toLocaleString()}</span>
                <span>Execution Time: ${(result.summary.executionTime / 1000).toFixed(1)}s</span>
            </div>
        </header>

        <section class="summary">
            <h2>Test Summary</h2>
            <div class="summary-grid">
                <div class="summary-card ${statusClass}">
                    <h3>Overall Pass Rate</h3>
                    <div class="metric">${passRate}%</div>
                    <div class="detail">${result.summary.passedTests}/${result.summary.totalTests} tests passed</div>
                </div>
                <div class="summary-card">
                    <h3>Total Tests</h3>
                    <div class="metric">${result.summary.totalTests}</div>
                    <div class="detail">Across all test types</div>
                </div>
                <div class="summary-card">
                    <h3>Execution Time</h3>
                    <div class="metric">${(result.summary.executionTime / 1000).toFixed(1)}s</div>
                    <div class="detail">Total runtime</div>
                </div>
                <div class="summary-card">
                    <h3>Failed Tests</h3>
                    <div class="metric ${result.summary.failedTests > 0 ? 'danger' : 'success'}">${result.summary.failedTests}</div>
                    <div class="detail">Require attention</div>
                </div>
            </div>
        </section>

        ${this.generateAccuracySection(result.results.accuracy)}
        ${this.generateCompilationSection(result.results.compilation)}
        ${this.generateVisualSection(result.results.visual)}
        ${this.generatePerformanceSection(result.results.performance)}

        ${result.errors.length > 0 ? this.generateErrorsSection(result.errors) : ''}

        <footer class="footer">
            <p>Generated by KPC Knowledge System Test Suite Runner v1.0.0</p>
        </footer>
    </div>
</body>
</html>`;
  }

  private generateAccuracySection(result: any): string {
    if (!result) return '';

    const statusClass = result.passed ? 'success' : 'danger';
    const uastAccuracy = (result.metrics.uastAccuracy * 100).toFixed(1);
    const codeAccuracy = (result.metrics.codeAccuracy * 100).toFixed(1);
    const componentAccuracy = (result.metrics.componentInfoAccuracy * 100).toFixed(1);

    return `
        <section class="test-section">
            <h2>Accuracy Tests <span class="status ${statusClass}">${result.passed ? 'PASSED' : 'FAILED'}</span></h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>UAST Accuracy</h4>
                    <div class="metric-value">${uastAccuracy}%</div>
                    <div class="threshold">Threshold: ${(result.thresholds.uastAccuracy * 100).toFixed(1)}%</div>
                </div>
                <div class="metric-card">
                    <h4>Code Accuracy</h4>
                    <div class="metric-value">${codeAccuracy}%</div>
                    <div class="threshold">Threshold: ${(result.thresholds.codeAccuracy * 100).toFixed(1)}%</div>
                </div>
                <div class="metric-card">
                    <h4>Component Info Accuracy</h4>
                    <div class="metric-value">${componentAccuracy}%</div>
                    <div class="threshold">Threshold: ${(result.thresholds.componentInfoAccuracy * 100).toFixed(1)}%</div>
                </div>
            </div>
            ${result.errors.length > 0 ? `
                <div class="errors">
                    <h4>Errors:</h4>
                    <ul>
                        ${result.errors.map((error: string) => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </section>`;
  }

  private generateCompilationSection(result: any): string {
    if (!result) return '';

    const statusClass = result.passed ? 'success' : 'danger';
    const passRate = (result.metrics.passRate * 100).toFixed(1);

    return `
        <section class="test-section">
            <h2>Compilation Tests <span class="status ${statusClass}">${result.passed ? 'PASSED' : 'FAILED'}</span></h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>Pass Rate</h4>
                    <div class="metric-value">${passRate}%</div>
                    <div class="threshold">Threshold: ${(result.thresholds.passRate * 100).toFixed(1)}%</div>
                </div>
                <div class="metric-card">
                    <h4>Total Tests</h4>
                    <div class="metric-value">${result.metrics.totalTests}</div>
                    <div class="detail">${result.metrics.passedTests} passed, ${result.metrics.failedTests} failed</div>
                </div>
            </div>
            <div class="framework-breakdown">
                <h4>Framework Breakdown:</h4>
                <div class="framework-grid">
                    ${Object.entries(result.metrics.frameworkBreakdown).map(([framework, count]) => `
                        <div class="framework-card">
                            <div class="framework-name">${framework}</div>
                            <div class="framework-count">${count}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ${result.errors.length > 0 ? `
                <div class="errors">
                    <h4>Errors:</h4>
                    <ul>
                        ${result.errors.map((error: string) => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </section>`;
  }

  private generateVisualSection(result: any): string {
    if (!result) return '';

    const statusClass = result.passed ? 'success' : 'danger';
    const stabilityRate = (result.metrics.stabilityRate * 100).toFixed(1);

    return `
        <section class="test-section">
            <h2>Visual Regression Tests <span class="status ${statusClass}">${result.passed ? 'PASSED' : 'FAILED'}</span></h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>Stability Rate</h4>
                    <div class="metric-value">${stabilityRate}%</div>
                    <div class="threshold">Threshold: ${(result.thresholds.stabilityRate * 100).toFixed(1)}%</div>
                </div>
                <div class="metric-card">
                    <h4>Total Snapshots</h4>
                    <div class="metric-value">${result.metrics.totalSnapshots}</div>
                    <div class="detail">${result.metrics.stableSnapshots} stable, ${result.metrics.changedSnapshots} changed</div>
                </div>
            </div>
            ${result.errors.length > 0 ? `
                <div class="errors">
                    <h4>Changes Detected:</h4>
                    <ul>
                        ${result.errors.map((error: string) => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </section>`;
  }

  private generatePerformanceSection(result: any): string {
    if (!result) return '';

    const statusClass = result.passed ? 'success' : 'danger';

    return `
        <section class="test-section">
            <h2>Performance Tests <span class="status ${statusClass}">${result.passed ? 'PASSED' : 'FAILED'}</span></h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>Avg Generation Time</h4>
                    <div class="metric-value">${result.metrics.averageGenerationTime.toFixed(0)}ms</div>
                    <div class="threshold">Threshold: ${result.thresholds.maxGenerationTime}ms</div>
                </div>
                <div class="metric-card">
                    <h4>Avg Validation Time</h4>
                    <div class="metric-value">${result.metrics.averageValidationTime.toFixed(0)}ms</div>
                    <div class="threshold">Threshold: ${result.thresholds.maxValidationTime}ms</div>
                </div>
                <div class="metric-card">
                    <h4>Avg Render Time</h4>
                    <div class="metric-value">${result.metrics.averageRenderTime.toFixed(0)}ms</div>
                    <div class="threshold">Threshold: ${result.thresholds.maxRenderTime}ms</div>
                </div>
                <div class="metric-card">
                    <h4>Throughput</h4>
                    <div class="metric-value">${result.metrics.throughput.toFixed(2)}</div>
                    <div class="detail">entries/second</div>
                </div>
            </div>
            ${result.errors.length > 0 ? `
                <div class="errors">
                    <h4>Performance Issues:</h4>
                    <ul>
                        ${result.errors.map((error: string) => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </section>`;
  }

  private generateErrorsSection(errors: string[]): string {
    return `
        <section class="test-section">
            <h2>System Errors</h2>
            <div class="errors">
                <ul>
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        </section>`;
  }

  private getHTMLStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .meta {
            color: #7f8c8d;
            font-size: 14px;
        }

        .meta span {
            margin-right: 20px;
        }

        .summary {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .summary h2 {
            margin-bottom: 20px;
            color: #2c3e50;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .summary-card {
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #3498db;
        }

        .summary-card.success {
            border-left-color: #27ae60;
            background-color: #d5f4e6;
        }

        .summary-card.warning {
            border-left-color: #f39c12;
            background-color: #fef9e7;
        }

        .summary-card.danger {
            border-left-color: #e74c3c;
            background-color: #fadbd8;
        }

        .summary-card h3 {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 10px;
        }

        .metric {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .metric.danger {
            color: #e74c3c;
        }

        .metric.success {
            color: #27ae60;
        }

        .detail {
            font-size: 12px;
            color: #7f8c8d;
        }

        .test-section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .test-section h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .status {
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
        }

        .status.success {
            background-color: #27ae60;
            color: white;
        }

        .status.danger {
            background-color: #e74c3c;
            color: white;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .metric-card {
            padding: 15px;
            border: 1px solid #ecf0f1;
            border-radius: 6px;
        }

        .metric-card h4 {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 10px;
        }

        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .threshold {
            font-size: 12px;
            color: #7f8c8d;
        }

        .framework-breakdown {
            margin-top: 20px;
        }

        .framework-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }

        .framework-card {
            text-align: center;
            padding: 10px;
            border: 1px solid #ecf0f1;
            border-radius: 4px;
        }

        .framework-name {
            font-size: 12px;
            color: #7f8c8d;
            margin-bottom: 5px;
        }

        .framework-count {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }

        .errors {
            margin-top: 20px;
            padding: 15px;
            background-color: #fadbd8;
            border-radius: 4px;
        }

        .errors h4 {
            color: #e74c3c;
            margin-bottom: 10px;
        }

        .errors ul {
            list-style-type: none;
        }

        .errors li {
            padding: 5px 0;
            border-bottom: 1px solid #f2dede;
        }

        .errors li:last-child {
            border-bottom: none;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #7f8c8d;
            font-size: 12px;
        }
    `;
  }

  private generateJUnitXML(result: TestSuiteResult): string {
    const testSuites = [];

    if (result.results.accuracy) {
      testSuites.push(this.generateJUnitTestSuite('Accuracy Tests', result.results.accuracy));
    }

    if (result.results.compilation) {
      testSuites.push(this.generateJUnitTestSuite('Compilation Tests', result.results.compilation));
    }

    if (result.results.visual) {
      testSuites.push(this.generateJUnitTestSuite('Visual Regression Tests', result.results.visual));
    }

    if (result.results.performance) {
      testSuites.push(this.generateJUnitTestSuite('Performance Tests', result.results.performance));
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="KPC Knowledge System Tests" 
            tests="${result.summary.totalTests}" 
            failures="${result.summary.failedTests}" 
            time="${(result.summary.executionTime / 1000).toFixed(3)}">
${testSuites.join('\n')}
</testsuites>`;
  }

  private generateJUnitTestSuite(name: string, testResult: any): string {
    const tests = 1; // Simplified - each test type is one test case
    const failures = testResult.passed ? 0 : 1;
    const time = 0; // Would need to track individual test times

    return `  <testsuite name="${name}" tests="${tests}" failures="${failures}" time="${time}">
    <testcase name="${name}" classname="KPCTests">
      ${testResult.passed ? '' : `<failure message="Test failed">${testResult.errors.join('\n')}</failure>`}
    </testcase>
  </testsuite>`;
  }
}