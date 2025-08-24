export interface ToolUsageData {
  tool_name: string;
  operation: string;
  call_count: number;
  avg_response_time: number;
}

export interface ErrorData {
  tool_name: string;
  operation: string;
  error_code: string;
  error_count: number;
  timestamp?: string;
  error_message?: string;
}

export interface SummaryStats {
  totalCalls: number;
  errorRate: number;
  avgResponseTime: number;
}

export interface AnalyticsResponse {
  toolUsage: ToolUsageData[];
  errors: ErrorData[];
  summary: SummaryStats;
}

export async function fetchAnalyticsData(days: number = 7): Promise<AnalyticsResponse> {
  try {
    const response = await fetch(`/api/analytics?days=${days}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Analytics fetch error:', error);
    // Return empty data structure on error
    return {
      toolUsage: [],
      errors: [],
      summary: {
        totalCalls: 0,
        errorRate: 0,
        avgResponseTime: 0,
      },
    };
  }
}