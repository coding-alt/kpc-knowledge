#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Performance Regression Checker
 * 
 * Compares current performance test results with baseline
 * and fails if there's significant regression
 */

const PERFORMANCE_THRESHOLDS = {
  responseTime: {
    p95: 2000, // 95th percentile should be under 2s
    avg: 1000, // Average should be under 1s
    regression: 0.2, // Allow 20% regression from baseline
  },
  errorRate: {
    max: 0.05, // Maximum 5% error rate
    regression: 0.1, // Allow 10% increase in error rate
  },
  throughput: {
    min: 10, // Minimum 10 requests per second
    regression: 0.15, // Allow 15% decrease in throughput
  }
};

function main() {
  const resultsFile = process.argv[2];
  
  if (!resultsFile) {
    console.error('Usage: node check-performance-regression.js <results-file>');
    process.exit(1);
  }

  if (!fs.existsSync(resultsFile)) {
    console.error(`Results file not found: ${resultsFile}`);
    process.exit(1);
  }

  try {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    const analysis = analyzeResults(results);
    
    console.log('Performance Analysis Results:');
    console.log('============================\n');
    
    printAnalysis(analysis);
    
    if (analysis.hasRegression) {
      console.error('\n❌ Performance regression detected!');
      process.exit(1);
    } else {
      console.log('\n✅ Performance check passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error(`Error analyzing results: ${error.message}`);
    process.exit(1);
  }
}

function analyzeResults(results) {
  const metrics = results.metrics;
  const analysis = {
    hasRegression: false,
    issues: [],
    warnings: [],
    summary: {}
  };

  // Analyze response time
  const responseTime = metrics.http_req_duration;
  analysis.summary.responseTime = {
    avg: responseTime.avg,
    p95: responseTime['p(95)'],
    max: responseTime.max
  };

  if (responseTime['p(95)'] > PERFORMANCE_THRESHOLDS.responseTime.p95) {
    analysis.issues.push(`95th percentile response time (${responseTime['p(95)'].toFixed(2)}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.responseTime.p95}ms)`);
    analysis.hasRegression = true;
  }

  if (responseTime.avg > PERFORMANCE_THRESHOLDS.responseTime.avg) {
    analysis.issues.push(`Average response time (${responseTime.avg.toFixed(2)}ms) exceeds threshold (${PERFORMANCE_THRESHOLDS.responseTime.avg}ms)`);
    analysis.hasRegression = true;
  }

  // Analyze error rate
  const errorRate = metrics.http_req_failed?.rate || 0;
  analysis.summary.errorRate = errorRate;

  if (errorRate > PERFORMANCE_THRESHOLDS.errorRate.max) {
    analysis.issues.push(`Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${PERFORMANCE_THRESHOLDS.errorRate.max * 100}%)`);
    analysis.hasRegression = true;
  }

  // Analyze throughput
  const duration = results.state.testRunDurationMs / 1000;
  const totalRequests = metrics.http_reqs.count;
  const throughput = totalRequests / duration;
  analysis.summary.throughput = throughput;

  if (throughput < PERFORMANCE_THRESHOLDS.throughput.min) {
    analysis.issues.push(`Throughput (${throughput.toFixed(2)} req/s) below threshold (${PERFORMANCE_THRESHOLDS.throughput.min} req/s)`);
    analysis.hasRegression = true;
  }

  // Check against baseline if available
  const baselineFile = path.join(path.dirname(process.argv[2]), 'baseline-performance.json');
  if (fs.existsSync(baselineFile)) {
    try {
      const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
      checkRegression(analysis, baseline);
    } catch (error) {
      analysis.warnings.push(`Could not load baseline for comparison: ${error.message}`);
    }
  } else {
    analysis.warnings.push('No baseline found for regression comparison');
    // Save current results as baseline if none exists
    saveBaseline(results, baselineFile);
  }

  return analysis;
}

function checkRegression(analysis, baseline) {
  const current = analysis.summary;
  const baselineMetrics = {
    responseTime: {
      avg: baseline.metrics.http_req_duration.avg,
      p95: baseline.metrics.http_req_duration['p(95)']
    },
    errorRate: baseline.metrics.http_req_failed?.rate || 0,
    throughput: baseline.metrics.http_reqs.count / (baseline.state.testRunDurationMs / 1000)
  };

  // Check response time regression
  const avgRegression = (current.responseTime.avg - baselineMetrics.responseTime.avg) / baselineMetrics.responseTime.avg;
  const p95Regression = (current.responseTime.p95 - baselineMetrics.responseTime.p95) / baselineMetrics.responseTime.p95;

  if (avgRegression > PERFORMANCE_THRESHOLDS.responseTime.regression) {
    analysis.issues.push(`Average response time regression: ${(avgRegression * 100).toFixed(1)}% (threshold: ${PERFORMANCE_THRESHOLDS.responseTime.regression * 100}%)`);
    analysis.hasRegression = true;
  }

  if (p95Regression > PERFORMANCE_THRESHOLDS.responseTime.regression) {
    analysis.issues.push(`95th percentile response time regression: ${(p95Regression * 100).toFixed(1)}% (threshold: ${PERFORMANCE_THRESHOLDS.responseTime.regression * 100}%)`);
    analysis.hasRegression = true;
  }

  // Check error rate regression
  const errorRegression = (current.errorRate - baselineMetrics.errorRate) / Math.max(baselineMetrics.errorRate, 0.001);
  if (errorRegression > PERFORMANCE_THRESHOLDS.errorRate.regression) {
    analysis.issues.push(`Error rate regression: ${(errorRegression * 100).toFixed(1)}% (threshold: ${PERFORMANCE_THRESHOLDS.errorRate.regression * 100}%)`);
    analysis.hasRegression = true;
  }

  // Check throughput regression
  const throughputRegression = (baselineMetrics.throughput - current.throughput) / baselineMetrics.throughput;
  if (throughputRegression > PERFORMANCE_THRESHOLDS.throughput.regression) {
    analysis.issues.push(`Throughput regression: ${(throughputRegression * 100).toFixed(1)}% (threshold: ${PERFORMANCE_THRESHOLDS.throughput.regression * 100}%)`);
    analysis.hasRegression = true;
  }

  // Add baseline comparison to summary
  analysis.summary.baseline = baselineMetrics;
  analysis.summary.regression = {
    responseTimeAvg: avgRegression,
    responseTimeP95: p95Regression,
    errorRate: errorRegression,
    throughput: throughputRegression
  };
}

function printAnalysis(analysis) {
  const { summary } = analysis;

  console.log('📊 Performance Metrics:');
  console.log(`   Response Time (avg): ${summary.responseTime.avg.toFixed(2)}ms`);
  console.log(`   Response Time (p95): ${summary.responseTime.p95.toFixed(2)}ms`);
  console.log(`   Response Time (max): ${summary.responseTime.max.toFixed(2)}ms`);
  console.log(`   Error Rate: ${(summary.errorRate * 100).toFixed(2)}%`);
  console.log(`   Throughput: ${summary.throughput.toFixed(2)} req/s`);

  if (summary.baseline) {
    console.log('\n📈 Regression Analysis:');
    console.log(`   Response Time (avg): ${summary.regression.responseTimeAvg > 0 ? '+' : ''}${(summary.regression.responseTimeAvg * 100).toFixed(1)}%`);
    console.log(`   Response Time (p95): ${summary.regression.responseTimeP95 > 0 ? '+' : ''}${(summary.regression.responseTimeP95 * 100).toFixed(1)}%`);
    console.log(`   Error Rate: ${summary.regression.errorRate > 0 ? '+' : ''}${(summary.regression.errorRate * 100).toFixed(1)}%`);
    console.log(`   Throughput: ${summary.regression.throughput > 0 ? '-' : '+'}${Math.abs(summary.regression.throughput * 100).toFixed(1)}%`);
  }

  if (analysis.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    analysis.warnings.forEach(warning => {
      console.log(`   ${warning}`);
    });
  }

  if (analysis.issues.length > 0) {
    console.log('\n❌ Issues:');
    analysis.issues.forEach(issue => {
      console.log(`   ${issue}`);
    });
  }

  console.log('\n🎯 Thresholds:');
  console.log(`   Response Time (avg): < ${PERFORMANCE_THRESHOLDS.responseTime.avg}ms`);
  console.log(`   Response Time (p95): < ${PERFORMANCE_THRESHOLDS.responseTime.p95}ms`);
  console.log(`   Error Rate: < ${PERFORMANCE_THRESHOLDS.errorRate.max * 100}%`);
  console.log(`   Throughput: > ${PERFORMANCE_THRESHOLDS.throughput.min} req/s`);
  console.log(`   Regression Tolerance: ${PERFORMANCE_THRESHOLDS.responseTime.regression * 100}%`);
}

function saveBaseline(results, baselineFile) {
  try {
    fs.writeFileSync(baselineFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Saved performance baseline to ${baselineFile}`);
  } catch (error) {
    console.warn(`Warning: Could not save baseline: ${error.message}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeResults,
  checkRegression,
  PERFORMANCE_THRESHOLDS
};