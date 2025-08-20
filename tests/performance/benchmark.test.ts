import { performance } from 'perf_hooks';
import { GraphQLClient } from 'graphql-request';
import { GoldenDatasetBuilder } from '@kpc/shared/golden-dataset/dataset-builder';
import { TestSuiteRunner } from '@kpc/shared/testing/test-suite-runner';

/**
 * Performance Benchmark Tests
 * 
 * Validates system performance against defined benchmarks
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';

const graphqlClient = new GraphQLClient(`${API_URL}/graphql`, {
  headers: {
    authorization: `Bearer ${API_KEY}`,
  },
});

describe('Performance Benchmarks', () => {
  let datasetBuilder: GoldenDatasetBuilder;
  let testRunner: TestSuiteRunner;

  beforeAll(async () => {
    datasetBuilder = new GoldenDatasetBuilder('./test-dataset');
    testRunner = new TestSuiteRunner({
      datasetPath: './test-dataset',
      tests: {
        accuracy: { enabled: true, sampleSize: 20, thresholds: { uastAccuracy: 0.98, codeAccuracy: 0.95, componentInfoAccuracy: 0.98 } },
        compilation: { enabled: true, sampleSize: 20, thresholds: { passRate: 0.99 } },
        visual: { enabled: true, sampleSize: 10, thresholds: { stabilityRate: 0.95 } },
        performance: { enabled: true, sampleSize: 10, thresholds: { maxGenerationTime: 5000, maxValidationTime: 1000, maxRenderTime: 100 } }
      },
      reporting: { outputPath: './test-reports', formats: ['json'] }
    });

    // Initialize test dataset
    await initializeTestDataset();
  });

  describe('API Performance Benchmarks', () => {
    test('Component queries should respond within 100ms', async () => {
      const query = `
        query GetComponents($limit: Int) {
          components(limit: $limit) {
            id
            name
            framework
            description
            props {
              name
              type
              required
            }
          }
        }
      `;

      const iterations = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        await graphqlClient.request(query, { limit: 20 });
        
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }

      const averageTime = responseTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const p95Time = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

      expect(averageTime).toBeLessThan(100);
      expect(p95Time).toBeLessThan(150);

      console.log(`Component query performance:
        Average: ${averageTime.toFixed(2)}ms
        P95: ${p95Time.toFixed(2)}ms
        Min: ${Math.min(...responseTimes).toFixed(2)}ms
        Max: ${Math.max(...responseTimes).toFixed(2)}ms`);
    });

    test('Component search should respond within 500ms', async () => {
      const searchQuery = `
        query SearchComponents($query: String!, $limit: Int) {
          searchComponents(query: $query, limit: $limit) {
            id
            name
            framework
            description
            relevanceScore
            props {
              name
              type
            }
          }
        }
      `;

      const searchTerms = ['button', 'form', 'table', 'modal', 'card'];
      const responseTimes: number[] = [];

      for (const term of searchTerms) {
        const startTime = performance.now();
        
        await graphqlClient.request(searchQuery, { query: term, limit: 10 });
        
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }

      const averageTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);

      expect(averageTime).toBeLessThan(500);
      expect(maxTime).toBeLessThan(1000);

      console.log(`Search performance:
        Average: ${averageTime.toFixed(2)}ms
        Max: ${maxTime.toFixed(2)}ms`);
    });

    test('Code generation should complete within 5 seconds', async () => {
      const generationMutation = `
        mutation GenerateCode($requirement: String!, $framework: String!) {
          generateCode(requirement: $requirement, framework: $framework) {
            success
            code
            errors {
              message
            }
            metadata {
              generationTime
              tokensUsed
              confidence
            }
          }
        }
      `;

      const requirements = [
        'Create a simple button component',
        'Create a form with validation',
        'Create a responsive card component',
        'Create a data table with sorting',
        'Create a modal dialog'
      ];

      const generationTimes: number[] = [];

      for (const requirement of requirements) {
        const startTime = performance.now();
        
        const response = await graphqlClient.request(generationMutation, {
          requirement,
          framework: 'react'
        });
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        generationTimes.push(totalTime);
        
        expect(response.generateCode.success).toBe(true);
        expect(totalTime).toBeLessThan(5000);
      }

      const averageTime = generationTimes.reduce((sum, time) => sum + time, 0) / generationTimes.length;
      const maxTime = Math.max(...generationTimes);

      console.log(`Code generation performance:
        Average: ${averageTime.toFixed(2)}ms
        Max: ${maxTime.toFixed(2)}ms`);
    });

    test('Code validation should complete within 2 seconds', async () => {
      const validationMutation = `
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
            metrics {
              complexity
              maintainability
            }
          }
        }
      `;

      const testCodes = [
        `import React from 'react';
         export const Button = ({ children, onClick }) => (
           <button onClick={onClick}>{children}</button>
         );`,
        `import React, { useState } from 'react';
         export const Form = () => {
           const [value, setValue] = useState('');
           return <input value={value} onChange={e => setValue(e.target.value)} />;
         };`,
        `import React from 'react';
         export const Card = ({ title, content, actions }) => (
           <div className="card">
             <h2>{title}</h2>
             <p>{content}</p>
             <div className="actions">{actions}</div>
           </div>
         );`
      ];

      const validationTimes: number[] = [];

      for (const code of testCodes) {
        const startTime = performance.now();
        
        await graphqlClient.request(validationMutation, {
          code,
          framework: 'react'
        });
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        validationTimes.push(totalTime);
        expect(totalTime).toBeLessThan(2000);
      }

      const averageTime = validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length;

      console.log(`Validation performance:
        Average: ${averageTime.toFixed(2)}ms
        Max: ${Math.max(...validationTimes).toFixed(2)}ms`);
    });
  });

  describe('Throughput Benchmarks', () => {
    test('Should handle concurrent component queries', async () => {
      const query = `
        query GetComponents($limit: Int) {
          components(limit: $limit) {
            id
            name
            framework
          }
        }
      `;

      const concurrentRequests = 20;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        graphqlClient.request(query, { limit: 10 })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.components).toBeDefined();
        expect(Array.isArray(result.components)).toBe(true);
      });

      // Calculate throughput
      const throughput = (concurrentRequests / totalTime) * 1000; // requests per second
      expect(throughput).toBeGreaterThan(10); // At least 10 req/s

      console.log(`Concurrent query performance:
        Total time: ${totalTime.toFixed(2)}ms
        Throughput: ${throughput.toFixed(2)} req/s`);
    });

    test('Should handle concurrent code generations', async () => {
      const generationMutation = `
        mutation GenerateCode($requirement: String!, $framework: String!) {
          generateCode(requirement: $requirement, framework: $framework) {
            success
            code
          }
        }
      `;

      const requirements = [
        'Create a button component',
        'Create an input component',
        'Create a card component',
        'Create a list component',
        'Create a header component'
      ];

      const startTime = performance.now();

      const promises = requirements.map(requirement =>
        graphqlClient.request(generationMutation, {
          requirement,
          framework: 'react'
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All generations should succeed
      results.forEach(result => {
        expect(result.generateCode.success).toBe(true);
        expect(result.generateCode.code).toBeDefined();
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 5 concurrent generations

      console.log(`Concurrent generation performance:
        Total time: ${totalTime.toFixed(2)}ms
        Average per generation: ${(totalTime / requirements.length).toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Benchmarks', () => {
    test('Should maintain stable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform multiple operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(
          graphqlClient.request(`
            query GetComponents($limit: Int) {
              components(limit: $limit) {
                id
                name
                framework
                description
              }
            }
          `, { limit: 20 })
        );
      }

      await Promise.all(operations);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);

      console.log(`Memory usage:
        Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)`);
    });

    test('Should handle large component datasets efficiently', async () => {
      // Test with large result sets
      const largeQuery = `
        query GetManyComponents($limit: Int) {
          components(limit: $limit) {
            id
            name
            framework
            description
            props {
              name
              type
              required
              defaultValue
              description
            }
            events {
              name
              type
              description
            }
            documentation
          }
        }
      `;

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const result = await graphqlClient.request(largeQuery, { limit: 100 });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      const queryTime = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      // Should handle large datasets efficiently
      expect(queryTime).toBeLessThan(2000); // Less than 2 seconds
      expect(result.components).toBeDefined();

      console.log(`Large dataset query:
        Query time: ${queryTime.toFixed(2)}ms
        Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB
        Components returned: ${result.components.length}`);
    });
  });

  describe('Golden Dataset Performance', () => {
    test('Should execute comprehensive test suite within time limits', async () => {
      const startTime = performance.now();

      const result = await testRunner.runTestSuite();

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Test suite should complete within reasonable time
      expect(totalTime).toBeLessThan(300000); // 5 minutes

      // Verify performance benchmarks
      expect(result.summary.overallPassRate).toBeGreaterThan(0.9); // 90% pass rate

      if (result.results.performance) {
        const perfResults = result.results.performance;
        expect(perfResults.metrics.averageGenerationTime).toBeLessThan(5000);
        expect(perfResults.metrics.averageValidationTime).toBeLessThan(1000);
        expect(perfResults.metrics.averageRenderTime).toBeLessThan(100);
      }

      console.log(`Test suite performance:
        Total time: ${(totalTime / 1000).toFixed(2)}s
        Pass rate: ${(result.summary.overallPassRate * 100).toFixed(1)}%
        Tests executed: ${result.summary.totalTests}`);
    });

    test('Should maintain accuracy benchmarks', async () => {
      const sampleEntries = datasetBuilder.getRandomSample(10);
      const accuracyResults = [];

      for (const entry of sampleEntries) {
        const startTime = performance.now();

        // Generate code for the entry
        const generationResult = await graphqlClient.request(`
          mutation GenerateCode($requirement: String!, $framework: String!) {
            generateCode(requirement: $requirement, framework: $framework) {
              success
              code
              metadata {
                confidence
                generationTime
              }
            }
          }
        `, {
          requirement: entry.requirement.naturalLanguage,
          framework: entry.framework === 'multi-framework' ? 'react' : entry.framework
        });

        const endTime = performance.now();
        const generationTime = endTime - startTime;

        if (generationResult.generateCode.success) {
          accuracyResults.push({
            generationTime,
            confidence: generationResult.generateCode.metadata.confidence,
            success: true
          });
        } else {
          accuracyResults.push({
            generationTime,
            confidence: 0,
            success: false
          });
        }
      }

      const successRate = accuracyResults.filter(r => r.success).length / accuracyResults.length;
      const averageConfidence = accuracyResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.confidence, 0) / accuracyResults.filter(r => r.success).length;
      const averageGenerationTime = accuracyResults
        .reduce((sum, r) => sum + r.generationTime, 0) / accuracyResults.length;

      // Verify accuracy benchmarks
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(averageConfidence).toBeGreaterThan(0.8); // 80% average confidence
      expect(averageGenerationTime).toBeLessThan(5000); // Average under 5 seconds

      console.log(`Accuracy benchmarks:
        Success rate: ${(successRate * 100).toFixed(1)}%
        Average confidence: ${(averageConfidence * 100).toFixed(1)}%
        Average generation time: ${averageGenerationTime.toFixed(2)}ms`);
    });
  });

  describe('Scalability Tests', () => {
    test('Should scale with increasing load', async () => {
      const loadLevels = [1, 5, 10, 20];
      const results = [];

      for (const concurrency of loadLevels) {
        const startTime = performance.now();

        const promises = Array.from({ length: concurrency }, () =>
          graphqlClient.request(`
            query GetComponents($limit: Int) {
              components(limit: $limit) {
                id
                name
                framework
              }
            }
          `, { limit: 10 })
        );

        await Promise.all(promises);

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = (concurrency / totalTime) * 1000;

        results.push({
          concurrency,
          totalTime,
          throughput
        });
      }

      // Verify throughput doesn't degrade significantly
      const baseThroughput = results[0].throughput;
      const maxThroughput = results[results.length - 1].throughput;
      const degradation = (baseThroughput - maxThroughput) / baseThroughput;

      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation

      console.log('Scalability results:');
      results.forEach(result => {
        console.log(`  Concurrency ${result.concurrency}: ${result.throughput.toFixed(2)} req/s`);
      });
    });
  });
});

// Helper function to initialize test dataset
async function initializeTestDataset() {
  try {
    const initMutation = `
      mutation InitializeDataset {
        initializeDataset(includeSamples: true) {
          success
          message
        }
      }
    `;

    await graphqlClient.request(initMutation);
  } catch (error) {
    console.warn('Failed to initialize test dataset:', error);
  }
}