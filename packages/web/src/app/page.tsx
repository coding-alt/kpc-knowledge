import { Suspense } from 'react';
import { Dashboard } from '@/components/dashboard/dashboard';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to KPC Knowledge System. Monitor your component library and system performance.
        </p>
      </div>
      
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}