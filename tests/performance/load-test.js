import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'],    // Error rate must be below 5%
    errors: ['rate<0.05'],             // Custom error rate must be below 5%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

// Test data
const testQueries = [
  'Create a button component',
  'Build a form with validation',
  'Make a responsive navigation bar',
  'Design a data table with sorting',
  'Create a modal dialog',
];

const testComponents = [
  'Button',
  'Input',
  'Form',
  'Table',
  'Modal',
  'Card',
  'Navigation',
  'Dropdown',
];

export default function () {
  // Test 1: Health check
  testHealthCheck();
  
  // Test 2: Component search
  testComponentSearch();
  
  // Test 3: Code generation
  testCodeGeneration();
  
  // Test 4: Component validation
  testComponentValidation();
  
  // Test 5: GraphQL queries
  testGraphQLQueries();
  
  sleep(1);
}

function testHealthCheck() {
  const response = http.get(`${BASE_URL}/health`);
  
  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testComponentSearch() {
  const component = testComponents[Math.floor(Math.random() * testComponents.length)];
  
  const payload = JSON.stringify({
    query: `
      query SearchComponents($query: String!) {
        searchComponents(query: $query, limit: 10) {
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
    `,
    variables: { query: component }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(`${BASE_URL}/graphql`, payload, params);
  
  const success = check(response, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 1000ms': (r) => r.timings.duration < 1000,
    'search returns results': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.searchComponents && data.data.searchComponents.length > 0;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testCodeGeneration() {
  const query = testQueries[Math.floor(Math.random() * testQueries.length)];
  
  const payload = JSON.stringify({
    query: `
      mutation GenerateCode($requirement: String!, $framework: String!) {
        generateCode(requirement: $requirement, framework: $framework) {
          success
          code
          errors
          warnings
        }
      }
    `,
    variables: { 
      requirement: query,
      framework: 'react'
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(`${BASE_URL}/graphql`, payload, params);
  
  const success = check(response, {
    'generation status is 200': (r) => r.status === 200,
    'generation response time < 5000ms': (r) => r.timings.duration < 5000,
    'generation returns code': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.generateCode && data.data.generateCode.success;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testComponentValidation() {
  const testCode = `
    import React from 'react';
    
    export const TestComponent = () => {
      return <div>Hello World</div>;
    };
  `;
  
  const payload = JSON.stringify({
    query: `
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
            line
            column
          }
        }
      }
    `,
    variables: { 
      code: testCode,
      framework: 'react'
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(`${BASE_URL}/graphql`, payload, params);
  
  const success = check(response, {
    'validation status is 200': (r) => r.status === 200,
    'validation response time < 2000ms': (r) => r.timings.duration < 2000,
    'validation returns result': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.validateCode !== null;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

function testGraphQLQueries() {
  const queries = [
    {
      name: 'Get components',
      query: `
        query GetComponents($limit: Int) {
          components(limit: $limit) {
            id
            name
            framework
            description
          }
        }
      `,
      variables: { limit: 20 }
    },
    {
      name: 'Get component by ID',
      query: `
        query GetComponent($id: ID!) {
          component(id: $id) {
            id
            name
            framework
            description
            props {
              name
              type
              required
              defaultValue
            }
            events {
              name
              type
              description
            }
          }
        }
      `,
      variables: { id: 'button-react-001' }
    },
    {
      name: 'Get frameworks',
      query: `
        query GetFrameworks {
          frameworks {
            name
            version
            componentCount
          }
        }
      `
    }
  ];

  const testQuery = queries[Math.floor(Math.random() * queries.length)];
  
  const payload = JSON.stringify({
    query: testQuery.query,
    variables: testQuery.variables || {}
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(`${BASE_URL}/graphql`, payload, params);
  
  const success = check(response, {
    [`${testQuery.name} status is 200`]: (r) => r.status === 200,
    [`${testQuery.name} response time < 1000ms`]: (r) => r.timings.duration < 1000,
    [`${testQuery.name} returns data`]: (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && !data.errors;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
}

export function handleSummary(data) {
  return {
    'performance-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const colors = options.enableColors || false;
  
  let summary = `${indent}Performance Test Summary\n`;
  summary += `${indent}========================\n\n`;
  
  // Test duration
  const duration = data.state.testRunDurationMs / 1000;
  summary += `${indent}Test Duration: ${duration.toFixed(2)}s\n`;
  
  // HTTP metrics
  const httpReqs = data.metrics.http_reqs;
  const httpReqDuration = data.metrics.http_req_duration;
  const httpReqFailed = data.metrics.http_req_failed;
  
  summary += `${indent}Total Requests: ${httpReqs.count}\n`;
  summary += `${indent}Request Rate: ${(httpReqs.count / duration).toFixed(2)} req/s\n`;
  summary += `${indent}Average Response Time: ${httpReqDuration.avg.toFixed(2)}ms\n`;
  summary += `${indent}95th Percentile: ${httpReqDuration['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}Error Rate: ${(httpReqFailed.rate * 100).toFixed(2)}%\n\n`;
  
  // Thresholds
  summary += `${indent}Thresholds:\n`;
  Object.entries(data.thresholds).forEach(([name, threshold]) => {
    const status = threshold.ok ? '✓' : '✗';
    const color = colors ? (threshold.ok ? '\x1b[32m' : '\x1b[31m') : '';
    const reset = colors ? '\x1b[0m' : '';
    summary += `${indent}  ${color}${status}${reset} ${name}\n`;
  });
  
  return summary;
}