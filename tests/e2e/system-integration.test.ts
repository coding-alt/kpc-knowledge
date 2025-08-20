import { test, expect, Page } from '@playwright/test';
import { GraphQLClient } from 'graphql-request';

/**
 * End-to-End System Integration Tests
 * 
 * These tests validate the complete user workflows across all system components
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || 'test-api-key';

const graphqlClient = new GraphQLClient(`${API_URL}/graphql`, {
  headers: {
    authorization: `Bearer ${API_KEY}`,
  },
});

test.describe('System Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto(WEB_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Complete Component Generation Workflow', () => {
    test('should generate, validate, and save a component end-to-end', async ({ page }) => {
      // Step 1: Navigate to code generator
      await page.click('[data-testid="nav-code-generator"]');
      await expect(page.locator('h1')).toContainText('Code Generator');

      // Step 2: Enter requirement
      const requirement = 'Create a responsive button component with primary and secondary variants';
      await page.fill('[data-testid="requirement-input"]', requirement);
      
      // Step 3: Select framework
      await page.selectOption('[data-testid="framework-select"]', 'react');
      
      // Step 4: Configure options
      await page.check('[data-testid="include-tests"]');
      await page.check('[data-testid="include-stories"]');
      
      // Step 5: Generate code
      await page.click('[data-testid="generate-button"]');
      
      // Wait for generation to complete
      await page.waitForSelector('[data-testid="generation-result"]', { timeout: 30000 });
      
      // Verify generation success
      const successMessage = page.locator('[data-testid="generation-status"]');
      await expect(successMessage).toContainText('Generation completed successfully');
      
      // Verify generated code is displayed
      const codeEditor = page.locator('[data-testid="generated-code"]');
      await expect(codeEditor).toBeVisible();
      
      const generatedCode = await codeEditor.textContent();
      expect(generatedCode).toContain('export const Button');
      expect(generatedCode).toContain('primary');
      expect(generatedCode).toContain('secondary');
      
      // Step 6: Validate generated code
      await page.click('[data-testid="validate-button"]');
      await page.waitForSelector('[data-testid="validation-result"]');
      
      const validationStatus = page.locator('[data-testid="validation-status"]');
      await expect(validationStatus).toContainText('Validation passed');
      
      // Step 7: Save component
      await page.fill('[data-testid="component-name"]', 'ResponsiveButton');
      await page.fill('[data-testid="component-description"]', 'A responsive button with variants');
      await page.click('[data-testid="save-component"]');
      
      // Verify save success
      await page.waitForSelector('[data-testid="save-success"]');
      const saveMessage = page.locator('[data-testid="save-success"]');
      await expect(saveMessage).toContainText('Component saved successfully');
    });

    test('should handle generation errors gracefully', async ({ page }) => {
      await page.click('[data-testid="nav-code-generator"]');
      
      // Enter invalid requirement
      await page.fill('[data-testid="requirement-input"]', 'invalid requirement with no clear intent');
      await page.selectOption('[data-testid="framework-select"]', 'react');
      await page.click('[data-testid="generate-button"]');
      
      // Wait for error handling
      await page.waitForSelector('[data-testid="generation-error"]', { timeout: 30000 });
      
      const errorMessage = page.locator('[data-testid="generation-error"]');
      await expect(errorMessage).toBeVisible();
      
      // Verify error details are shown
      const errorDetails = page.locator('[data-testid="error-details"]');
      await expect(errorDetails).toBeVisible();
    });
  });

  test.describe('Component Search and Discovery', () => {
    test('should search and view component details', async ({ page }) => {
      // Navigate to component browser
      await page.click('[data-testid="nav-component-browser"]');
      await expect(page.locator('h1')).toContainText('Component Browser');
      
      // Search for components
      await page.fill('[data-testid="search-input"]', 'button');
      await page.press('[data-testid="search-input"]', 'Enter');
      
      // Wait for search results
      await page.waitForSelector('[data-testid="search-results"]');
      
      // Verify search results
      const searchResults = page.locator('[data-testid="component-card"]');
      await expect(searchResults).toHaveCountGreaterThan(0);
      
      // Click on first result
      await searchResults.first().click();
      
      // Verify component details page
      await page.waitForSelector('[data-testid="component-details"]');
      
      const componentName = page.locator('[data-testid="component-name"]');
      await expect(componentName).toBeVisible();
      
      const componentProps = page.locator('[data-testid="component-props"]');
      await expect(componentProps).toBeVisible();
      
      const componentExamples = page.locator('[data-testid="component-examples"]');
      await expect(componentExamples).toBeVisible();
    });

    test('should filter components by framework', async ({ page }) => {
      await page.click('[data-testid="nav-component-browser"]');
      
      // Apply React filter
      await page.click('[data-testid="filter-react"]');
      await page.waitForSelector('[data-testid="search-results"]');
      
      // Verify all results are React components
      const frameworkBadges = page.locator('[data-testid="framework-badge"]');
      const count = await frameworkBadges.count();
      
      for (let i = 0; i < count; i++) {
        const badge = frameworkBadges.nth(i);
        await expect(badge).toContainText('React');
      }
    });
  });

  test.describe('Code Validation Workflow', () => {
    test('should validate code with multiple validation layers', async ({ page }) => {
      // Navigate to validator
      await page.click('[data-testid="nav-validator"]');
      
      // Enter test code
      const testCode = `
        import React from 'react';
        
        export const TestComponent = ({ title, onClick }) => {
          return (
            <button onClick={onClick}>
              {title}
            </button>
          );
        };
      `;
      
      await page.fill('[data-testid="code-input"]', testCode);
      await page.selectOption('[data-testid="framework-select"]', 'react');
      
      // Run validation
      await page.click('[data-testid="validate-button"]');
      await page.waitForSelector('[data-testid="validation-results"]');
      
      // Check TypeScript validation
      const tsValidation = page.locator('[data-testid="typescript-validation"]');
      await expect(tsValidation).toBeVisible();
      
      // Check ESLint validation
      const eslintValidation = page.locator('[data-testid="eslint-validation"]');
      await expect(eslintValidation).toBeVisible();
      
      // Check accessibility validation
      const a11yValidation = page.locator('[data-testid="accessibility-validation"]');
      await expect(a11yValidation).toBeVisible();
      
      // Verify overall validation status
      const overallStatus = page.locator('[data-testid="overall-validation-status"]');
      await expect(overallStatus).toBeVisible();
    });

    test('should provide auto-fix suggestions', async ({ page }) => {
      await page.click('[data-testid="nav-validator"]');
      
      // Enter code with fixable issues
      const codeWithIssues = `
        import React from 'react';
        
        export const TestComponent = (props) => {
          return (
            <div>
              <button onClick={props.onClick}>
                {props.title}
              </button>
            </div>
          );
        };
      `;
      
      await page.fill('[data-testid="code-input"]', codeWithIssues);
      await page.click('[data-testid="validate-button"]');
      await page.waitForSelector('[data-testid="validation-results"]');
      
      // Check for auto-fix suggestions
      const autoFixSuggestions = page.locator('[data-testid="auto-fix-suggestion"]');
      await expect(autoFixSuggestions).toHaveCountGreaterThan(0);
      
      // Apply first auto-fix
      await autoFixSuggestions.first().click();
      
      // Verify code was updated
      const updatedCode = await page.inputValue('[data-testid="code-input"]');
      expect(updatedCode).not.toBe(codeWithIssues);
    });
  });

  test.describe('System Monitoring and Analytics', () => {
    test('should display system metrics dashboard', async ({ page }) => {
      // Navigate to monitoring dashboard
      await page.click('[data-testid="nav-monitoring"]');
      await expect(page.locator('h1')).toContainText('System Monitoring');
      
      // Verify key metrics are displayed
      const cpuMetric = page.locator('[data-testid="cpu-usage"]');
      await expect(cpuMetric).toBeVisible();
      
      const memoryMetric = page.locator('[data-testid="memory-usage"]');
      await expect(memoryMetric).toBeVisible();
      
      const responseTimeMetric = page.locator('[data-testid="response-time"]');
      await expect(responseTimeMetric).toBeVisible();
      
      const errorRateMetric = page.locator('[data-testid="error-rate"]');
      await expect(errorRateMetric).toBeVisible();
      
      // Verify charts are rendered
      const performanceChart = page.locator('[data-testid="performance-chart"]');
      await expect(performanceChart).toBeVisible();
      
      const usageChart = page.locator('[data-testid="usage-chart"]');
      await expect(usageChart).toBeVisible();
    });

    test('should show real-time updates', async ({ page }) => {
      await page.click('[data-testid="nav-monitoring"]');
      
      // Get initial metric value
      const initialValue = await page.textContent('[data-testid="request-count"]');
      
      // Wait for real-time update (assuming 30-second intervals)
      await page.waitForTimeout(35000);
      
      // Verify metric has updated
      const updatedValue = await page.textContent('[data-testid="request-count"]');
      expect(updatedValue).not.toBe(initialValue);
    });
  });

  test.describe('API Integration', () => {
    test('should handle GraphQL queries correctly', async () => {
      const query = `
        query GetComponents($limit: Int) {
          components(limit: $limit) {
            id
            name
            framework
            description
          }
        }
      `;
      
      const variables = { limit: 5 };
      const response = await graphqlClient.request(query, variables);
      
      expect(response.components).toBeDefined();
      expect(Array.isArray(response.components)).toBe(true);
      expect(response.components.length).toBeLessThanOrEqual(5);
      
      // Verify component structure
      if (response.components.length > 0) {
        const component = response.components[0];
        expect(component.id).toBeDefined();
        expect(component.name).toBeDefined();
        expect(component.framework).toBeDefined();
      }
    });

    test('should handle code generation via API', async () => {
      const mutation = `
        mutation GenerateCode($requirement: String!, $framework: String!) {
          generateCode(requirement: $requirement, framework: $framework) {
            success
            code
            errors {
              message
            }
          }
        }
      `;
      
      const variables = {
        requirement: 'Create a simple button component',
        framework: 'react'
      };
      
      const response = await graphqlClient.request(mutation, variables);
      
      expect(response.generateCode.success).toBe(true);
      expect(response.generateCode.code).toBeDefined();
      expect(response.generateCode.code).toContain('button');
      expect(response.generateCode.errors).toHaveLength(0);
    });

    test('should handle validation via API', async () => {
      const mutation = `
        mutation ValidateCode($code: String!, $framework: String!) {
          validateCode(code: $code, framework: $framework) {
            valid
            errors {
              message
              line
              column
            }
            warnings {
              message
            }
          }
        }
      `;
      
      const variables = {
        code: `
          import React from 'react';
          export const Button = ({ children, onClick }) => (
            <button onClick={onClick}>{children}</button>
          );
        `,
        framework: 'react'
      };
      
      const response = await graphqlClient.request(mutation, variables);
      
      expect(response.validateCode.valid).toBe(true);
      expect(Array.isArray(response.validateCode.errors)).toBe(true);
      expect(Array.isArray(response.validateCode.warnings)).toBe(true);
    });
  });

  test.describe('Cross-Framework Compatibility', () => {
    test('should generate components for all supported frameworks', async ({ page }) => {
      const frameworks = ['react', 'vue', 'intact'];
      const requirement = 'Create a simple card component with title and content';
      
      for (const framework of frameworks) {
        await page.click('[data-testid="nav-code-generator"]');
        await page.fill('[data-testid="requirement-input"]', requirement);
        await page.selectOption('[data-testid="framework-select"]', framework);
        await page.click('[data-testid="generate-button"]');
        
        await page.waitForSelector('[data-testid="generation-result"]', { timeout: 30000 });
        
        const generatedCode = await page.textContent('[data-testid="generated-code"]');
        
        // Verify framework-specific code patterns
        switch (framework) {
          case 'react':
            expect(generatedCode).toContain('import React');
            expect(generatedCode).toContain('export const');
            break;
          case 'vue':
            expect(generatedCode).toContain('<template>');
            expect(generatedCode).toContain('<script');
            break;
          case 'intact':
            expect(generatedCode).toContain('Component');
            expect(generatedCode).toContain('template');
            break;
        }
      }
    });

    test('should validate components for all frameworks', async ({ page }) => {
      const testCases = [
        {
          framework: 'react',
          code: `
            import React from 'react';
            export const Card = ({ title, content }) => (
              <div className="card">
                <h2>{title}</h2>
                <p>{content}</p>
              </div>
            );
          `
        },
        {
          framework: 'vue',
          code: `
            <template>
              <div class="card">
                <h2>{{ title }}</h2>
                <p>{{ content }}</p>
              </div>
            </template>
            <script>
            export default {
              props: ['title', 'content']
            }
            </script>
          `
        }
      ];
      
      for (const testCase of testCases) {
        await page.click('[data-testid="nav-validator"]');
        await page.fill('[data-testid="code-input"]', testCase.code);
        await page.selectOption('[data-testid="framework-select"]', testCase.framework);
        await page.click('[data-testid="validate-button"]');
        
        await page.waitForSelector('[data-testid="validation-results"]');
        
        const validationStatus = page.locator('[data-testid="overall-validation-status"]');
        await expect(validationStatus).toBeVisible();
      }
    });
  });

  test.describe('Performance and Scalability', () => {
    test('should handle concurrent operations', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);
      
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );
      
      // Perform concurrent operations
      const operations = pages.map(async (page, index) => {
        await page.goto(WEB_URL);
        await page.click('[data-testid="nav-code-generator"]');
        await page.fill('[data-testid="requirement-input"]', `Create component ${index}`);
        await page.selectOption('[data-testid="framework-select"]', 'react');
        await page.click('[data-testid="generate-button"]');
        
        return page.waitForSelector('[data-testid="generation-result"]', { timeout: 60000 });
      });
      
      // Wait for all operations to complete
      await Promise.all(operations);
      
      // Verify all operations succeeded
      for (const page of pages) {
        const status = page.locator('[data-testid="generation-status"]');
        await expect(status).toContainText('completed successfully');
      }
      
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });

    test('should maintain performance under load', async ({ page }) => {
      const startTime = Date.now();
      
      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="nav-code-generator"]');
        await page.fill('[data-testid="requirement-input"]', `Create test component ${i}`);
        await page.selectOption('[data-testid="framework-select"]', 'react');
        await page.click('[data-testid="generate-button"]');
        await page.waitForSelector('[data-testid="generation-result"]', { timeout: 30000 });
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify reasonable performance (should complete within 2.5 minutes)
      expect(totalTime).toBeLessThan(150000);
    });
  });

  test.describe('Error Recovery and Resilience', () => {
    test('should recover from network interruptions', async ({ page, context }) => {
      await page.click('[data-testid="nav-code-generator"]');
      await page.fill('[data-testid="requirement-input"]', 'Create a button component');
      
      // Simulate network interruption
      await context.setOffline(true);
      await page.click('[data-testid="generate-button"]');
      
      // Verify error handling
      await page.waitForSelector('[data-testid="network-error"]', { timeout: 10000 });
      
      // Restore network
      await context.setOffline(false);
      
      // Retry operation
      await page.click('[data-testid="retry-button"]');
      await page.waitForSelector('[data-testid="generation-result"]', { timeout: 30000 });
      
      // Verify successful recovery
      const status = page.locator('[data-testid="generation-status"]');
      await expect(status).toContainText('completed successfully');
    });

    test('should handle service unavailability gracefully', async ({ page }) => {
      // This test would require mocking service unavailability
      // For now, we'll test the error handling UI components
      
      await page.click('[data-testid="nav-monitoring"]');
      
      // Check if error states are properly displayed when services are down
      const serviceStatus = page.locator('[data-testid="service-status"]');
      await expect(serviceStatus).toBeVisible();
      
      // Verify error indicators are functional
      const errorIndicators = page.locator('[data-testid="error-indicator"]');
      if (await errorIndicators.count() > 0) {
        await expect(errorIndicators.first()).toBeVisible();
      }
    });
  });

  test.describe('Data Consistency and Integrity', () => {
    test('should maintain data consistency across operations', async ({ page }) => {
      // Create a component
      await page.click('[data-testid="nav-code-generator"]');
      await page.fill('[data-testid="requirement-input"]', 'Create a unique test component');
      await page.selectOption('[data-testid="framework-select"]', 'react');
      await page.click('[data-testid="generate-button"]');
      await page.waitForSelector('[data-testid="generation-result"]');
      
      // Save the component
      const componentName = `TestComponent_${Date.now()}`;
      await page.fill('[data-testid="component-name"]', componentName);
      await page.click('[data-testid="save-component"]');
      await page.waitForSelector('[data-testid="save-success"]');
      
      // Verify component appears in browser
      await page.click('[data-testid="nav-component-browser"]');
      await page.fill('[data-testid="search-input"]', componentName);
      await page.press('[data-testid="search-input"]', 'Enter');
      await page.waitForSelector('[data-testid="search-results"]');
      
      const searchResults = page.locator('[data-testid="component-card"]');
      await expect(searchResults).toHaveCountGreaterThan(0);
      
      // Verify component details are consistent
      await searchResults.first().click();
      await page.waitForSelector('[data-testid="component-details"]');
      
      const displayedName = page.locator('[data-testid="component-name"]');
      await expect(displayedName).toContainText(componentName);
    });
  });
});

test.describe('System Health Checks', () => {
  test('should verify all services are healthy', async () => {
    // Check API health
    const apiHealthResponse = await fetch(`${API_URL}/health`);
    expect(apiHealthResponse.status).toBe(200);
    
    const apiHealth = await apiHealthResponse.json();
    expect(apiHealth.status).toBe('healthy');
    
    // Check database connections
    const dbHealthQuery = `
      query HealthCheck {
        healthCheck {
          status
          services {
            name
            status
            responseTime
          }
        }
      }
    `;
    
    const healthResponse = await graphqlClient.request(dbHealthQuery);
    expect(healthResponse.healthCheck.status).toBe('healthy');
    
    // Verify all critical services are healthy
    const criticalServices = ['database', 'neo4j', 'milvus', 'redis'];
    const services = healthResponse.healthCheck.services;
    
    for (const serviceName of criticalServices) {
      const service = services.find(s => s.name === serviceName);
      expect(service).toBeDefined();
      expect(service.status).toBe('healthy');
    }
  });

  test('should verify system performance benchmarks', async () => {
    const performanceQuery = `
      query GetPerformanceMetrics {
        systemMetrics {
          performance {
            apiLatency
            searchLatency
            generationTime
            validationTime
            cacheHitRate
            errorRate
          }
        }
      }
    `;
    
    const metricsResponse = await graphqlClient.request(performanceQuery);
    const performance = metricsResponse.systemMetrics.performance;
    
    // Verify performance benchmarks
    expect(performance.apiLatency).toBeLessThan(1000); // < 1s
    expect(performance.searchLatency).toBeLessThan(500); // < 500ms
    expect(performance.generationTime).toBeLessThan(5000); // < 5s
    expect(performance.validationTime).toBeLessThan(2000); // < 2s
    expect(performance.cacheHitRate).toBeGreaterThan(0.8); // > 80%
    expect(performance.errorRate).toBeLessThan(0.05); // < 5%
  });
});

// Test configuration
test.use({
  // Global timeout for all tests
  timeout: 60000,
  
  // Retry failed tests
  retries: 2,
  
  // Take screenshots on failure
  screenshot: 'only-on-failure',
  
  // Record video on failure
  video: 'retain-on-failure',
  
  // Collect trace on failure
  trace: 'retain-on-failure'
});

// Global setup and teardown
test.beforeAll(async () => {
  // Wait for services to be ready
  await waitForServices();
  
  // Initialize test data
  await initializeTestData();
});

test.afterAll(async () => {
  // Cleanup test data
  await cleanupTestData();
});

// Helper functions
async function waitForServices() {
  const maxRetries = 30;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      // Service not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    retries++;
  }
  
  throw new Error('Services did not become ready within timeout');
}

async function initializeTestData() {
  // Initialize golden dataset
  const initMutation = `
    mutation InitializeTestData {
      initializeDataset(includeSamples: true) {
        success
        message
      }
    }
  `;
  
  await graphqlClient.request(initMutation);
}

async function cleanupTestData() {
  // Clean up any test-specific data
  const cleanupMutation = `
    mutation CleanupTestData {
      cleanupTestData {
        success
        message
      }
    }
  `;
  
  try {
    await graphqlClient.request(cleanupMutation);
  } catch (error) {
    console.warn('Test cleanup failed:', error);
  }
}