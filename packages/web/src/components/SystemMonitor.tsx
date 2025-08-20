import React, { useState, useEffect } from 'react';

interface SystemMetrics {
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  quality: {
    astAccuracy: number;
    compilationRate: number;
    visualStability: number;
  };
  storage: {
    vectorCount: number;
    graphNodes: number;
    cacheHitRate: number;
  };
  activity: {
    generationsToday: number;
    validationsToday: number;
    searchesToday: number;
  };
}

export const SystemMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    performance: {
      avgResponseTime: 1.2,
      throughput: 45,
      errorRate: 0.02,
    },
    quality: {
      astAccuracy: 0.98,
      compilationRate: 0.99,
      visualStability: 0.95,
    },
    storage: {
      vectorCount: 12450,
      graphNodes: 3280,
      cacheHitRate: 0.87,
    },
    activity: {
      generationsToday: 156,
      validationsToday: 234,
      searchesToday: 89,
    },
  });

  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    // 模拟实时数据更新
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        performance: {
          ...prev.performance,
          avgResponseTime: prev.performance.avgResponseTime + (Math.random() - 0.5) * 0.1,
          throughput: Math.max(0, prev.performance.throughput + (Math.random() - 0.5) * 5),
        },
        activity: {
          ...prev.activity,
          generationsToday: prev.activity.generationsToday + Math.floor(Math.random() * 2),
          validationsToday: prev.activity.validationsToday + Math.floor(Math.random() * 3),
          searchesToday: prev.activity.searchesToday + Math.floor(Math.random() * 2),
        },
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'stable';
    color?: 'blue' | 'green' | 'red' | 'yellow';
  }> = ({ title, value, unit, trend, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-700',
      green: 'bg-green-50 text-green-700',
      red: 'bg-red-50 text-red-700',
      yellow: 'bg-yellow-50 text-yellow-700',
    };

    const trendIcon = {
      up: '📈',
      down: '📉',
      stable: '➡️',
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          {trend && (
            <span className="text-sm">{trendIcon[trend]}</span>
          )}
        </div>
        <div className="mt-2">
          <div className={`text-3xl font-bold ${colorClasses[color]}`}>
            {typeof value === 'number' ? value.toFixed(2) : value}
            {unit && <span className="text-lg ml-1">{unit}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">系统监控</h2>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">时间范围:</label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">最近1小时</option>
              <option value="24h">最近24小时</option>
              <option value="7d">最近7天</option>
              <option value="30d">最近30天</option>
            </select>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">性能指标</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="平均响应时间"
            value={metrics.performance.avgResponseTime}
            unit="s"
            trend="stable"
            color="blue"
          />
          <MetricCard
            title="吞吐量"
            value={metrics.performance.throughput}
            unit="req/min"
            trend="up"
            color="green"
          />
          <MetricCard
            title="错误率"
            value={(metrics.performance.errorRate * 100).toFixed(2)}
            unit="%"
            trend="down"
            color={metrics.performance.errorRate > 0.05 ? 'red' : 'green'}
          />
        </div>
      </div>

      {/* Quality Metrics */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">质量指标</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="AST解析准确率"
            value={(metrics.quality.astAccuracy * 100).toFixed(1)}
            unit="%"
            trend="stable"
            color={metrics.quality.astAccuracy >= 0.98 ? 'green' : 'yellow'}
          />
          <MetricCard
            title="代码编译通过率"
            value={(metrics.quality.compilationRate * 100).toFixed(1)}
            unit="%"
            trend="up"
            color={metrics.quality.compilationRate >= 0.99 ? 'green' : 'yellow'}
          />
          <MetricCard
            title="视觉回归稳定性"
            value={(metrics.quality.visualStability * 100).toFixed(1)}
            unit="%"
            trend="stable"
            color={metrics.quality.visualStability >= 0.95 ? 'green' : 'yellow'}
          />
        </div>
      </div>

      {/* Storage Metrics */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">存储指标</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="向量数据量"
            value={metrics.storage.vectorCount.toLocaleString()}
            trend="up"
            color="blue"
          />
          <MetricCard
            title="图谱节点数"
            value={metrics.storage.graphNodes.toLocaleString()}
            trend="up"
            color="blue"
          />
          <MetricCard
            title="缓存命中率"
            value={(metrics.storage.cacheHitRate * 100).toFixed(1)}
            unit="%"
            trend="stable"
            color={metrics.storage.cacheHitRate >= 0.8 ? 'green' : 'yellow'}
          />
        </div>
      </div>

      {/* Activity Metrics */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">今日活动</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="代码生成次数"
            value={metrics.activity.generationsToday}
            trend="up"
            color="green"
          />
          <MetricCard
            title="代码验证次数"
            value={metrics.activity.validationsToday}
            trend="up"
            color="blue"
          />
          <MetricCard
            title="搜索次数"
            value={metrics.activity.searchesToday}
            trend="stable"
            color="purple"
          />
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统健康状态</h3>
        
        <div className="space-y-4">
          {[
            { name: 'API服务', status: 'healthy', uptime: '99.9%' },
            { name: 'Milvus向量数据库', status: 'healthy', uptime: '99.8%' },
            { name: 'Neo4j知识图谱', status: 'healthy', uptime: '99.7%' },
            { name: 'Redis缓存', status: 'healthy', uptime: '99.9%' },
            { name: 'AI推理服务', status: 'healthy', uptime: '98.5%' },
          ].map((service) => (
            <div key={service.name} className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  service.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="text-sm font-medium text-gray-900">{service.name}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">可用性: {service.uptime}</span>
                <span className={`px-2 py-1 text-xs rounded ${
                  service.status === 'healthy' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {service.status === 'healthy' ? '正常' : '异常'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};