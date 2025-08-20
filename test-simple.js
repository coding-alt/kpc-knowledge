#!/usr/bin/env node

/**
 * KPC Knowledge System - 简化测试脚本
 * 测试系统的基础功能，不依赖外部包
 */

const fs = require('fs');
const path = require('path');

class SimpleSystemTester {
  constructor() {
    this.results = [];
  }

  async runAllTests() {
    console.log('🚀 Starting KPC Knowledge System Basic Tests');
    console.log('=' .repeat(50));
    
    const startTime = Date.now();

    try {
      // 1. 测试项目结构
      await this.testProjectStructure();
      
      // 2. 测试配置文件
      await this.testConfigFiles();
      
      // 3. 测试TypeScript配置
      await this.testTypeScriptConfig();
      
      // 4. 测试包结构
      await this.testPackageStructure();
      
      // 5. 测试Docker配置
      await this.testDockerConfig();

    } catch (error) {
      console.error('System test failed:', error);
    }

    const totalDuration = Date.now() - startTime;
    this.printResults(totalDuration);
  }

  async testProjectStructure() {
    await this.runTest('ProjectStructure', async () => {
      const requiredDirs = [
        'packages',
        'packages/shared',
        'packages/crawler',
        'packages/parser',
        'packages/knowledge',
        'packages/codegen',
        'packages/validator',
        'packages/api',
        'packages/cli',
        'packages/web',
        '.github/workflows',
        '.kiro/specs'
      ];

      const existingDirs = [];
      const missingDirs = [];

      for (const dir of requiredDirs) {
        if (fs.existsSync(dir)) {
          existingDirs.push(dir);
        } else {
          missingDirs.push(dir);
        }
      }

      return {
        totalRequired: requiredDirs.length,
        existing: existingDirs.length,
        missing: missingDirs.length,
        missingDirs: missingDirs,
        completeness: (existingDirs.length / requiredDirs.length * 100).toFixed(1) + '%'
      };
    });
  }

  async testConfigFiles() {
    await this.runTest('ConfigFiles', async () => {
      const requiredFiles = [
        'package.json',
        'tsconfig.json',
        'turbo.json',
        '.eslintrc.js',
        '.prettierrc',
        '.gitignore',
        'docker-compose.yml',
        '.env.example',
        'README.md'
      ];

      const existingFiles = [];
      const missingFiles = [];

      for (const file of requiredFiles) {
        if (fs.existsSync(file)) {
          existingFiles.push(file);
        } else {
          missingFiles.push(file);
        }
      }

      return {
        totalRequired: requiredFiles.length,
        existing: existingFiles.length,
        missing: missingFiles.length,
        missingFiles: missingFiles,
        completeness: (existingFiles.length / requiredFiles.length * 100).toFixed(1) + '%'
      };
    });
  }

  async testTypeScriptConfig() {
    await this.runTest('TypeScriptConfig', async () => {
      const tsconfigPath = 'tsconfig.json';
      
      if (!fs.existsSync(tsconfigPath)) {
        throw new Error('tsconfig.json not found');
      }

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      
      const hasCompilerOptions = !!tsconfig.compilerOptions;
      const hasStrict = tsconfig.compilerOptions?.strict === true;
      const hasBaseUrl = !!tsconfig.compilerOptions?.baseUrl;
      const hasPaths = !!tsconfig.compilerOptions?.paths;
      const hasInclude = !!tsconfig.include;
      const hasExclude = !!tsconfig.exclude;

      return {
        hasCompilerOptions,
        hasStrict,
        hasBaseUrl,
        hasPaths,
        hasInclude,
        hasExclude,
        pathsCount: Object.keys(tsconfig.compilerOptions?.paths || {}).length,
        target: tsconfig.compilerOptions?.target,
        module: tsconfig.compilerOptions?.module
      };
    });
  }

  async testPackageStructure() {
    await this.runTest('PackageStructure', async () => {
      const packages = [
        'shared',
        'crawler', 
        'parser',
        'knowledge',
        'codegen',
        'validator',
        'api',
        'cli',
        'web'
      ];

      const packageResults = {};
      let totalFiles = 0;

      for (const pkg of packages) {
        const pkgPath = path.join('packages', pkg);
        const srcPath = path.join(pkgPath, 'src');
        const packageJsonPath = path.join(pkgPath, 'package.json');
        const tsconfigPath = path.join(pkgPath, 'tsconfig.json');

        const hasPackageJson = fs.existsSync(packageJsonPath);
        const hasTsconfig = fs.existsSync(tsconfigPath);
        const hasSrc = fs.existsSync(srcPath);
        
        let fileCount = 0;
        if (hasSrc) {
          fileCount = this.countFiles(srcPath, '.ts');
        }
        totalFiles += fileCount;

        packageResults[pkg] = {
          hasPackageJson,
          hasTsconfig,
          hasSrc,
          fileCount
        };
      }

      return {
        packages: packageResults,
        totalPackages: packages.length,
        totalFiles,
        avgFilesPerPackage: (totalFiles / packages.length).toFixed(1)
      };
    });
  }

  async testDockerConfig() {
    await this.runTest('DockerConfig', async () => {
      const dockerComposePath = 'docker-compose.yml';
      
      if (!fs.existsSync(dockerComposePath)) {
        throw new Error('docker-compose.yml not found');
      }

      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      const hasMilvus = dockerComposeContent.includes('milvus');
      const hasNeo4j = dockerComposeContent.includes('neo4j');
      const hasRedis = dockerComposeContent.includes('redis');
      const hasEtcd = dockerComposeContent.includes('etcd');
      const hasMinio = dockerComposeContent.includes('minio');

      const serviceCount = (dockerComposeContent.match(/^\s*\w+:/gm) || []).length - 1; // -1 for version

      return {
        hasMilvus,
        hasNeo4j,
        hasRedis,
        hasEtcd,
        hasMinio,
        serviceCount,
        fileSize: dockerComposeContent.length
      };
    });
  }

  countFiles(dir, extension) {
    let count = 0;
    
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          count += this.countFiles(filePath, extension);
        } else if (file.endsWith(extension)) {
          count++;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return count;
  }

  async runTest(name, testFn) {
    const startTime = Date.now();
    
    try {
      console.log(`Running test: ${name}...`);
      const details = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        module: name,
        success: true,
        duration,
        details,
      });
      
      console.log(`✅ ${name} - ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        module: name,
        success: false,
        duration,
        error: error.message,
      });
      
      console.log(`❌ ${name} - ${duration}ms - ${error.message}`);
    }
  }

  printResults(totalDuration) {
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(50));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    
    console.log('\nDetailed Results:');
    console.log('-'.repeat(50));
    
    for (const result of this.results) {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`.padStart(8);
      
      console.log(`${status} ${result.module.padEnd(25)} ${duration}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.details && result.success) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).split('\n').map(line => `   ${line}`).join('\n')}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (failed === 0) {
      console.log('🎉 All basic tests passed! Project structure is ready.');
    } else {
      console.log(`⚠️  ${failed} test(s) failed. Please review the issues.`);
    }

    // 输出项目统计
    console.log('\n📈 Project Statistics:');
    console.log('-'.repeat(30));
    
    const structureResult = this.results.find(r => r.module === 'ProjectStructure');
    const packageResult = this.results.find(r => r.module === 'PackageStructure');
    
    if (structureResult?.details) {
      console.log(`📁 Directory Structure: ${structureResult.details.completeness} complete`);
    }
    
    if (packageResult?.details) {
      console.log(`📦 Total Packages: ${packageResult.details.totalPackages}`);
      console.log(`📄 Total TypeScript Files: ${packageResult.details.totalFiles}`);
      console.log(`📊 Average Files per Package: ${packageResult.details.avgFilesPerPackage}`);
    }
  }
}

// 运行测试
async function main() {
  const tester = new SimpleSystemTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { SimpleSystemTester };