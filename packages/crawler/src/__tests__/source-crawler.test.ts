import { GitSourceCrawler } from '../source-crawler';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('GitSourceCrawler', () => {
  let crawler: GitSourceCrawler;
  const tempDir = './temp/test-repos';

  beforeEach(() => {
    crawler = new GitSourceCrawler(tempDir);
  });

  afterEach(async () => {
    // 清理测试目录
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('extractComponents', () => {
    it('should extract React components', async () => {
      // 创建测试文件
      const testDir = path.join(tempDir, 'test-repo');
      await fs.ensureDir(testDir);
      
      const reactComponent = `
import React from 'react';

interface Props {
  title: string;
}

export default function Button({ title }: Props) {
  return <button>{title}</button>;
}
`;
      
      await fs.writeFile(path.join(testDir, 'Button.tsx'), reactComponent);
      
      const components = await crawler.extractComponents(testDir);
      
      expect(components).toHaveLength(1);
      expect(components[0].framework).toBe('react');
      expect(components[0].filePath).toBe('Button.tsx');
      expect(components[0].dependencies).toContain('react');
    });

    it('should extract Vue components', async () => {
      const testDir = path.join(tempDir, 'test-repo');
      await fs.ensureDir(testDir);
      
      const vueComponent = `
<template>
  <button>{{ title }}</button>
</template>

<script>
export default {
  props: {
    title: String
  }
}
</script>
`;
      
      await fs.writeFile(path.join(testDir, 'Button.vue'), vueComponent);
      
      const components = await crawler.extractComponents(testDir);
      
      expect(components).toHaveLength(1);
      expect(components[0].framework).toBe('vue');
      expect(components[0].filePath).toBe('Button.vue');
    });

    it('should exclude test files', async () => {
      const testDir = path.join(tempDir, 'test-repo');
      await fs.ensureDir(testDir);
      
      await fs.writeFile(path.join(testDir, 'Button.tsx'), 'export default function Button() {}');
      await fs.writeFile(path.join(testDir, 'Button.test.tsx'), 'test file');
      
      const components = await crawler.extractComponents(testDir);
      
      expect(components).toHaveLength(1);
      expect(components[0].filePath).toBe('Button.tsx');
    });
  });
});