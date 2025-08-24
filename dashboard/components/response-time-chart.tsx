'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ToolUsageData } from '@/lib/analytics-api';

interface ResponseTimeChartProps {
  data: ToolUsageData[];
}

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  // Prepare data for the chart - only show tools with significant usage
  const chartData = data
    .filter(item => item.call_count > 0 && item.avg_response_time > 0)
    .map((item) => ({
      name: `${item.tool_name}${item.operation ? `:${item.operation}` : ''}`,
      responseTime: Math.round(item.avg_response_time || 0),
      calls: item.call_count,
    }))
    .sort((a, b) => b.calls - a.calls) // Sort by usage
    .slice(0, 8); // Take top 8 for readability

  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Response Times</CardTitle>
        <CardDescription>
          Average response time by tool (most used tools)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                fontSize={12}
              />
              <YAxis 
                label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value) => [`${value} ms`, 'Response Time']}
                labelFormatter={(label) => `Tool: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="responseTime" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}