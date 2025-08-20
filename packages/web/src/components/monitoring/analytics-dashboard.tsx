'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { TrendingUp, TrendingDown, Users, Code, Search, Zap, AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react';
import { formatNumber, formatPercentage, formatRelativeTime } from '@/lib/utils';
import { gql } from '@apollo/client';
import { addDays, subDays, format } from 'date-fns';

const ANALYTICS_QUERY = gql`
  query GetAnalytics($startDate: DateTime!, $endDate: DateTime!, $granularity: String!) {
    analytics(startDate: $startDate, endDate: $endDate, granularity: $granularity) {
      usage {
        totalRequests
        uniqueUsers
        codeGenerations
        validations
        searches
        errors
        averageResponseTime
        peakConcurrentUsers
      }
      trends {
        timestamp
        requests
        users
        generations
        validations
        searches
        errors
        responseTime
      }
      components {
        mostUsed {
          name
          framework
          usageCount
          trend
        }
        mostGenerated {
          name
          framework
          generationCount
          successRate
        }
        mostSearched {
          name
          framework
          searchCount
          clickThroughRate
        }
      }
      performance {
        apiEndpoints {
          path
          method
          averageResponseTime
          requestCount
          errorRate
          p95ResponseTime
        }
        slowestQueries {
          query
          averageTime
          count
          optimization
        }
      }
      errors {
        byType {
          type
          count
          percentage
          trend
        }
        recent {
          timestamp
          type
          message
          service
          count
        }
      }
      users {
        byRegion {
          region
          userCount
          percentage
        }
        byFramework {
          framework
          userCount
          percentage
        }
        retention {
          period
          rate
          trend
        }
      }
    }
  }
`;

interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState('day');

  const { data, loading, error } = useQuery(ANALYTICS_QUERY, {
    variables: {
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      granularity,
    },
    pollInterval: 300000, // Poll every 5 minutes
  });

  const analytics = data?.analytics;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>Failed to load analytics: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            System usage and performance analytics
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hourly</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewMetrics analytics={analytics} />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <UsageAnalytics analytics={analytics} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceAnalytics analytics={analytics} />
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <ComponentAnalytics analytics={analytics} />
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <ErrorAnalytics analytics={analytics} />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserAnalytics analytics={analytics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewMetrics({ analytics }: { analytics: any }) {
  if (!analytics) return null;

  const { usage, trends } = analytics;
  const latestTrend = trends[trends.length - 1];
  const previousTrend = trends[trends.length - 2];

  const calculateTrend = (current: number, previous: number) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  const metrics = [
    {
      title: 'Total Requests',
      value: formatNumber(usage.totalRequests),
      trend: calculateTrend(latestTrend?.requests || 0, previousTrend?.requests || 0),
      icon: Activity,
    },
    {
      title: 'Active Users',
      value: formatNumber(usage.uniqueUsers),
      trend: calculateTrend(latestTrend?.users || 0, previousTrend?.users || 0),
      icon: Users,
    },
    {
      title: 'Code Generations',
      value: formatNumber(usage.codeGenerations),
      trend: calculateTrend(latestTrend?.generations || 0, previousTrend?.generations || 0),
      icon: Code,
    },
    {
      title: 'Avg Response Time',
      value: `${usage.averageResponseTime}ms`,
      trend: -calculateTrend(latestTrend?.responseTime || 0, previousTrend?.responseTime || 0),
      icon: Clock,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isPositive = metric.trend > 0;
          const TrendIcon = isPositive ? TrendingUp : TrendingDown;
          
          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <TrendIcon className={`h-3 w-3 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
                  <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                    {Math.abs(metric.trend).toFixed(1)}%
                  </span>
                  <span>from last period</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Usage Trends</CardTitle>
            <CardDescription>System usage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'PPP')}
                />
                <Area type="monotone" dataKey="requests" stackId="1" stroke="#8884d8" fill="#8884d8" name="Requests" />
                <Area type="monotone" dataKey="generations" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Generations" />
                <Area type="monotone" dataKey="validations" stackId="1" stroke="#ffc658" fill="#ffc658" name="Validations" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response Time Trends</CardTitle>
            <CardDescription>API response time over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'PPP')}
                />
                <Line type="monotone" dataKey="responseTime" stroke="#8884d8" name="Response Time (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function UsageAnalytics({ analytics }: { analytics: any }) {
  if (!analytics) return null;

  const { usage, trends } = analytics;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Feature Usage</CardTitle>
            <CardDescription>Most used features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4" />
                <span>Code Generation</span>
              </div>
              <span className="font-medium">{formatNumber(usage.codeGenerations)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Validations</span>
              </div>
              <span className="font-medium">{formatNumber(usage.validations)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <span>Searches</span>
              </div>
              <span className="font-medium">{formatNumber(usage.searches)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peak Usage</CardTitle>
            <CardDescription>Highest concurrent usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{usage.peakConcurrentUsers}</div>
            <p className="text-sm text-muted-foreground">concurrent users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>System error percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {formatPercentage(usage.errors, usage.totalRequests)}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatNumber(usage.errors)} errors
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Usage Trends</CardTitle>
          <CardDescription>Feature usage breakdown over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => format(new Date(value), 'PPP')}
              />
              <Line type="monotone" dataKey="generations" stroke="#8884d8" name="Code Generations" />
              <Line type="monotone" dataKey="validations" stroke="#82ca9d" name="Validations" />
              <Line type="monotone" dataKey="searches" stroke="#ffc658" name="Searches" />
              <Line type="monotone" dataKey="errors" stroke="#ff7300" name="Errors" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceAnalytics({ analytics }: { analytics: any }) {
  if (!analytics?.performance) return null;

  const { apiEndpoints, slowestQueries } = analytics.performance;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>API Endpoint Performance</CardTitle>
          <CardDescription>Response times and error rates by endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {apiEndpoints.map((endpoint: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{endpoint.method}</Badge>
                    <code className="text-sm">{endpoint.path}</code>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                    <span>{formatNumber(endpoint.requestCount)} requests</span>
                    <span>{endpoint.averageResponseTime}ms avg</span>
                    <span>{endpoint.p95ResponseTime}ms p95</span>
                    <span className={endpoint.errorRate > 0.05 ? 'text-red-500' : 'text-green-500'}>
                      {formatPercentage(endpoint.errorRate, 1)} errors
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slowest Queries</CardTitle>
          <CardDescription>Database queries that need optimization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {slowestQueries.map((query: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <code className="text-sm bg-muted px-2 py-1 rounded">{query.query}</code>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                    <span>{query.averageTime}ms avg</span>
                    <span>{formatNumber(query.count)} executions</span>
                    {query.optimization && (
                      <Badge variant="outline" className="text-blue-600">
                        {query.optimization}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComponentAnalytics({ analytics }: { analytics: any }) {
  if (!analytics?.components) return null;

  const { mostUsed, mostGenerated, mostSearched } = analytics.components;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Most Used Components</CardTitle>
            <CardDescription>Components with highest usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mostUsed.map((component: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{component.name}</div>
                    <div className="text-sm text-muted-foreground">{component.framework}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatNumber(component.usageCount)}</div>
                    <div className="flex items-center space-x-1 text-xs">
                      {component.trend > 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={component.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                        {Math.abs(component.trend).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Generated</CardTitle>
            <CardDescription>Components frequently generated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mostGenerated.map((component: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{component.name}</div>
                    <div className="text-sm text-muted-foreground">{component.framework}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatNumber(component.generationCount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatPercentage(component.successRate, 1)} success
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Searched</CardTitle>
            <CardDescription>Popular search queries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mostSearched.map((component: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{component.name}</div>
                    <div className="text-sm text-muted-foreground">{component.framework}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatNumber(component.searchCount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatPercentage(component.clickThroughRate, 1)} CTR
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Component Usage Distribution</CardTitle>
          <CardDescription>Framework usage breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'React', value: 45, color: '#61dafb' },
                  { name: 'Vue', value: 35, color: '#4fc08d' },
                  { name: 'Intact', value: 20, color: '#ff6b6b' },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {[
                  { name: 'React', value: 45, color: '#61dafb' },
                  { name: 'Vue', value: 35, color: '#4fc08d' },
                  { name: 'Intact', value: 20, color: '#ff6b6b' },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
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

function ErrorAnalytics({ analytics }: { analytics: any }) {
  if (!analytics?.errors) return null;

  const { byType, recent } = analytics.errors;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Error Distribution</CardTitle>
            <CardDescription>Errors by type and frequency</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#ff7300" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Types</CardTitle>
            <CardDescription>Breakdown by error category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byType.map((error: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="font-medium">{error.type}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatNumber(error.count)}</div>
                    <div className="flex items-center space-x-1 text-xs">
                      {error.trend > 0 ? (
                        <TrendingUp className="h-3 w-3 text-red-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-green-500" />
                      )}
                      <span className={error.trend > 0 ? 'text-red-500' : 'text-green-500'}>
                        {Math.abs(error.trend).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>Latest system errors and issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recent.map((error: any, index: number) => (
              <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant="destructive">{error.type}</Badge>
                    <Badge variant="outline">{error.service}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatRelativeTime(new Date(error.timestamp))}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{error.message}</p>
                  {error.count > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Occurred {error.count} times
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserAnalytics({ analytics }: { analytics: any }) {
  if (!analytics?.users) return null;

  const { byRegion, byFramework, retention } = analytics.users;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Users by Region</CardTitle>
            <CardDescription>Geographic distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byRegion.map((region: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{region.region}</span>
                  <div className="text-right">
                    <div className="font-medium">{formatNumber(region.userCount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatPercentage(region.percentage, 1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users by Framework</CardTitle>
            <CardDescription>Framework preference</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byFramework.map((framework: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{framework.framework}</span>
                  <div className="text-right">
                    <div className="font-medium">{formatNumber(framework.userCount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatPercentage(framework.percentage, 1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Retention</CardTitle>
            <CardDescription>Retention rates by period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {retention.map((period: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{period.period}</span>
                  <div className="text-right">
                    <div className="font-medium">{formatPercentage(period.rate, 1)}</div>
                    <div className="flex items-center space-x-1 text-xs">
                      {period.trend > 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={period.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                        {Math.abs(period.trend).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Activity Heatmap</CardTitle>
          <CardDescription>Activity patterns throughout the day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={generateActivityData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="activity" stroke="#8884d8" fill="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to generate activity data
function generateActivityData() {
  const data = [];
  for (let i = 0; i < 24; i++) {
    data.push({
      hour: `${i}:00`,
      activity: Math.floor(Math.random() * 100) + 20,
    });
  }
  return data;
}