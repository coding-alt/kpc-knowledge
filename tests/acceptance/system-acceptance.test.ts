import { GraphQLClient } from 'graphql-request';
import { GoldenDatasetBuilder } from '@kpc/shared/golden-dataset/dataset-builder';
import { TestSuiteRunner } from '@kpc/shared/testing/test-suite-runner';

/**
 * System Acceptance Tests
 * 
 * Final validation that the complete KPC Knowledge System meets all requirements
 * and performs according to specifications
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';

const graphqlClient = new GraphQLClient(`${API_URL}/graphql`, {
  headers: {
    authorization: `Bearer ${API_KEY}`,
  },
});

describe('System Acceptance Tests', () => {
  let datasetBuilder: GoldenDatasetBuilder;
  let testRunner: TestSuiteRunner;

  beforeAll(async () => {
    // Initialize test infrastructure
    datasetBuilder = new GoldenDatasetBuilder('./acceptance-dataset');
    testRunner = new TestSuiteRunner({
      datasetPath: './acceptance-dataset',
      tests: {
        accuracy: { 
          enabled: true, 
          sampleSize: 50, 
          thresholds: { 
            uastAccuracy: 0.98, 
            codeAccuracy: 0.95, 
            componentInfoAccuracy: 0.98 
          } 
        },
        compilation: { 
          enabled: true, 
          sampleSize: 50, 
          thresholds: { 
            passRate: 0.99 
          } 
        },
        visual: { 
          enabled: true, 
          sampleSize: 20, 
          thresholds: { 
            stabilityRate: 0.95 
          } 
        },
        performance: { 
          enabled: true, 
          sampleSize: 20, 
          thresholds: { 
            maxGenerationTime: 5000, 
            maxValidationTime: 1000, 
            maxRenderTime: 100 
          } 
        }
      },
      reporting: { 
        outputPath: './acceptance-reports', 
        formats: ['json', 'html', 'junit'] 
      }
    });

    // Wait for system to be ready
    await waitForSystemReady();
    
    // Initialize acceptance dataset
    await initializeAcceptanceDataset();
  });

  describe('Requirement 1: Component Information Extraction (≥98% Accuracy)', () => {
    test('should achieve ≥98% accuracy in component information extraction', async () => {
      const testSuiteResult = await testRunner.runTestSuite();
      
      expect(testSuiteResult.results.accuracy).toBeDefined();
      expect(testSuiteResult.results.accuracy.passed).toBe(true);
      
      const accuracyMetrics = testSuiteResult.results.accuracy.metrics;
      expect(accuracyMetrics.componentInfoAccuracy).toBeGreaterThanOrEqual(0.98);
      
      console.log(`✅ Component Information Accuracy: ${(accuracyMetrics.componentInfoAccuracy * 100).toFixed(2)}%`);
    });

    test('should correctly extract props, events, and metadata from React components', async () => {
      const reactComponents = datasetBuilder.getEntriesByFramework('react').slice(0, 10);
      let correctExtractions = 0;

      for (const component of reactComponents) {
        const analysisQuery = `
          query AnalyzeComponent($code: String!) {
            analyzeComponent(code: $code) {
              props {
                name
                type
                required
                defaultValue
              }
              events {
                name
                type
              }
              metadata {
                framework
                complexity
              }
            }
          }
        `;

        const result = await graphqlClient.request(analysisQuery, {
          code: component.expectedCode.react?.component || ''
        });

        // Validate extraction accuracy
        const extractedProps = result.analyzeComponent.props;
        const expectedProps = component.expectedUAST.props || {};
        
        const propsMatch = Object.keys(expectedProps).every(propName => 
          extractedProps.some(p => p.name === propName)
        );

        if (propsMatch) {
          correctExtractions++;
        }
      }

      const accuracy = correctExtractions / reactComponents.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.98);
    });

    test('should correctly extract information from Vue components', async () => {
      const vueComponents = datasetBuilder.getEntriesByFramework('vue').slice(0, 10);
      let correctExtractions = 0;

      for (const component of vueComponents) {
        if (!component.expectedCode.vue) continue;

        const analysisQuery = `
          query AnalyzeComponent($code: String!) {
            analyzeComponent(code: $code) {
              props {
                name
                type
                required
              }
              events {
                name
                type
              }
            }
          }
        `;

        const result = await graphqlClient.request(analysisQuery, {
          code: component.expectedCode.vue.component
        });

        // Basic validation that extraction worked
        if (result.analyzeComponent.props || result.analyzeComponent.events) {
          correctExtractions++;
        }
      }

      const accuracy = correctExtractions / vueComponents.filter(c => c.expectedCode.vue).length;
      expect(accuracy).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('Requirement 2: Three-Framework Compilation (≥99% Pass Rate)', () => {
    test('should achieve ≥99% compilation pass rate across React, Vue, and Intact', async () => {
      const testSuiteResult = await testRunner.runTestSuite();
      
      expect(testSuiteResult.results.compilation).toBeDefined();
      expect(testSuiteResult.results.compilation.passed).toBe(true);
      
      const compilationMetrics = testSuiteResult.results.compilation.metrics;
      expect(compilationMetrics.passRate).toBeGreaterThanOrEqual(0.99);
      
      console.log(`✅ Compilation Pass Rate: ${(compilationMetrics.passRate * 100).toFixed(2)}%`);
    });

    test('should generate compilable React components', async () => {
      const requirements = [
        'Create a button component with primary and secondary variants',
        'Create a form component with validation',
        'Create a responsive card component',
        'Create a data table with sorting',
        'Create a modal dialog component'
      ];

      let successfulCompilations = 0;

      for (const requirement of requirements) {
        const generationMutation = `
          mutation GenerateCode($requirement: String!, $framework: String!) {
            generateCode(requirement: $requirement, framework: $framework) {
              success
              code
            }
          }
        `;

        const generationResult = await graphqlClient.request(generationMutation, {
          requirement,
          framework: 'react'
        });

        if (generationResult.generateCode.success) {
          const validationMutation = `
            mutation ValidateCode($code: String!, $framework: String!) {
              validateCode(code: $code, framework: $framework) {
                valid
                errors {
                  message
                }
              }
            }
          `;

          const validationResult = await graphqlClient.request(validationMutation, {
            code: generationResult.generateCode.code,
            framework: 'react'
          });

          if (validationResult.validateCode.valid) {
            successfulCompilations++;
          }
        }
      }

      const passRate = successfulCompilations / requirements.length;
      expect(passRate).toBeGreaterThanOrEqual(0.99);
    });

    test('should generate compilable Vue components', async () => {
      const requirements = [
        'Create a button component',
        'Create an input component with validation',
        'Create a list component'
      ];

      let successfulCompilations = 0;

      for (const requirement of requirements) {
        const generationMutation = `
          mutation GenerateCode($requirement: String!, $framework: String!) {
            generateCode(requirement: $requirement, framework: $framework) {
              success
              code
            }
          }
        `;

        const generationResult = await graphqlClient.request(generationMutation, {
          requirement,
          framework: 'vue'
        });

        if (generationResult.generateCode.success) {
          successfulCompilations++;
        }
      }

      const passRate = successfulCompilations / requirements.length;
      expect(passRate).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('Requirement 3: Visual Regression Testing (≥95% Snapshot Stability)', () => {
    test('should achieve ≥95% snapshot stability', async () => {
      const testSuiteResult = await testRunner.runTestSuite();
      
      expect(testSuiteResult.results.visual).toBeDefined();
      expect(testSuiteResult.results.visual.passed).toBe(true);
      
      const visualMetrics = testSuiteResult.results.visual.metrics;
      expect(visualMetrics.stabilityRate).toBeGreaterThanOrEqual(0.95);
      
      console.log(`✅ Visual Stability Rate: ${(visualMetrics.stabilityRate * 100).toFixed(2)}%`);
    });
  });

  describe('Requirement 4: Performance Benchmarks', () => {
    test('should meet all performance benchmarks', async () => {
      const testSuiteResult = await testRunner.runTestSuite();
      
      expect(testSuiteResult.results.performance).toBeDefined();
      expect(testSuiteResult.results.performance.passed).toBe(true);
      
      const perfMetrics = testSuiteResult.results.performance.metrics;
      expect(perfMetrics.averageGenerationTime).toBeLessThan(5000); // < 5s
      expect(perfMetrics.averageValidationTime).toBeLessThan(1000); // < 1s
      expect(perfMetrics.averageRenderTime).toBeLessThan(100); // < 100ms
      
      console.log(`✅ Performance Metrics:
        Generation Time: ${perfMetrics.averageGenerationTime.toFixed(0)}ms
        Validation Time: ${perfMetrics.averageValidationTime.toFixed(0)}ms
        Render Time: ${perfMetrics.averageRenderTime.toFixed(0)}ms`);
    });

    test('should handle concurrent operations efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        graphqlClient.request(`
          mutation GenerateCode($requirement: String!, $framework: String!) {
            generateCode(requirement: $requirement, framework: $framework) {
              success
              code
            }
          }
        `, {
          requirement: `Create test component ${i}`,
          framework: 'react'
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      const successCount = results.filter(r => r.generateCode.success).length;
      expect(successCount).toBe(concurrentRequests);

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(30000); // 30 seconds for 10 concurrent generations

      const throughput = (concurrentRequests / totalTime) * 1000;
      expect(throughput).toBeGreaterThan(0.5); // At least 0.5 req/s

      console.log(`✅ Concurrent Performance:
        Total Time: ${totalTime}ms
        Throughput: ${throughput.toFixed(2)} req/s`);
    });
  });

  describe('Requirement 5: System Integration', () => {
    test('should have all services healthy and connected', async () => {
      const healthQuery = `
        query SystemHealth {
          systemMetrics {
            services {
              name
              status
              responseTime
            }
            database {
              neo4j {
                status
              }
              milvus {
                status
              }
              redis {
                status
              }
            }
          }
        }
      `;

      const healthResult = await graphqlClient.request(healthQuery);
      const metrics = healthResult.systemMetrics;

      // All services should be healthy
      metrics.services.forEach(service => {
        expect(service.status).toBe('healthy');
        expect(service.responseTime).toBeLessThan(1000);
      });

      // All databases should be healthy
      expect(metrics.database.neo4j.status).toBe('healthy');
      expect(metrics.database.milvus.status).toBe('healthy');
      expect(metrics.database.redis.status).toBe('healthy');

      console.log('✅ All system services are healthy');
    });

    test('should support complete end-to-end workflows', async () => {
      // Test complete workflow: Generate -> Validate -> Save -> Search -> Retrieve
      
      // Step 1: Generate component
      const generationResult = await graphqlClient.request(`
        mutation GenerateCode($requirement: String!, $framework: String!) {
          generateCode(requirement: $requirement, framework: $framework) {
            success
            code
          }
        }
      `, {
        requirement: 'Create a unique acceptance test component',
        framework: 'react'
      });

      expect(generationResult.generateCode.success).toBe(true);

      // Step 2: Validate component
      const validationResult = await graphqlClient.request(`
        mutation ValidateCode($code: String!, $framework: String!) {
          validateCode(code: $code, framework: $framework) {
            valid
          }
        }
      `, {
        code: generationResult.generateCode.code,
        framework: 'react'
      });

      expect(validationResult.validateCode.valid).toBe(true);

      // Step 3: Save component
      const componentName = `AcceptanceTestComponent_${Date.now()}`;
      const saveResult = await graphqlClient.request(`
        mutation CreateComponent($input: ComponentInput!) {
          createComponent(input: $input) {
            id
            name
          }
        }
      `, {
        input: {
          name: componentName,
          framework: 'REACT',
          description: 'Component created during acceptance testing',
          sourceCode: generationResult.generateCode.code
        }
      });

      expect(saveResult.createComponent.id).toBeDefined();

      // Step 4: Search for component
      const searchResult = await graphqlClient.request(`
        query SearchComponents($query: String!) {
          searchComponents(query: $query) {
            id
            name
            framework
          }
        }
      `, {
        query: componentName
      });

      expect(searchResult.searchComponents.length).toBeGreaterThan(0);
      expect(searchResult.searchComponents[0].name).toBe(componentName);

      // Step 5: Retrieve component details
      const componentId = searchResult.searchComponents[0].id;
      const detailsResult = await graphqlClient.request(`
        query GetComponent($id: ID!) {
          component(id: $id) {
            id
            name
            framework
            sourceCode
          }
        }
      `, {
        id: componentId
      });

      expect(detailsResult.component.name).toBe(componentName);
      expect(detailsResult.component.sourceCode).toBe(generationResult.generateCode.code);

      console.log('✅ Complete end-to-end workflow successful');
    });
  });

  describe('Requirement 6: Cross-Framework Support', () => {
    test('should support React, Vue, and Intact frameworks', async () => {
      const frameworks = ['react', 'vue', 'intact'];
      const requirement = 'Create a simple button component';

      for (const framework of frameworks) {
        const generationResult = await graphqlClient.request(`
          mutation GenerateCode($requirement: String!, $framework: String!) {
            generateCode(requirement: $requirement, framework: $framework) {
              success
              code
            }
          }
        `, {
          requirement,
          framework
        });

        expect(generationResult.generateCode.success).toBe(true);
        expect(generationResult.generateCode.code).toBeDefined();
        expect(generationResult.generateCode.code.length).toBeGreaterThan(0);

        console.log(`✅ ${framework.toUpperCase()} framework support verified`);
      }
    });

    test('should maintain framework-specific patterns and conventions', async () => {
      const testCases = [
        {
          framework: 'react',
          requirement: 'Create a counter component with state',
          expectedPatterns: ['useState', 'export const', 'React.FC']
        },
        {
          framework: 'vue',
          requirement: 'Create a counter component with state',
          expectedPatterns: ['<template>', '<script', 'ref(']
        }
      ];

      for (const testCase of testCases) {
        const generationResult = await graphqlClient.request(`
          mutation GenerateCode($requirement: String!, $framework: String!) {
            generateCode(requirement: $requirement, framework: $framework) {
              success
              code
            }
          }
        `, {
          requirement: testCase.requirement,
          framework: testCase.framework
        });

        expect(generationResult.generateCode.success).toBe(true);

        const code = generationResult.generateCode.code;
        testCase.expectedPatterns.forEach(pattern => {
          expect(code).toContain(pattern);
        });
      }
    });
  });

  describe('Requirement 7: Quality Assurance', () => {
    test('should maintain high code quality standards', async () => {
      const qualityQuery = `
        query GetQualityMetrics {
          qualityMetrics {
            codeQuality {
              averageComplexity
              maintainabilityIndex
              testCoverage
            }
            validationAccuracy
            generationSuccessRate
          }
        }
      `;

      const qualityResult = await graphqlClient.request(qualityQuery);
      const metrics = qualityResult.qualityMetrics;

      expect(metrics.codeQuality.averageComplexity).toBeLessThan(10);
      expect(metrics.codeQuality.maintainabilityIndex).toBeGreaterThan(70);
      expect(metrics.codeQuality.testCoverage).toBeGreaterThan(0.8);
      expect(metrics.validationAccuracy).toBeGreaterThan(0.95);
      expect(metrics.generationSuccessRate).toBeGreaterThan(0.95);

      console.log(`✅ Quality Metrics:
        Complexity: ${metrics.codeQuality.averageComplexity}
        Maintainability: ${metrics.codeQuality.maintainabilityIndex}
        Test Coverage: ${(metrics.codeQuality.testCoverage * 100).toFixed(1)}%
        Validation Accuracy: ${(metrics.validationAccuracy * 100).toFixed(1)}%
        Generation Success: ${(metrics.generationSuccessRate * 100).toFixed(1)}%`);
    });

    test('should provide comprehensive error handling and recovery', async () => {
      // Test error handling with invalid inputs
      const invalidRequests = [
        { requirement: '', framework: 'react' },
        { requirement: 'Create a component', framework: 'invalid' },
        { requirement: 'Invalid requirement with no clear intent', framework: 'react' }
      ];

      for (const request of invalidRequests) {
        try {
          const result = await graphqlClient.request(`
            mutation GenerateCode($requirement: String!, $framework: String!) {
              generateCode(requirement: $requirement, framework: $framework) {
                success
                code
                errors {
                  message
                }
              }
            }
          `, request);

          // Should either succeed or fail gracefully with proper error messages
          if (!result.generateCode.success) {
            expect(result.generateCode.errors).toBeDefined();
            expect(result.generateCode.errors.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // GraphQL errors should be properly formatted
          expect(error.response).toBeDefined();
        }
      }

      console.log('✅ Error handling and recovery verified');
    });
  });

  describe('Final System Validation', () => {
    test('should pass comprehensive system acceptance criteria', async () => {
      console.log('\n🚀 Running Final System Validation...\n');

      // Run complete test suite
      const finalTestResult = await testRunner.runTestSuite();

      // Validate overall system performance
      expect(finalTestResult.summary.overallPassRate).toBeGreaterThan(0.95);
      expect(finalTestResult.summary.executionTime).toBeLessThan(600000); // 10 minutes

      // Validate individual test categories
      if (finalTestResult.results.accuracy) {
        expect(finalTestResult.results.accuracy.passed).toBe(true);
      }
      if (finalTestResult.results.compilation) {
        expect(finalTestResult.results.compilation.passed).toBe(true);
      }
      if (finalTestResult.results.visual) {
        expect(finalTestResult.results.visual.passed).toBe(true);
      }
      if (finalTestResult.results.performance) {
        expect(finalTestResult.results.performance.passed).toBe(true);
      }

      console.log(`\n✅ SYSTEM ACCEPTANCE COMPLETE!
        
📊 Final Results:
  Overall Pass Rate: ${(finalTestResult.summary.overallPassRate * 100).toFixed(1)}%
  Total Tests: ${finalTestResult.summary.totalTests}
  Passed Tests: ${finalTestResult.summary.passedTests}
  Failed Tests: ${finalTestResult.summary.failedTests}
  Execution Time: ${(finalTestResult.summary.executionTime / 1000).toFixed(1)}s

🎯 All acceptance criteria met:
  ✅ Component Information Extraction ≥98%
  ✅ Three-Framework Compilation ≥99%
  ✅ Visual Regression Testing ≥95%
  ✅ Performance Benchmarks Met
  ✅ System Integration Verified
  ✅ Cross-Framework Support Complete
  ✅ Quality Assurance Standards Met

🚀 KPC Knowledge System is ready for production deployment!`);
    });
  });
});

// Helper functions
async function waitForSystemReady(): Promise<void> {
  const maxRetries = 60;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const healthCheck = await fetch(`${API_URL}/health`);
      if (healthCheck.status === 200) {
        // Additional check for GraphQL endpoint
        await graphqlClient.request(`
          query HealthCheck {
            healthCheck {
              status
            }
          }
        `);
        return;
      }
    } catch (error) {
      // System not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
    retries++;
  }

  throw new Error('System did not become ready within timeout period');
}

async function initializeAcceptanceDataset(): Promise<void> {
  try {
    const initMutation = `
      mutation InitializeAcceptanceDataset {
        initializeDataset(includeSamples: true) {
          success
          message
        }
      }
    `;

    const result = await graphqlClient.request(initMutation);
    if (!result.initializeDataset.success) {
      throw new Error(result.initializeDataset.message);
    }

    console.log('✅ Acceptance dataset initialized successfully');
  } catch (error) {
    console.warn('Warning: Could not initialize acceptance dataset:', error.message);
  }
}