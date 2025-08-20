import React, { useState, useEffect } from 'react';

interface Component {
  id: string;
  name: string;
  category: string;
  description: string;
  frameworks: string[];
  props: number;
  events: number;
  deprecated: boolean;
  lastUpdated: string;
}

export const ComponentBrowser: React.FC = () => {
  const [components, setComponents] = useState<Component[]>([]);
  const [filteredComponents, setFilteredComponents] = useState<Component[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFramework, setSelectedFramework] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

  const categories = ['all', 'form', 'navigation', 'data-display', 'feedback', 'layout'];
  const frameworks = ['all', 'react', 'vue', 'intact'];

  useEffect(() => {
    // 模拟加载组件数据
    const mockComponents: Component[] = [
      {
        id: '1',
        name: 'Button',
        category: 'form',
        description: 'A versatile button component with multiple variants',
        frameworks: ['react', 'vue', 'intact'],
        props: 8,
        events: 3,
        deprecated: false,
        lastUpdated: '2024-01-15',
      },
      {
        id: '2',
        name: 'Input',
        category: 'form',
        description: 'Text input component with validation support',
        frameworks: ['react', 'vue'],
        props: 12,
        events: 5,
        deprecated: false,
        lastUpdated: '2024-01-10',
      },
      {
        id: '3',
        name: 'Modal',
        category: 'feedback',
        description: 'Modal dialog component for displaying content',
        frameworks: ['react', 'vue', 'intact'],
        props: 6,
        events: 4,
        deprecated: false,
        lastUpdated: '2024-01-08',
      },
      {
        id: '4',
        name: 'Table',
        category: 'data-display',
        description: 'Data table with sorting and pagination',
        frameworks: ['react', 'vue'],
        props: 15,
        events: 8,
        deprecated: false,
        lastUpdated: '2024-01-05',
      },
      {
        id: '5',
        name: 'Navigation',
        category: 'navigation',
        description: 'Main navigation component',
        frameworks: ['react', 'vue', 'intact'],
        props: 10,
        events: 2,
        deprecated: false,
        lastUpdated: '2024-01-12',
      },
    ];

    setComponents(mockComponents);
    setFilteredComponents(mockComponents);
  }, []);

  useEffect(() => {
    let filtered = components;

    // 按类别过滤
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(comp => comp.category === selectedCategory);
    }

    // 按框架过滤
    if (selectedFramework !== 'all') {
      filtered = filtered.filter(comp => comp.frameworks.includes(selectedFramework));
    }

    // 按搜索查询过滤
    if (searchQuery) {
      filtered = filtered.filter(comp =>
        comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredComponents(filtered);
  }, [components, selectedCategory, selectedFramework, searchQuery]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Filters and Search */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">组件浏览器</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜索组件
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入组件名称..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                类别
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? '全部' : category}
                  </option>
                ))}
              </select>
            </div>

            {/* Framework Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                框架
              </label>
              <select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {frameworks.map(framework => (
                  <option key={framework} value={framework}>
                    {framework === 'all' ? '全部' : framework}
                  </option>
                ))}
              </select>
            </div>

            {/* Results Count */}
            <div className="flex items-end">
              <div className="text-sm text-gray-500">
                找到 {filteredComponents.length} 个组件
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Component List */}
      <div className="lg:col-span-2">
        <div className="space-y-4">
          {filteredComponents.map((component) => (
            <div
              key={component.id}
              onClick={() => setSelectedComponent(component)}
              className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all ${
                selectedComponent?.id === component.id
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    {component.name}
                    {component.deprecated && (
                      <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                        已废弃
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{component.description}</p>
                </div>
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                  {component.category}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>属性: {component.props}</span>
                  <span>事件: {component.events}</span>
                  <span>更新: {component.lastUpdated}</span>
                </div>
                <div className="flex space-x-1">
                  {component.frameworks.map(framework => (
                    <span
                      key={framework}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                    >
                      {framework}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {filteredComponents.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">未找到组件</h3>
              <p className="text-gray-500">尝试调整搜索条件或过滤器</p>
            </div>
          )}
        </div>
      </div>

      {/* Component Details */}
      <div className="lg:col-span-1">
        {selectedComponent ? (
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedComponent.name} 详情
            </h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">描述</h4>
                <p className="text-sm text-gray-600">{selectedComponent.description}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">支持框架</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedComponent.frameworks.map(framework => (
                    <span
                      key={framework}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                    >
                      {framework}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">属性数量</h4>
                  <p className="text-2xl font-bold text-blue-600">{selectedComponent.props}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">事件数量</h4>
                  <p className="text-2xl font-bold text-green-600">{selectedComponent.events}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">最后更新</h4>
                <p className="text-sm text-gray-600">{selectedComponent.lastUpdated}</p>
              </div>

              <div className="pt-4 border-t">
                <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                  查看详细文档
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-gray-400 text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">选择组件</h3>
            <p className="text-gray-500">点击左侧组件查看详细信息</p>
          </div>
        )}
      </div>
    </div>
  );
};