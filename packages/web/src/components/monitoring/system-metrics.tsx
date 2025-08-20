'use client';

import { useQuery, useSubscription } from '@apollo/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Activity, Cpu, Database, HardDrive, Network, Users, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { GET_SYSTEM_METRICS, SYSTEM_METRICS_SUBSCRIPTION } from '@/lib/graphql/queries';
import { formatBytes, formatNumber, formatPercentage } from '@/lib/utils';

interface SystemMetricsProps {
  className?: string;
}

export function SystemMetrics({ className }: SystemMetricsProps) {
  const { data: metricsData, loading, error } = useQuery(GET_SYSTEM_METRICS, {
    pollInterval: 30000, // Poll every 30 seconds
  });

  const { data: realtimeData } = useSubscription(SYSTEM_METRICS_SUBSCRIPTION);

  const metrics = realtimeData?.systemMetrics || metricsData?.systemMetrics;

  if (loading) return <SystemMetricsSkeleton />;
  if (error) return <SystemMetricsError error={error.message} />;

  return (
    <div className={className}>
      <div className="grid gap-6">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="System Health"
            value={metrics?.health?.status || 'Unknown'}
            icon={<Activity className="h-4 w-4" />}
            trend={metrics?.health?.uptime}
            color={getHealthColor(metrics?.health?.status)}
          />
          <MetricCard
            title="Active Users"
            value={formatNumber(metrics?.users?.active || 0)}
            icon={<Users className="h-4 w-4" />}
            trend={`+${metrics?.users?.growth || 0}%`}
            color="text-blue-600"
          />
          <MetricCard
            title="API Requests"
            value={formatNumber(metrics?.api?.requests?.total || 0)}
            icon={<Network className="h-4 w-4" />}
            trend={`${metrics?.api?.requests?.rps || 0} req/s`}
            color="text-green-600"
          />
          <MetricCard
            title="Error Rate"
            value={formatPercentage(metrics?.api?.errors?.rate || 0, 100)}
            icon={<AlertTriangle className="h-4 w-4" />}
            trend={metrics?.api?.errors?.trend || 'stable'}
            color="text-red-600"
          />
        </div>

        {/* Detailed Metrics */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="api">API Analytics</TabsTrigger>
            <TabsTrigger value="errors">Error Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceMetrics metrics={metrics?.performance} />
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <ResourceMetrics metrics={metrics?.resources} />
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <ApiMetrics metrics={metrics?.api} />
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <ErrorMetrics metrics={metrics?.errors} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, color }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={color}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground">
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceMetrics({ metrics }: { metrics?: any }) {
  const responseTimeData = metrics?.responseTime?.history || [];
  const throughputData = metrics?.throughput?.history || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Response Time</CardTitle>
          <CardDescription>Average response time over the last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="p95" stroke="#82ca9d" strokeWidth={1} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Throughput</CardTitle>
          <CardDescription>Requests per second over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="rps" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceMetrics({ metrics }: { metrics?: any }) {
  const cpuUsage = metrics?.cpu?.usage || 0;
  const memoryUsage = metrics?.memory?.usage || 0;
  const diskUsage = metrics?.disk?.usage || 0;
  const networkUsage = metrics?.network?.usage || 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>System Resources</CardTitle>
          <CardDescription>Current resource utilization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4" />
                <span className="text-sm">CPU</span>
              </div>
              <span className="text-sm font-medium">{cpuUsage}%</span>
            </div>
            <Progress value={cpuUsage} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span className="text-sm">Memory</span>
              </div>
              <span className="text-sm font-medium">{memoryUsage}%</span>
            </div>
            <Progress value={memoryUsage} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm">Disk</span>
              </div>
              <span className="text-sm font-medium">{diskUsage}%</span>
            </div>
            <Progress value={diskUsage} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Network className="h-4 w-4" />
                <span className="text-sm">Network</span>
              </div>
              <span className="text-sm font-medium">{formatBytes(networkUsage)}/s</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
          <CardDescription>Status of all system services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(metrics?.services || []).map((service: any) => (
              <div key={service.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${getServiceStatusColor(service.status)}`} />
                  <span className="text-sm">{service.name}</span>
                </div>
                <Badge variant={service.status === 'healthy' ? 'default' : 'destructive'}>
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ApiMetrics({ metrics }: { metrics?: any }) {
  const endpointData = metrics?.endpoints || [];
  const methodData = metrics?.methods || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top Endpoints</CardTitle>
          <CardDescription>Most frequently accessed API endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={endpointData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="endpoint" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="requests" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Methods</CardTitle>
          <CardDescription>Distribution of HTTP methods</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={methodData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {methodData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={getMethodColor(entry.method)} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorMetrics({ metrics }: { metrics?: any }) {
  const errorTrends = metrics?.trends || [];
  const errorTypes = metrics?.types || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Error Trends</CardTitle>
          <CardDescription>Error rate over the last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={errorTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Error Types</CardTitle>
          <CardDescription>Most common error categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {errorTypes.map((error: any) => (
              <div key={error.type} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">{error.type}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{error.count}</span>
                  <Badge variant="destructive">{error.percentage}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SystemMetricsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="h-96 bg-muted rounded animate-pulse" />
    </div>
  );
}

function SystemMetricsError({ error }: { error: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load metrics</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function getHealthColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'healthy':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

function getServiceStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'healthy':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function getMethodColor(method: string) {
  const colors = {
    GET: '#10b981',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    DELETE: '#ef4444',
    PATCH: '#8b5cf6',
  };
  return colors[method as keyof typeof colors] || '#6b7280';
}