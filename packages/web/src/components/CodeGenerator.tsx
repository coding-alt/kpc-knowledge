import React, { useState } from 'react';

interface GenerationResult {
  code: string;
  framework: string;
  componentName: string;
  confidence: number;
  errors: string[];
}

export const CodeGenerator: React.FC = () => {
  const [requirement, setRequirement] = useState<string>('');
  const [framework, setFramework] = useState<'react' | 'vue' | 'intact'>('react');
  const [options, setOptions] = useState({
    typescript: true,
    tests: false,
    stories: false,
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const handleGenerate = async () => {
    if (!requirement.trim()) return;

    setIsGenerating(true);
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult: GenerationResult = {
        code: generateMockCode(requirement, framework),
        framework,
        componentName: extractComponentName(requirement),
        confidence: 0.85,
        errors: [],
      };
      
      setResult(mockResult);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMockCode = (req: string, fw: string): string => {
    const componentName = extractComponentName(req);
    
    if (fw === 'react') {
      return `import React from 'react';

interface ${componentName}Props {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const ${componentName}: React.FC<${componentName}Props> = ({ 
  children, 
  className, 
  onClick 
}) => {
  return (
    <div className={className} onClick={onClick}>
      {children || '${componentName}'}
    </div>
  );
};

export default ${componentName};`;
    }
    
    return `// ${fw} code for ${componentName}`;
  };

  const extractComponentName = (req: string): string => {
    if (req.toLowerCase().includes('button')) return 'Button';
    if (req.toLowerCase().includes('input')) return 'Input';
    if (req.toLowerCase().includes('modal')) return 'Modal';
    return 'Component';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">代码生成器</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                需求描述
              </label>
              <textarea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="描述你想要生成的组件，例如：创建一个带有图标的按钮组件"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                目标框架
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="react">React</option>
                <option value="vue">Vue</option>
                <option value="intact">Intact</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                生成选项
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.typescript}
                    onChange={(e) => setOptions({...options, typescript: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">TypeScript</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.tests}
                    onChange={(e) => setOptions({...options, tests: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">生成测试文件</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.stories}
                    onChange={(e) => setOptions({...options, stories: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">生成Storybook</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!requirement.trim() || isGenerating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? '生成中...' : '🤖 生成代码'}
            </button>
          </div>
        </div>

        {/* Generation Status */}
        {isGenerating && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">正在生成代码...</h3>
                <p className="text-sm text-gray-500">AI正在分析需求并生成代码</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Output Panel */}
      <div>
        {result ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  生成结果: {result.componentName}
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    {result.framework}
                  </span>
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                    置信度: {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <pre className="bg-gray-50 rounded-md p-4 overflow-x-auto text-sm">
                <code>{result.code}</code>
              </pre>
              
              <div className="mt-4 flex space-x-2">
                <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                  📋 复制代码
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  💾 保存文件
                </button>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
                  🧪 运行测试
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🤖</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">准备生成代码</h3>
            <p className="text-gray-500">输入需求描述并点击生成按钮开始</p>
          </div>
        )}
      </div>
    </div>
  );
};