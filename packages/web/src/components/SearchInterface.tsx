import React, { useState } from 'react';

interface SearchResult {
  id: string;
  title: string;
  type: 'component' | 'documentation' | 'example';
  content: string;
  score: number;
  framework?: string;
  category?: string;
}

export const SearchInterface: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchType, setSearchType] = useState<'semantic' | 'keyword'>('semantic');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    
    try {
      // 模拟搜索API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Button Component',
          type: 'component',
          content: 'A versatile button component with multiple variants and states',
          score: 0.95,
          framework: 'react',
          category: 'form',
        },
        {
          id: '2',
          title: 'Button Usage Examples',
          type: 'example',
          content: 'Code examples showing different ways to use the Button component',
          score: 0.88,
          framework: 'react',
        },
        {
          id: '3',
          title: 'Form Components Guide',
          type: 'documentation',
          content: 'Complete guide to using form components including buttons, inputs, and validation',
          score: 0.82,
        },
      ];
      
      setResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'component': return '🧩';
      case 'documentation': return '📚';
      case 'example': return '💡';
      default: return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'component': return 'bg-blue-100 text-blue-800';
      case 'documentation': return 'bg-green-100 text-green-800';
      case 'example': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Search Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">智能搜索</h2>
        
        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex space-x-2">
            <div className="flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索组件、文档或示例..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? '搜索中...' : '🔍 搜索'}
            </button>
          </div>

          {/* Search Options */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">搜索类型:</label>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="semantic">语义搜索</option>
                <option value="keyword">关键词搜索</option>
              </select>
            </div>
            
            <div className="text-sm text-gray-500">
              {searchType === 'semantic' ? 
                '🧠 使用AI理解搜索意图' : 
                '🔤 精确匹配关键词'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {isSearching ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">搜索中...</h3>
          <p className="text-gray-500">正在分析查询并搜索相关内容</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              搜索结果 ({results.length})
            </h3>
            <div className="text-sm text-gray-500">
              查询: "{query}"
            </div>
          </div>

          {results.map((result) => (
            <div key={result.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getTypeIcon(result.type)}</span>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{result.title}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 text-xs rounded ${getTypeColor(result.type)}`}>
                        {result.type}
                      </span>
                      {result.framework && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                          {result.framework}
                        </span>
                      )}
                      {result.category && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                          {result.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {(result.score * 100).toFixed(0)}% 匹配
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${result.score * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 mb-4">{result.content}</p>

              <div className="flex space-x-2">
                <button className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors">
                  查看详情
                </button>
                {result.type === 'component' && (
                  <button className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors">
                    使用组件
                  </button>
                )}
                {result.type === 'example' && (
                  <button className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded hover:bg-purple-200 transition-colors">
                    查看代码
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : query && !isSearching ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">未找到结果</h3>
          <p className="text-gray-500">尝试使用不同的关键词或切换搜索类型</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">开始搜索</h3>
          <p className="text-gray-500">输入关键词搜索组件、文档和示例</p>
          
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">搜索建议:</h4>
            <div className="flex flex-wrap justify-center gap-2">
              {['按钮组件', '表单验证', '数据表格', '模态框', '导航菜单'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};