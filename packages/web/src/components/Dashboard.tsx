import React, { useState, useEffect } from 'react';
import { ComponentBrowser } from './ComponentBrowser';
import { CodeGenerator } from './CodeGenerator';
import { SystemMonitor } from './SystemMonitor';
import { SearchInterface } from './SearchInterface';

interface DashboardProps {}

export const Dashboard: React.FC<DashboardProps> = () => {
  const [activeTab, setActiveTab] = useState<'browse' | 'generate' | 'search' | 'monitor'>('browse');
  const [systemStats, setSystemStats] = useState({
    totalComponents: 0,
    totalPatterns: 0,
    systemHealth: 'healthy',
    lastUpdate: new Date().toISOString(),
  });

  useEffect(() => {
    // 模拟加载系统统计数据
    const loadStats = async () => {
      // 这里应该调用实际的API
      setSystemStats({
        totalComponents: 156,
        totalPatterns: 23,
        systemHealth: 'healthy',
        lastUpdate: new Date().toISOString(),
      });
    };

    loadStats();
  }, []);

  const tabs = [
    { id: 'browse', label: '组件浏览', icon: '📚' },
    { id: 'generate', label: '代码生成', icon: '🤖' },
    { id: 'search', label: '智能搜索', icon: '🔍' },
    { id: 'monitor', label: '系统监控', icon: '📊' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                🚀 KPC Knowledge System
              </h1>
              <div className="ml-6 flex items-center space-x-4 text-sm text-gray-500">
                <span>组件: {systemStats.totalComponents}</span>
                <span>模式: {systemStats.totalPatterns}</span>
                <span className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-1 ${
                    systemStats.systemHealth === 'healthy' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  {systemStats.systemHealth === 'healthy' ? '正常' : '异常'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">设置</span>
                ⚙️
              </button>
              <button className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">帮助</span>
                ❓
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'browse' && <ComponentBrowser />}
        {activeTab === 'generate' && <CodeGenerator />}
        {activeTab === 'search' && <SearchInterface />}
        {activeTab === 'monitor' && <SystemMonitor />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              © 2024 KPC Knowledge System. Built with ❤️ for developers.
            </div>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-gray-700">文档</a>
              <a href="#" className="hover:text-gray-700">GitHub</a>
              <a href="#" className="hover:text-gray-700">反馈</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};