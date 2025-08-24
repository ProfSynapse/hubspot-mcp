'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ToolUsageData } from '@/lib/analytics-api';

interface UsageChartProps {
  data: ToolUsageData[];
}

export function UsageChart({ data }: UsageChartProps) {
  // Prepare data for the chart - combine tool name and operation
  const chartData = data.map((item) => ({
    name: `${item.tool_name}${item.operation ? `:${item.operation}` : ''}`,
    calls: item.call_count,
    responseTime: Math.round(item.avg_response_time || 0),
  }));

  // Sort by call count and take top 10 for better visualization
  const topData = chartData
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Usage</CardTitle>
        <CardDescription>
          Number of tool calls by tool and operation (top 10)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                fontSize={12}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  value, 
                  name === 'calls' ? 'Call Count' : 'Avg Response (ms)'
                ]}
              />
              <Bar 
                dataKey="calls" 
                fill="#3b82f6" 
                name="calls"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}