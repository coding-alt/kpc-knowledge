'use client';

import { useQuery } from '@apollo/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Code, Bug, Shield, Zap, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { GET_CODE_QUALITY_METRICS } from '@/lib/graphql/queries';
import { formatNumber, formatPercentage } from '@/lib/utils';

interface CodeQualityDashboardProps {
  className?: string;
}

export function CodeQualityDashboard({ className }: CodeQualityDashboardProps) {
  const { data, loading, error } = useQuery(GET_CODE_QUALITY_METRICS, {
    pollInterval: 60000, // Poll every minute
  });

  const metrics = data?.codeQualityMetrics;

  if (loading) return <CodeQualityDashboardSkeleton />;
  if (error) return <CodeQualityDashboardError error={error.message} />;

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Quality Score Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QualityScoreCard
            title="Overall Quality"
            score={metrics?.overall?.score || 0}
            trend={metrics?.overall?.trend}
            icon={<Code className="h-4 w-4" />}
          />
          <QualityScoreCard
            title="Security Score"
            score={metrics?.security?.score || 0}
            trend={metrics?.security?.trend}
            icon={<Shield className="h-4 w-4" />}
          />
          <QualityScoreCard
            title="Performance"
            score={metrics?.performance?.score || 0}
            trend={metrics?.performance?.trend}
            icon={<Zap className="h-4 w-4" />}
          />
          <QualityScoreCard
            title="Maintainability"
            score={metrics?.maintainability?.score || 0}
            trend={metrics?.maintainability?.trend}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        {/* Detailed Analytics */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="complexity">Complexity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <QualityOverview metrics={metrics} />
          </TabsContent>

          <TabsContent value="issues" className="space-y-4">
            <IssuesAnalysis metrics={metrics?.issues} />
          </TabsContent>

          <TabsContent value="coverage" className="space-y-4">
            <CoverageAnalysis metrics={metrics?.coverage} />
          </TabsContent>

          <TabsContent value="complexity" className="space-y-4">
            <ComplexityAnalysis metrics={metrics?.complexity} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}f
unction QualityScoreCard({ title, score, trend, icon }: {
  title: string;
  score: number;
  trend?: string;
  icon: React.ReactNode;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score}/100
        </div>
        <Progress value={score} className="mt-2" />
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QualityOverview({ metrics }: { metrics?: any }) {
  const radarData = [
    { subject: 'Security', A: metrics?.security?.score || 0, fullMark: 100 },
    { subject: 'Performance', A: metrics?.performance?.score || 0, fullMark: 100 },
    { subject: 'Maintainability', A: metrics?.maintainability?.score || 0, fullMark: 100 },
    { subject: 'Reliability', A: metrics?.reliability?.score || 0, fullMark: 100 },
    { subject: 'Coverage', A: metrics?.coverage?.percentage || 0, fullMark: 100 },
    { subject: 'Documentation', A: metrics?.documentation?.score || 0, fullMark: 100 },
  ];

  const trendData = metrics?.trends || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Quality Radar</CardTitle>
          <CardDescription>Overall quality assessment across dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Quality Score"
                dataKey="A"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality Trends</CardTitle>
          <CardDescription>Quality score evolution over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="overall" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="security" stroke="#82ca9d" strokeWidth={1} />
              <Line type="monotone" dataKey="performance" stroke="#ffc658" strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function IssuesAnalysis({ metrics }: { metrics?: any }) {
  const issuesByType = metrics?.byType || [];
  const issuesBySeverity = metrics?.bySeverity || [];
  const recentIssues = metrics?.recent || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Issues by Type</CardTitle>
          <CardDescription>Distribution of code issues by category</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={issuesByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Issues</CardTitle>
          <CardDescription>Latest code quality issues detected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentIssues.map((issue: any, index: number) => (
              <div key={index} className="flex items-start space-x-3">
                <div className={`mt-1 h-2 w-2 rounded-full ${getSeverityColor(issue.severity)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{issue.title}</p>
                  <p className="text-xs text-muted-foreground">{issue.file}</p>
                </div>
                <Badge variant={getSeverityVariant(issue.severity)}>
                  {issue.severity}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CoverageAnalysis({ metrics }: { metrics?: any }) {
  const coverageByFile = metrics?.byFile || [];
  const coverageHistory = metrics?.history || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Coverage by File Type</CardTitle>
          <CardDescription>Test coverage across different file types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coverageByFile.map((item: any) => (
              <div key={item.type} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{item.type}</span>
                  <span className="text-sm">{item.coverage}%</span>
                </div>
                <Progress value={item.coverage} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage Trends</CardTitle>
          <CardDescription>Test coverage evolution over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={coverageHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="lines" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="branches" stroke="#82ca9d" strokeWidth={1} />
              <Line type="monotone" dataKey="functions" stroke="#ffc658" strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function ComplexityAnalysis({ metrics }: { metrics?: any }) {
  const complexityByFile = metrics?.byFile || [];
  const complexityDistribution = metrics?.distribution || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Complexity Distribution</CardTitle>
          <CardDescription>Cyclomatic complexity across the codebase</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={complexityDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>High Complexity Files</CardTitle>
          <CardDescription>Files with highest cyclomatic complexity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {complexityByFile.map((file: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.path}</p>
                </div>
                <Badge variant={getComplexityVariant(file.complexity)}>
                  {file.complexity}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeQualityDashboardSkeleton() {
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
              <div className="h-2 w-full bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="h-96 bg-muted rounded animate-pulse" />
    </div>
  );
}

function CodeQualityDashboardError({ error }: { error: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load quality metrics</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function getSeverityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

function getSeverityVariant(severity: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'outline';
    default:
      return 'secondary';
  }
}

function getComplexityVariant(complexity: number): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (complexity > 20) return 'destructive';
  if (complexity > 10) return 'outline';
  return 'secondary';
}