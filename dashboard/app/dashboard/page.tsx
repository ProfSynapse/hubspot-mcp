'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SummaryCards } from '@/components/summary-cards';
import { UsageChart } from '@/components/usage-chart';
import { ResponseTimeChart } from '@/components/response-time-chart';
import { ErrorTable } from '@/components/error-table';
import { TimeFilter } from '@/components/time-filter';
import { fetchAnalyticsData, type AnalyticsResponse } from '@/lib/analytics-api';
import { logout, checkAuth } from '@/lib/auth';
import { RefreshCw, LogOut, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      
      // Load initial data
      await loadData();
    };

    verifyAuth();
  }, [router]);

  // Reload data when time period changes
  useEffect(() => {
    if (data !== null) { // Only reload if we have initial data
      loadData();
    }
  }, [timePeriod]);

  const loadData = async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      const analyticsData = await fetchAnalyticsData(timePeriod);
      setData(analyticsData);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Data loading error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      router.push('/login');
    } else {
      console.error('Logout failed:', result.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load data'}</p>
          <Button onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                HubSpot MCP Analytics
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor your HubSpot integration performance
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <TimeFilter 
                value={timePeriod} 
                onValueChange={setTimePeriod} 
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Summary Cards */}
          <SummaryCards data={data.summary} />
          
          {/* Charts Row */}
          <div className="grid gap-8 md:grid-cols-2">
            <UsageChart data={data.toolUsage} />
            <ResponseTimeChart data={data.toolUsage} />
          </div>
          
          {/* Error Table */}
          <ErrorTable data={data.errors} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            HubSpot MCP Analytics Dashboard - Last updated: {new Date().toLocaleString()}
          </p>
        </div>
      </footer>
    </div>
  );
}