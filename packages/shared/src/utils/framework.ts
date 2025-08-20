import { Framework } from '../types/core';

/**
 * 框架特定的文件扩展名映射
 */
export const FRAMEWORK_EXTENSIONS: Record<Framework, string[]> = {
  react: ['.tsx', '.jsx', '.ts', '.js'],
  vue: ['.vue'],
  intact: ['.ts', '.js'],
};

/**
 * 根据文件路径推断框架类型
 */
export function inferFrameworkFromPath(filePath: string): Framework | null {
  const extension = filePath.substring(filePath.lastIndexOf('.'));
  
  if (extension === '.vue') {
    return 'vue';
  }
  
  if (['.tsx', '.jsx'].includes(extension)) {
    return 'react';
  }
  
  if (['.ts', '.js'].includes(extension)) {
    // 需要进一步分析内容来区分React和Intact
    return null;
  }
  
  return null;
}

/**
 * 获取框架的默认导入语句
 */
export function getFrameworkImport(framework: Framework): string {
  switch (framework) {
    case 'react':
      return "import React from 'react';";
    case 'vue':
      return "import { defineComponent } from 'vue';";
    case 'intact':
      return "import { Component } from 'intact';";
    default:
      return '';
  }
}

/**
 * 获取框架特定的事件命名约定
 */
export function normalizeEventName(eventName: string, framework: Framework): string {
  switch (framework) {
    case 'react':
      // React使用驼峰命名，如onClick
      return eventName.startsWith('on') ? eventName : `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
    case 'vue':
      // Vue使用@前缀，如@click
      return eventName.startsWith('@') ? eventName : `@${eventName}`;
    case 'intact':
      // Intact使用ev-前缀，如ev-click
      return eventName.startsWith('ev-') ? eventName : `ev-${eventName}`;
    default:
      return eventName;
  }
}

/**
 * 获取框架特定的属性命名约定
 */
export function normalizePropName(propName: string, framework: Framework): string {
  switch (framework) {
    case 'react':
      // React使用驼峰命名
      return propName;
    case 'vue':
      // Vue支持kebab-case和camelCase
      return propName;
    case 'intact':
      // Intact使用驼峰命名
      return propName;
    default:
      return propName;
  }
}

/**
 * 检查框架是否支持特定功能
 */
export function supportsFeature(framework: Framework, feature: string): boolean {
  const features: Record<Framework, string[]> = {
    react: ['jsx', 'hooks', 'context', 'fragments'],
    vue: ['template', 'composition-api', 'slots', 'directives'],
    intact: ['template', 'widgets', 'blocks'],
  };
  
  return features[framework]?.includes(feature) ?? false;
}